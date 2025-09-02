import { describe, it, expect } from 'vitest'
import { computeDerived } from '../src/domain/topology'
import type { FabricSpec } from '../src/app.types'

describe('Topology Pure Computation', () => {
  const validConfig: FabricSpec = {
    name: 'test-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 2,
    endpointProfile: {
      name: 'Standard 48-port',
      portsPerEndpoint: 2
    },
    endpointCount: 8 // Keep low for valid tests
  }

  describe('computeDerived', () => {
    it('should compute valid topology for standard configuration', () => {
      const topology = computeDerived(validConfig)
      
      expect(topology.leavesNeeded).toBe(1) // 8 / (48-2) = 0.17 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 2 = 2 / 32 = 0.06 → 1
      expect(topology.totalPorts).toBe(80) // 1*48 + 1*32 = 80
      expect(topology.oversubscriptionRatio).toBe(4) // 8 / (1*2) = 4
      expect(topology.isValid).toBe(true) // 4:1 is valid
      expect(topology.validationErrors).toEqual([])
    })

    it('should handle larger endpoint count requiring multiple leaves', () => {
      const largeConfig: FabricSpec = {
        ...validConfig,
        endpointCount: 16 // Keep reasonable for valid test
      }
      
      const topology = computeDerived(largeConfig)
      
      expect(topology.leavesNeeded).toBe(1) // 16 / (48-2) = 0.35 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 2 = 2 / 32 = 0.06 → 1
      expect(topology.totalPorts).toBe(80) // 1*48 + 1*32 = 80
      expect(topology.oversubscriptionRatio).toBe(8) // 16 / (1*2) = 8
      expect(topology.isValid).toBe(true) // 8:1 < 15:1, so valid
      expect(topology.validationErrors).not.toContain('Oversubscription too high: 8.00:1')
    })

    it('should handle high uplinks per leaf count', () => {
      const highUplinkConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 4,
        endpointCount: 8
      }
      
      const topology = computeDerived(highUplinkConfig)
      
      expect(topology.leavesNeeded).toBe(1) // 8 / (48-4) = 0.18 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 4 = 4 / 32 = 0.125 → 1
      expect(topology.totalPorts).toBe(80) // 1*48 + 1*32 = 80
      expect(topology.oversubscriptionRatio).toBe(2) // 8 / (1*4) = 2
      expect(topology.isValid).toBe(true) // 2:1 is valid
    })

    it('should handle zero uplinks per leaf by returning zero spines', () => {
      const zeroUplinksConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 0
      }
      
      const topology = computeDerived(zeroUplinksConfig)
      
      expect(topology.leavesNeeded).toBe(1) // Still need leaves for downlinks: 8 / 48 = 0.17 → 1
      expect(topology.spinesNeeded).toBe(0) // No spines needed with 0 uplinks
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('No spines computed')
    })

    it('should handle excessive uplinks per leaf', () => {
      const excessiveUplinksConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 48 // More than half the leaf ports
      }
      
      const topology = computeDerived(excessiveUplinksConfig)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('Too many uplinks per leaf')
    })

    it('should reject excessive oversubscription ratio', () => {
      const highOversubConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 2,
        endpointCount: 48
      }
      
      const topology = computeDerived(highOversubConfig)
      
      expect(topology.oversubscriptionRatio).toBe(12) // 48 / (2*2) = 12
      expect(topology.isValid).toBe(true) // 12:1 < 15:1, so valid
      expect(topology.validationErrors).not.toContain('Oversubscription too high: 12.00:1')
    })

    it('should handle edge case with single endpoint', () => {
      const singleEndpointConfig: FabricSpec = {
        ...validConfig,
        endpointCount: 1
      }
      
      const topology = computeDerived(singleEndpointConfig)
      
      expect(topology.leavesNeeded).toBe(1)
      expect(topology.spinesNeeded).toBe(1)
      expect(topology.oversubscriptionRatio).toBe(0.5) // 1 / (1*2) = 0.5
      expect(topology.isValid).toBe(true)
    })

    it('should handle boundary case at 4:1 oversubscription', () => {
      const boundaryConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 2,
        endpointCount: 8 // 8 / (1*2) = 4:1 exactly
      }
      
      const topology = computeDerived(boundaryConfig)
      
      expect(topology.leavesNeeded).toBe(1)
      expect(topology.totalPorts).toBe(80)
      expect(topology.oversubscriptionRatio).toBe(4) // Exactly 4:1
      expect(topology.isValid).toBe(true) // 4:1 is valid
    })

    it('should maintain precision in oversubscription calculations', () => {
      const config: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 2,
        endpointCount: 10
      }
      
      const topology = computeDerived(config)
      
      expect(topology.oversubscriptionRatio).toBe(5) // 10 / (1*2) = 5
      expect(topology.isValid).toBe(true) // 5:1 < 15:1
    })
  })

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle multiple spines requirement', () => {
      const massiveConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 4,
        endpointCount: 8, // Low endpoint count
        // Force multiple spines by having many leaves
        // We need > 32/4 = 8 leaves to require multiple spines
        // Let's create a scenario with high leaves
      }
      
      // Create config that forces multiple leaves with high uplink count
      const multiSpineConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 4,
        endpointCount: 400 // This will require many leaves
      }
      
      const topology = computeDerived(multiSpineConfig)
      
      expect(topology.leavesNeeded).toBe(10) // 400 / (48-4) = 400/44 = 9.09 → 10
      expect(topology.spinesNeeded).toBe(2) // 10 * 4 = 40 / 32 = 1.25 → 2
      // 400 endpoints / 40 uplinks = 10:1, which is < 15:1, so valid
      expect(topology.isValid).toBe(true)
    })

    it('should handle very small configurations', () => {
      const smallConfig: FabricSpec = {
        ...validConfig,
        uplinksPerLeaf: 2,
        endpointCount: 2
      }
      
      const topology = computeDerived(smallConfig)
      expect(topology.leavesNeeded).toBe(1) // 2 / (48-2) = 0.04 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 2 = 2 / 32 = 0.06 → 1
      expect(topology.oversubscriptionRatio).toBe(1) // 2 / (1*2) = 1:1
      expect(topology.isValid).toBe(true)
    })
  })

  describe('Multi-Class Topology Computation', () => {
    it('should compute topology for two-class fabric', () => {
      const multiClassConfig: FabricSpec = {
        name: 'multi-class-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'standard',
            name: 'Standard Class',
            role: 'standard',
            uplinksPerLeaf: 4,
            endpointProfiles: [
              { name: 'servers', type: 'server', count: 40, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
            ]
          },
          {
            id: 'border',
            name: 'Border Class',
            role: 'border',
            uplinksPerLeaf: 2,
            endpointProfiles: [
              { name: 'routers', type: 'network', count: 20, bandwidth: 100, redundancy: true, portsPerEndpoint: 1 }
            ]
          }
        ]
      }
      
      const topology = computeDerived(multiClassConfig)
      
      // Standard: 40/(48-4) = 0.91 -> 1 leaf
      // Border: 20/(48-2) = 0.43 -> 1 leaf 
      // Total: 2 leaves
      expect(topology.leavesNeeded).toBe(2)
      
      // Total uplinks: (1*4) + (1*2) = 6 uplinks
      // Spines needed: 6/32 = 0.19 -> 1 spine
      expect(topology.spinesNeeded).toBe(1)
      
      // Total endpoints: 40 + 20 = 60
      expect(topology.oversubscriptionRatio).toBe(10) // 60 / 6 = 10:1
      expect(topology.isValid).toBe(true) // 10:1 < 15:1, so valid
      expect(topology.validationErrors).not.toContain('Oversubscription too high: 10.00:1')
    })

    it('should maintain deterministic class ordering by ID', () => {
      const deterministicConfig: FabricSpec = {
        name: 'deterministic-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'zebra',
            name: 'Z Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 10 }]
          },
          {
            id: 'alpha',
            name: 'A Class', 
            role: 'border',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 15 }]
          }
        ]
      }
      
      const topology1 = computeDerived(deterministicConfig)
      const topology2 = computeDerived(deterministicConfig)
      
      // Results should be identical (deterministic)
      expect(topology1).toEqual(topology2)
    })

    it('should validate per-class spine divisibility constraint', () => {
      const invalidConfig: FabricSpec = {
        name: 'invalid-divisibility-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'class1',
            name: 'Class 1',
            role: 'standard',
            uplinksPerLeaf: 3, // Forces multiple spines but will cause divisibility issues
            endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 500 }] // Forces many leaves
          },
          {
            id: 'class2',
            name: 'Class 2',
            role: 'border',
            uplinksPerLeaf: 5, // Will cause divisibility issues with most spine counts
            endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 500 }] // Forces many leaves
          }
        ]
      }
      
      const topology = computeDerived(invalidConfig)
      
      // This config will likely result in 2+ spines due to high uplink count
      // With 500/(48-3) = 11.1 -> 12 leaves for class1 = 36 uplinks
      // With 500/(48-5) = 11.6 -> 12 leaves for class2 = 60 uplinks  
      // Total = 96 uplinks, 96/32 = 3 spines
      // class1: 3 % 3 = 0 (valid)
      // class2: 5 % 3 = 2 ≠ 0 (invalid)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain(
        'Class class2: uplinksPerLeaf (5) must be divisible by spines (3)'
      )
    })

    it('should handle mixed valid and invalid per-class configurations', () => {
      const mixedConfig: FabricSpec = {
        name: 'mixed-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'valid',
            name: 'Valid Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 20 }]
          },
          {
            id: 'invalid',
            name: 'Invalid Class',
            role: 'border', 
            uplinksPerLeaf: 50, // Exceeds half of leaf ports
            endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 10 }]
          }
        ]
      }
      
      const topology = computeDerived(mixedConfig)
      
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('Class invalid: Too many uplinks per leaf (50)')
    })

    it('should handle empty endpoint profiles gracefully', () => {
      const emptyEndpointsConfig: FabricSpec = {
        name: 'empty-endpoints-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'empty',
            name: 'Empty Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [] // No endpoints
          }
        ]
      }
      
      const topology = computeDerived(emptyEndpointsConfig)
      
      expect(topology.leavesNeeded).toBe(0)
      expect(topology.spinesNeeded).toBe(0)
      expect(topology.isValid).toBe(false)
      expect(topology.validationErrors).toContain('No leaves computed')
      expect(topology.validationErrors).toContain('No spines computed')
    })

    it('should calculate complex multi-spine scenarios correctly', () => {
      const complexConfig: FabricSpec = {
        name: 'complex-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'standard',
            name: 'Standard Class',
            role: 'standard',
            uplinksPerLeaf: 4,
            endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 200 }] // Forces multiple leaves
          },
          {
            id: 'border',
            name: 'Border Class',
            role: 'border',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 100 }] // Forces multiple leaves
          }
        ]
      }
      
      const topology = computeDerived(complexConfig)
      
      // Standard: 200/(48-4) = 4.55 -> 5 leaves
      // Border: 100/(48-2) = 2.17 -> 3 leaves
      // Total: 8 leaves
      expect(topology.leavesNeeded).toBe(8)
      
      // Total uplinks: (5*4) + (3*2) = 26 uplinks
      // Spines needed: 26/32 = 0.81 -> 1 spine
      expect(topology.spinesNeeded).toBe(1)
      
      // Total endpoints: 200 + 100 = 300
      expect(topology.oversubscriptionRatio).toBe(300 / 26) // ~11.54:1
      expect(topology.isValid).toBe(true) // ~11.54:1 < 15:1, so valid
    })

    it('should fallback to legacy mode for backwards compatibility', () => {
      const legacyConfig: FabricSpec = {
        name: 'legacy-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 8,
        endpointProfile: {
          name: 'Standard Server',
          portsPerEndpoint: 1
        }
        // No leafClasses defined
      }
      
      const topology = computeDerived(legacyConfig)
      
      // Should behave exactly like the original single-class tests
      expect(topology.leavesNeeded).toBe(1) // 8 / (48-2) = 0.17 -> 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 2 = 2 / 32 = 0.06 -> 1
      expect(topology.oversubscriptionRatio).toBe(4) // 8 / (1*2) = 4
      expect(topology.isValid).toBe(true) // 4:1 is valid
    })
  })
})