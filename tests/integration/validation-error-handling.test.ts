import { describe, it, expect } from 'vitest'
import { validateFabricSpec } from '../../src/app.state'
import { computeDerived } from '../../src/domain/topology'
import { allocateUplinks } from '../../src/domain/allocator'
import type { FabricSpec, LeafClass } from '../../src/app.types'

describe('Validation Error Handling Integration', () => {
  // Mock switch profiles for allocation testing
  const leafProfile = {
    modelId: 'DS2000',
    roles: ['leaf'],
    ports: {
      endpointAssignable: ['E1/1-48'],
      fabricAssignable: ['E1/49-56'] // Only 8 fabric ports
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

  describe('Schema Validation Errors', () => {
    it('should catch invalid fabric spec at schema level', () => {
      const invalidSpec = {
        name: '', // Empty name should be invalid
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 0, // Zero uplinks should be invalid
        endpointProfile: {
          name: 'Test',
          type: 'server',
          count: -5, // Negative count should be invalid
          bandwidth: 25,
          redundancy: false
        },
        endpointCount: 10
      }

      const validation = validateFabricSpec(invalidSpec)
      
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors.some(err => err.includes('name'))).toBe(true)
    })

    it('should validate multi-class leaf class constraints', () => {
      const leafClasses: LeafClass[] = [
        {
          id: '', // Empty ID should be invalid
          name: 'Test Class',
          role: 'standard',
          uplinksPerLeaf: -2, // Negative uplinks should be invalid
          endpointProfiles: [
            {
              name: 'Invalid Profile',
              type: 'server',
              count: -10, // Negative count should be invalid
              bandwidth: 0, // Zero bandwidth should be invalid
              redundancy: false,
              portsPerEndpoint: 1
            }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'invalid-multi-class',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      // While our current validateFabricSpec might not catch leaf class details,
      // the topology computation should catch logical errors
      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors.length).toBeGreaterThan(0)
    })
  })

  describe('Topology Constraint Violations', () => {
    it('should handle uplinks exceeding leaf port capacity', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'excessive-uplinks',
          name: 'Too Many Uplinks',
          role: 'standard',
          uplinksPerLeaf: 30, // Way more than DS2000 can handle (48/2 = 24 max)
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 10, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'excessive-uplinks-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('Class excessive-uplinks: Too many uplinks per leaf (30)')
    })

    it('should handle oversubscription limit violations', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'high-oversubscription',
          name: 'High Oversubscription',
          role: 'standard',
          uplinksPerLeaf: 2, // Very few uplinks
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 200, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 } // Many endpoints
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'oversubscription-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors.some(err => 
        err.includes('Oversubscription too high')
      )).toBe(true)
      expect(topology.oversubscriptionRatio).toBeGreaterThan(4.0)
    })

    it('should handle spine divisibility constraint violations', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'odd-uplinks',
          name: 'Odd Uplinks',
          role: 'standard',  
          uplinksPerLeaf: 5, // Number that won't divide evenly across 2 or 3 spines
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 1000, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 } // Force multiple leaves and spines
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'divisibility-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors.some(err =>
        err.includes('uplinksPerLeaf (5) must be divisible by spines')
      )).toBe(true)
    })
  })

  describe('Allocation Constraint Violations', () => {
    it('should handle insufficient leaf fabric ports', () => {
      const allocationSpec = {
        uplinksPerLeaf: 10, // More than leaf profile has (8 fabric ports)
        leavesNeeded: 1,
        spinesNeeded: 1,
        endpointCount: 20
      }

      const result = allocateUplinks(allocationSpec, leafProfile, spineProfile)
      
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.some(issue =>
        issue.includes('Leaf has only 8 fabric ports, need 10')
      )).toBe(true)
      expect(result.leafMaps).toEqual([])
    })

    it('should handle spine capacity exceeded', () => {
      // Create a spine profile with very limited capacity
      const limitedSpineProfile = {
        ...spineProfile,
        ports: {
          endpointAssignable: [],
          fabricAssignable: ['E1/1-4'] // Only 4 spine ports
        }
      }

      const allocationSpec = {
        uplinksPerLeaf: 2,
        leavesNeeded: 5, // 5 leaves * 2 uplinks = 10 uplinks needed
        spinesNeeded: 1, // But spine only has 4 ports
        endpointCount: 100
      }

      const result = allocateUplinks(allocationSpec, leafProfile, limitedSpineProfile)
      
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.some(issue =>
        issue.includes('Spine capacity exceeded')
      )).toBe(true)
    })

    it('should handle uneven uplink distribution', () => {
      const allocationSpec = {
        uplinksPerLeaf: 3, // Not divisible by spines
        leavesNeeded: 2,
        spinesNeeded: 2, // 3 uplinks / 2 spines = not evenly divisible
        endpointCount: 50
      }

      const result = allocateUplinks(allocationSpec, leafProfile, spineProfile)
      
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.some(issue =>
        issue.includes('Uplinks per leaf (3) must be divisible by number of spines (2)')
      )).toBe(true)
    })
  })

  describe('Cascading Error Recovery', () => {
    it('should gracefully handle multiple constraint violations', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'problematic-class-1',
          name: 'Multiple Issues Class',
          role: 'standard',
          uplinksPerLeaf: 25, // Too many uplinks for leaf capacity
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 2000, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 } // Causes high oversubscription
          ]
        },
        {
          id: 'problematic-class-2', 
          name: 'Another Problem Class',
          role: 'standard',
          uplinksPerLeaf: 3, // Odd number will cause spine divisibility issues
          endpointProfiles: [
            { name: 'Storage', type: 'storage', count: 100, bandwidth: 25, redundancy: false, portsPerEndpoint: 2 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'multiple-violations-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors.length).toBeGreaterThan(1)
      
      // Should catch multiple different types of errors
      const hasPortError = topology.validationErrors.some(err => err.includes('Too many uplinks'))
      const hasOversubError = topology.validationErrors.some(err => err.includes('Oversubscription'))
      const hasDivisibilityError = topology.validationErrors.some(err => err.includes('divisible by spines'))
      
      // At least one of these should be present
      expect(hasPortError || hasOversubError || hasDivisibilityError).toBe(true)
    })

    it('should provide helpful error messages for debugging', () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'debug-class',
          name: 'Debug Test Class',
          role: 'standard',
          uplinksPerLeaf: 30, // Exceeds 48/2 = 24 limit
          endpointProfiles: [
            { name: 'Debug Server', type: 'server', count: 100, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'debug-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      const topology = computeDerived(spec)
      
      expect(topology.isValid).toBe(false)
      
      // Error messages should include class ID for debugging
      const hasClassSpecificError = topology.validationErrors.some(err => 
        err.includes('debug-class') || err.includes('Debug Test Class')
      )
      expect(hasClassSpecificError).toBe(true)
    })

    it('should maintain consistency between topology and allocation errors', () => {
      // Create a spec that passes topology but fails allocation due to limited spine ports
      const leafClasses: LeafClass[] = [
        {
          id: 'allocation-fail',
          name: 'Allocation Failure',
          role: 'standard',
          uplinksPerLeaf: 8,
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 10, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'allocation-consistency-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses
      }

      // Topology should pass basic validation
      const topology = computeDerived(spec)
      expect(topology.isValid).toBe(true)
      
      // Create limited spine profile
      const limitedSpineProfile = {
        ...spineProfile,
        ports: {
          endpointAssignable: [],
          fabricAssignable: ['E1/1-4'] // Only 4 ports instead of 32
        }
      }
      
      // Allocation should fail due to limited spine capacity
      const allocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: topology.leavesNeeded,
        spinesNeeded: topology.spinesNeeded,
        endpointCount: 10
      }

      const allocation = allocateUplinks(allocationSpec, leafProfile, limitedSpineProfile)
      
      // Allocation should fail due to spine port shortage
      expect(allocation.issues.length).toBeGreaterThan(0)
      expect(allocation.leafMaps).toEqual([])
    })
  })
})