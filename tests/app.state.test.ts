import { describe, it, expect } from 'vitest'
import { computeLeavesNeeded, computeSpinesNeeded, computeOversubscription, validateFabricSpec, generateWiringStub } from '../src/app.state'
import { computeDerived } from '../src/domain/topology'
import type { FabricSpec } from '../src/app.state'

describe('App State Pure Functions', () => {
  describe('computeLeavesNeeded', () => {
    it('should compute leaves needed correctly', () => {
      expect(computeLeavesNeeded(48, 46)).toBe(2) // 48 endpoints / 46 ports per leaf = 1.04 → 2
      expect(computeLeavesNeeded(46, 46)).toBe(1) // Exactly one leaf
      expect(computeLeavesNeeded(1, 46)).toBe(1) // One endpoint still needs one leaf
      expect(computeLeavesNeeded(0, 46)).toBe(0) // Zero endpoints
      expect(computeLeavesNeeded(48, 0)).toBe(0) // Zero ports per leaf
    })
  })

  describe('computeSpinesNeeded', () => {
    it('should compute spines needed correctly', () => {
      expect(computeSpinesNeeded(2, 2)).toBe(1) // 2 leaves * 2 uplinks = 4 / 32 = 0.125 → 1
      expect(computeSpinesNeeded(17, 4)).toBe(3) // 17 leaves * 4 uplinks = 68 / 32 = 2.125 → 3
      expect(computeSpinesNeeded(1, 32)).toBe(1) // Exactly one spine worth
      expect(computeSpinesNeeded(0, 2)).toBe(0) // Zero leaves
      expect(computeSpinesNeeded(2, 0)).toBe(0) // Zero uplinks
    })
  })

  describe('computeOversubscription', () => {
    it('should compute oversubscription ratio correctly', () => {
      expect(computeOversubscription(4, 48)).toBe(12) // 48 / 4 = 12:1
      expect(computeOversubscription(8, 32)).toBe(4) // 32 / 8 = 4:1
      expect(computeOversubscription(10, 10)).toBe(1) // 10 / 10 = 1:1
      expect(computeOversubscription(0, 48)).toBe(0) // Zero uplinks
    })
  })

  describe('validateFabricSpec', () => {
    it('should validate correct fabric spec', () => {
      const validSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 48
      }
      
      const result = validateFabricSpec(validSpec)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.data).toEqual(validSpec)
    })

    it('should reject invalid fabric spec', () => {
      const invalidSpec = {
        name: '',
        uplinksPerLeaf: 3, // Odd number
        endpointCount: 0
      }
      
      const result = validateFabricSpec(invalidSpec)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toBeUndefined()
    })
  })

  describe('generateWiringStub', () => {
    it('should generate wiring stub for valid topology', () => {
      const validSpec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 2
      }
      
      const topology = computeDerived(validSpec)
      const wiring = generateWiringStub(validSpec, topology)
      
      expect(wiring.devices.spines).toHaveLength(topology.spinesNeeded)
      expect(wiring.devices.leaves).toHaveLength(topology.leavesNeeded)
      expect(wiring.devices.servers).toHaveLength(validSpec.endpointCount)
      expect(wiring.metadata.fabricName).toBe(validSpec.name)
      expect(wiring.connections.length).toBeGreaterThan(0)
    })

    it('should generate correct device IDs and models', () => {
      const validSpec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 1
      }
      
      const topology = computeDerived(validSpec)
      const wiring = generateWiringStub(validSpec, topology)
      
      expect(wiring.devices.spines[0]?.id).toBe('spine-1')
      expect(wiring.devices.spines[0]?.model).toBe('DS3000')
      expect(wiring.devices.leaves[0]?.id).toBe('leaf-1')
      expect(wiring.devices.leaves[0]?.model).toBe('DS2000')
      expect(wiring.devices.servers[0]?.id).toBe('server-1')
    })

    it('should create connections between devices', () => {
      const validSpec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 4
      }
      
      const topology = computeDerived(validSpec)
      const wiring = generateWiringStub(validSpec, topology)
      
      // Should have uplink connections from leaves to spines
      const uplinkConnections = wiring.connections.filter(conn => conn.type === 'uplink')
      expect(uplinkConnections.length).toBe(topology.leavesNeeded * validSpec.uplinksPerLeaf)
      
      // Verify connection structure
      expect(uplinkConnections[0]?.from.device).toMatch(/^leaf-\d+$/)
      expect(uplinkConnections[0]?.to.device).toMatch(/^spine-\d+$/)
      expect(uplinkConnections[0]?.from.port).toMatch(/^uplink-\d+$/)
      expect(uplinkConnections[0]?.to.port).toMatch(/^downlink-\d+$/)
    })
  })

  describe('Integration - Domain and State Functions', () => {
    it('should work together for end-to-end topology computation', () => {
      const spec: FabricSpec = {
        name: 'integration-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 8
      }
      
      // Validate the spec
      const validation = validateFabricSpec(spec)
      expect(validation.isValid).toBe(true)
      
      // Compute topology using domain function
      const topology = computeDerived(spec)
      expect(topology.leavesNeeded).toBe(1) // 8 / (48-2) = 0.17 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 2 = 2 / 32 = 0.06 → 1
      expect(topology.oversubscriptionRatio).toBe(4) // 8 / (1*2) = 4
      expect(topology.isValid).toBe(true) // 4:1 is valid
      
      // Generate wiring using state function
      const wiring = generateWiringStub(spec, topology)
      expect(wiring.devices.spines).toHaveLength(1)
      expect(wiring.devices.leaves).toHaveLength(1)
      expect(wiring.devices.servers).toHaveLength(8)
      expect(wiring.connections.length).toBe(2) // 1 leaf * 2 uplinks
    })

    it('should handle complex topology with multiple spines', () => {
      const spec: FabricSpec = {
        name: 'complex-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointProfile: {
          name: 'High Density',
          portsPerEndpoint: 1
        },
        endpointCount: 16 // Keep reasonable for test
      }
      
      const validation = validateFabricSpec(spec)
      expect(validation.isValid).toBe(true)
      
      const topology = computeDerived(spec)
      expect(topology.leavesNeeded).toBe(1) // 16 / (48-4) = 0.36 → 1
      expect(topology.spinesNeeded).toBe(1) // 1 * 4 = 4 / 32 = 0.125 → 1
      
      const wiring = generateWiringStub(spec, topology)
      expect(wiring.devices.spines).toHaveLength(1)
      expect(wiring.devices.leaves).toHaveLength(1)
      expect(wiring.devices.servers).toHaveLength(16)
      expect(wiring.connections.length).toBe(4) // 1 leaf * 4 uplinks
    })
  })
})