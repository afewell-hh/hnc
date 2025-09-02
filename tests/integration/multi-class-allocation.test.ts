import { describe, it, expect } from 'vitest'
import { computeDerived } from '../../src/domain/topology'
import { allocateUplinks } from '../../src/domain/allocator'
import type { FabricSpec, LeafClass } from '../../src/app.types'

describe('Multi-Class Allocation Integration', () => {
  // Mock switch profiles for testing
  const leafProfile = {
    modelId: 'DS2000',
    roles: ['leaf'],
    ports: {
      endpointAssignable: ['E1/1-48'],
      fabricAssignable: ['E1/49-56']
    },
    profiles: {
      endpoint: { portProfile: 'SFP28-25G', speedGbps: 25 },
      uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 }
    },
    meta: { source: 'test', version: '1.0.0' }
  }

  const spineProfile = {
    modelId: 'DS3000',
    roles: ['spine'],
    ports: {
      endpointAssignable: [],
      fabricAssignable: ['E1/1-32']
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 0 },
      uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 }
    },
    meta: { source: 'test', version: '1.0.0' }
  }

  describe('End-to-End Multi-Class Workflow', () => {
    it('should handle simple two-class fabric allocation', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'compute',
          name: 'Compute Nodes',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 100, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        },
        {
          id: 'storage', 
          name: 'Storage Nodes',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'Storage', type: 'storage', count: 100, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'multi-class-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      // Step 1: Compute topology - focus on basic multi-class computation working
      const topology = computeDerived(spec)
      
      // With uplinksPerLeaf = 2 for both classes and 100 endpoints each:
      // compute: 100/(48-2) = 100/46 = 2.17 -> 3 leaves -> 3*2 = 6 uplinks
      // storage: 100/(48-2) = 100/46 = 2.17 -> 3 leaves -> 3*2 = 6 uplinks  
      // Total: 6 leaves, 12 uplinks -> spines needed: 12/32 = 0.375 -> 1 spine
      
      expect(topology.leavesNeeded).toBe(6) // 3 for compute + 3 for storage
      expect(topology.spinesNeeded).toBe(1) // 12 uplinks / 32 = 1  
      expect(topology.oversubscriptionRatio).toBeCloseTo(16.67, 1) // 200 endpoints / 12 uplinks
      
      // The key test: multi-class computation produces results (validation details tested elsewhere)
      expect(topology.leavesNeeded).toBeGreaterThan(0)
      expect(topology.spinesNeeded).toBeGreaterThan(0)
      
      // Step 2: Verify multi-class allocation works
      const totalEndpoints = leafClasses.reduce((sum, lc) => 
        sum + lc.endpointProfiles.reduce((eSum, ep) => eSum + (ep.count || 0), 0), 0)
      expect(totalEndpoints).toBe(200) // 100 compute + 100 storage
      
      // Step 3: Test allocation for first class (compute with 2 uplinks)
      const computeAllocationSpec = {
        uplinksPerLeaf: 2,
        leavesNeeded: 1,
        spinesNeeded: 1,
        endpointCount: 20
      }
      
      const computeAllocation = allocateUplinks(computeAllocationSpec, leafProfile, spineProfile)
      expect(computeAllocation.issues).toEqual([])
      expect(computeAllocation.leafMaps).toHaveLength(1)
      expect(computeAllocation.leafMaps[0].uplinks).toHaveLength(2)
      
      // Step 4: Test allocation for second class (storage with 4 uplinks)
      const storageAllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 1, 
        spinesNeeded: 1,
        endpointCount: 10
      }
      
      const storageAllocation = allocateUplinks(storageAllocationSpec, leafProfile, spineProfile)
      expect(storageAllocation.issues).toEqual([])
      expect(storageAllocation.leafMaps).toHaveLength(1)
      expect(storageAllocation.leafMaps[0].uplinks).toHaveLength(4)
    })

    it('should handle constraint violations in multi-class setup', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'invalid-class',
          name: 'Invalid Class',
          role: 'standard',
          uplinksPerLeaf: 50, // Exceeds half of leaf ports - should cause constraint violation
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 10, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'constraint-violation-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      // Should still compute topology but have validation errors
      // With 50 uplinks per leaf, downlinks = 48-50 = -2, so 0 leaves computed
      expect(topology.leavesNeeded).toBe(0)
      expect(topology.spinesNeeded).toBe(0) 
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('Class invalid-class: Too many uplinks per leaf (50)')
      expect(topology.validationErrors).toContain('No leaves computed')
    })

    it('should handle mixed uplink counts across classes', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'low-bw',
          name: 'Low Bandwidth',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'Basic Server', type: 'server', count: 40, bandwidth: 10, redundancy: false, portsPerEndpoint: 1 }
          ]
        },
        {
          id: 'high-bw',
          name: 'High Bandwidth',  
          role: 'standard',
          uplinksPerLeaf: 4,
          endpointProfiles: [
            { name: 'HPC Node', type: 'compute', count: 16, bandwidth: 100, redundancy: false, portsPerEndpoint: 2 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'mixed-uplinks-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(true)
      expect(topology.leavesNeeded).toBe(2) // 1 for low-bw (40/46) + 1 for high-bw (16/44)
      expect(topology.spinesNeeded).toBe(1) // (1*2 + 1*4) = 6 total uplinks / 32 = 1
      expect(topology.oversubscriptionRatio).toBeCloseTo(9.33, 1) // 56 endpoints / 6 uplinks
    })

    it('should handle explicit leaf count specification', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'border',
          name: 'Border Leaves',
          role: 'border',
          uplinksPerLeaf: 4,
          count: 2, // Explicitly specify 2 leaves regardless of endpoint calculation
          endpointProfiles: [
            { name: 'Gateway', type: 'network', count: 8, bandwidth: 100, redundancy: true, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'explicit-count-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(true)
      expect(topology.leavesNeeded).toBe(2) // Should use explicit count, not calculated
      expect(topology.spinesNeeded).toBe(1) // 2*4 = 8 uplinks / 32 = 1
      
      // Verify that only 8 endpoints are counted despite having 2 leaves
      const totalEndpoints = leafClasses.reduce((sum, lc) => 
        sum + lc.endpointProfiles.reduce((eSum, ep) => eSum + (ep.count || 0), 0), 0)
      expect(totalEndpoints).toBe(8)
    })
  })

  describe('Backward Compatibility', () => {
    it('should handle legacy single-class spec without leafClasses', () => {
      const legacySpec: FabricSpec = {
        name: 'legacy-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: { name: 'Standard Server', type: 'server', count: 48, bandwidth: 25, redundancy: false, portsPerEndpoint: 2 },
        endpointCount: 48
      }

      const topology = computeDerived(legacySpec)
      
      expect(topology.isValid).toBe(true)
      expect(topology.leavesNeeded).toBe(2) // 48 / (48-2) = 1.04 -> 2
      expect(topology.spinesNeeded).toBe(1) // 2*2 = 4 uplinks / 32 = 1
      expect(topology.oversubscriptionRatio).toBe(12) // 48 endpoints / 4 uplinks
    })

    it('should prioritize leafClasses over legacy fields when both present', () => {
      const hybridSpec: FabricSpec = {
        name: 'hybrid-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        // Legacy fields (should be ignored)
        uplinksPerLeaf: 2,
        endpointProfile: { name: 'Legacy', type: 'server', count: 999, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 },
        endpointCount: 999,
        // New multi-class fields (should take precedence)
        leafClasses: [
          {
            id: 'modern',
            name: 'Modern Class',
            role: 'standard',
            uplinksPerLeaf: 4,
            endpointProfiles: [
              { name: 'Modern Server', type: 'server', count: 16, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
            ]
          }
        ]
      }

      const topology = computeDerived(hybridSpec)
      
      expect(topology.isValid).toBe(true)
      expect(topology.leavesNeeded).toBe(1) // Based on leafClasses, not legacy fields
      expect(topology.spinesNeeded).toBe(1) // 1*4 = 4 uplinks / 32 = 1
      // Should use 16 endpoints from leafClasses, not 999 from legacy
      expect(topology.oversubscriptionRatio).toBe(4) // 16 endpoints / 4 uplinks
    })
  })

  describe('Error Handling', () => {
    it('should validate empty leafClasses array', () => {
      const spec: FabricSpec = {
        name: 'empty-classes-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: []
      }

      const topology = computeDerived(spec)
      
      expect(topology.leavesNeeded).toBe(0)
      expect(topology.spinesNeeded).toBe(0)
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('No leaves computed')
      expect(topology.validationErrors).toContain('No spines computed')
    })

    it('should handle classes with zero endpoints', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'empty-class',
          name: 'Empty Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'No Endpoints', type: 'server', count: 0, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'zero-endpoints-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.leavesNeeded).toBe(0)
      expect(topology.spinesNeeded).toBe(0)
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('No leaves computed')
    })
  })
})