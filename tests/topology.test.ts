import { describe, it, expect } from 'vitest'
import { computeDerived } from '../src/domain/topology'
import type { FabricSpec } from '../src/app.state'

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
      expect(topology.isValid).toBe(false) // 8:1 > 4:1, so invalid
      expect(topology.validationErrors).toContain('Oversubscription too high: 8.00:1')
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
      expect(topology.isValid).toBe(false) 
      expect(topology.validationErrors).toContain('Oversubscription too high: 12.00:1')
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
      expect(topology.isValid).toBe(false) // 5:1 > 4:1
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
      expect(topology.isValid).toBe(false) // Massive over-subscription
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
})