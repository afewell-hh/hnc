import { describe, it, expect } from 'vitest'
import { FabricSpecSchema, validateFabricSpec } from '../src/app.state'

describe('FabricSpec Schema Validation', () => {
  describe('FabricSpecSchema', () => {
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
      
      expect(() => FabricSpecSchema.parse(validSpec)).not.toThrow()
      const result = FabricSpecSchema.parse(validSpec)
      expect(result).toEqual(validSpec)
    })

    it('should reject empty fabric name', () => {
      const invalidSpec = {
        name: '',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 48
      }
      
      expect(() => FabricSpecSchema.parse(invalidSpec)).toThrow('Fabric name is required')
    })

    it('should reject odd uplinks per leaf', () => {
      const invalidSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 3, // Odd number
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 48
      }
      
      expect(() => FabricSpecSchema.parse(invalidSpec)).toThrow('Uplinks per leaf must be even for proper distribution')
    })

    it('should reject uplinks per leaf less than 2', () => {
      const invalidSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 1,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 48
      }
      
      expect(() => FabricSpecSchema.parse(invalidSpec)).toThrow('Must have at least 2 uplinks per leaf')
    })

    it('should reject zero endpoint count', () => {
      const invalidSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'Standard Profile',
          portsPerEndpoint: 2
        },
        endpointCount: 0
      }
      
      expect(() => FabricSpecSchema.parse(invalidSpec)).toThrow('Must have at least 1 endpoint')
    })

    it('should reject missing required fields', () => {
      const invalidSpec = {
        name: 'test-fabric',
        // Missing spineModelId, leafModelId, etc.
      }
      
      expect(() => FabricSpecSchema.parse(invalidSpec)).toThrow()
    })
  })

  describe('validateFabricSpec helper', () => {
    it('should return valid result for correct spec', () => {
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

    it('should return invalid result with errors', () => {
      const invalidSpec = {
        name: '',
        spineModelId: 'DS3000',
        uplinksPerLeaf: 3
      }
      
      const result = validateFabricSpec(invalidSpec)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toBeUndefined()
    })
  })
})