/**
 * Unit tests for Fabric Validation Rules Engine - HNC v0.4.1
 * Tests for all rule codes as specified in WP-OVR1
 */

import { describe, it, expect } from 'vitest'
import { evaluate, type RuleEvaluationResult, type SwitchCatalog } from './rules'
import type { FabricSpec, DerivedTopology } from '../app.types'

// Test switch catalog implementation
const testCatalog: SwitchCatalog = {
  getSwitchModel: (modelId: string) => {
    const models: Record<string, { ports: number; type: 'leaf' | 'spine' }> = {
      'DS2000': { ports: 48, type: 'leaf' },
      'DS3000': { ports: 32, type: 'spine' },
      'DS1000': { ports: 24, type: 'leaf' }, // Smaller leaf for testing
      'DS4000': { ports: 64, type: 'spine' }  // Larger spine for testing
    }
    return models[modelId] || null
  },
  getModelProfile: (modelId: string) => {
    const profiles: Record<string, { maxCapacity: number; recommended: string[] }> = {
      'DS2000': { maxCapacity: 1200, recommended: ['server', 'storage'] },
      'DS3000': { maxCapacity: 800, recommended: ['uplink', 'interconnect'] },
      'DS1000': { maxCapacity: 600, recommended: ['edge', 'access'] },
      'DS4000': { maxCapacity: 1600, recommended: ['core', 'uplink'] }
    }
    return profiles[modelId] || null
  }
}

describe('Rules Engine', () => {
  describe('SPINE_CAPACITY_EXCEEDED', () => {
    it('should detect spine capacity exceeded in multi-class mode', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000', // 32 ports per spine
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'heavy-class',
            name: 'Heavy Load Class',
            role: 'standard',
            uplinksPerLeaf: 4,
            count: 20, // 20 leaves * 4 uplinks = 80 uplinks total
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 800 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 20,
        spinesNeeded: 2, // Only 2 spines = 64 ports total, but need 80
        totalPorts: 1024,
        usedPorts: 1680,
        oversubscriptionRatio: 10,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const spineErrors = result.errors.filter(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
      expect(spineErrors).toHaveLength(1)
      expect(spineErrors[0].code).toBe('SPINE_CAPACITY_EXCEEDED')
      expect(spineErrors[0].severity).toBe('error')
      expect(spineErrors[0].context?.actual).toBe(80) // 20 leaves * 4 uplinks
      expect(spineErrors[0].context?.expected).toBe(64) // 2 spines * 32 ports
    })

    it('should detect spine capacity exceeded in legacy mode', () => {
      const spec: FabricSpec = {
        name: 'legacy-fabric',
        spineModelId: 'DS3000', // 32 ports per spine
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 200,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 10, // 10 leaves * 4 uplinks = 40 uplinks
        spinesNeeded: 1,  // Only 1 spine = 32 ports, but need 40
        totalPorts: 512,
        usedPorts: 480,
        oversubscriptionRatio: 5,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('SPINE_CAPACITY_EXCEEDED')
    })

    it('should not flag when spine capacity is sufficient', () => {
      const spec: FabricSpec = {
        name: 'good-fabric',
        spineModelId: 'DS3000', // 32 ports per spine
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 100,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 5,  // 5 leaves * 2 uplinks = 10 uplinks
        spinesNeeded: 1,  // 1 spine = 32 ports, plenty for 10 uplinks
        totalPorts: 320,
        usedPorts: 220,
        oversubscriptionRatio: 2,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const spineErrors = result.errors.filter(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
      expect(spineErrors).toHaveLength(0)
    })
  })

  describe('LEAF_CAPACITY_EXCEEDED', () => {
    it('should detect leaf capacity exceeded in multi-class mode', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS1000', // Small leaf with 24 ports
        leafClasses: [
          {
            id: 'overloaded-class',
            name: 'Overloaded Class',
            role: 'standard',
            uplinksPerLeaf: 4, // 24 - 4 = 20 ports available for endpoints
            count: 1, // Only 1 leaf
            endpointProfiles: [
              { name: 'High-Density Server', portsPerEndpoint: 1, count: 25 } // Need 25 ports but only have 20
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 56,
        usedPorts: 54,
        oversubscriptionRatio: 1.25,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const leafErrors = result.errors.filter(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
      expect(leafErrors).toHaveLength(1)
      expect(leafErrors[0].leafClassId).toBe('overloaded-class')
      expect(leafErrors[0].context?.actual).toBe(25) // Endpoint demand
      expect(leafErrors[0].context?.expected).toBe(20) // Available capacity
    })

    it('should detect leaf capacity exceeded in legacy mode', () => {
      const spec: FabricSpec = {
        name: 'legacy-overloaded',
        spineModelId: 'DS3000',
        leafModelId: 'DS1000', // 24 ports
        uplinksPerLeaf: 4, // 20 ports available
        endpointCount: 25, // Need 25 * 2 = 50 ports
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, // 2 leaves * 20 available = 40 ports, but need 50
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 66,
        oversubscriptionRatio: 1.25,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const leafErrors = result.errors.filter(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
      expect(leafErrors).toHaveLength(1)
      expect(leafErrors[0].context?.actual).toBe(50) // Endpoint demand
      expect(leafErrors[0].context?.expected).toBe(40) // Available capacity
    })
  })

  describe('UPLINKS_NOT_DIVISIBLE_BY_SPINES', () => {
    it('should warn when uplinks not divisible by spine count in multi-class', () => {
      const spec: FabricSpec = {
        name: 'uneven-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'uneven-class',
            name: 'Uneven Uplinks',
            role: 'standard',
            uplinksPerLeaf: 3, // Not divisible by 2 spines
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 100 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 5,
        spinesNeeded: 2, // 3 uplinks not divisible by 2 spines
        totalPorts: 304,
        usedPorts: 230,
        oversubscriptionRatio: 3.33,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].leafClassId).toBe('uneven-class')
      expect(warnings[0].context?.remainder).toBe(1) // 3 % 2 = 1
    })

    it('should not warn when uplinks are evenly divisible', () => {
      const spec: FabricSpec = {
        name: 'even-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4, // Divisible by 2 spines
        endpointCount: 100,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 5,
        spinesNeeded: 2,
        totalPorts: 304,
        usedPorts: 240,
        oversubscriptionRatio: 2.5,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warnings).toHaveLength(0)
    })

    it('should not warn with single spine', () => {
      const spec: FabricSpec = {
        name: 'single-spine',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 3, // Would be problematic with multiple spines
        endpointCount: 50,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 1, // Single spine - no divisibility concerns
        totalPorts: 176,
        usedPorts: 109,
        oversubscriptionRatio: 5.56,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warnings).toHaveLength(0)
    })
  })

  describe('MC_LAG_ODD_LEAFS', () => {
    it('should warn when MC-LAG enabled with odd leaf count', () => {
      const spec: FabricSpec = {
        name: 'mclag-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'mclag-class',
            name: 'MC-LAG Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            mcLag: true, // MC-LAG enabled
            count: 3, // Odd number!
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 60 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 1,
        totalPorts: 176,
        usedPorts: 126,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].leafClassId).toBe('mclag-class')
      expect(warnings[0].context?.leafCount).toBe(3)
      expect(warnings[0].context?.mcLagEnabled).toBe(true)
    })

    it('should warn when MC-LAG enabled with single leaf', () => {
      const spec: FabricSpec = {
        name: 'single-leaf-mclag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'single-mclag',
            name: 'Single MC-LAG',
            role: 'standard',
            uplinksPerLeaf: 2,
            mcLag: true,
            count: 1, // Single leaf - problematic for MC-LAG
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 20 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 42,
        oversubscriptionRatio: 20,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].context?.leafCount).toBe(1)
    })

    it('should not warn when MC-LAG disabled', () => {
      const spec: FabricSpec = {
        name: 'no-mclag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'regular-class',
            name: 'Regular Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            mcLag: false, // MC-LAG disabled
            count: 3, // Odd is fine when MC-LAG disabled
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 60 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 1,
        totalPorts: 176,
        usedPorts: 126,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warnings).toHaveLength(0)
    })

    it('should not warn when MC-LAG enabled with even leaf count', () => {
      const spec: FabricSpec = {
        name: 'even-mclag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'even-mclag',
            name: 'Even MC-LAG',
            role: 'standard',
            uplinksPerLeaf: 2,
            mcLag: true,
            count: 4, // Even number - perfect for MC-LAG pairs
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 80 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 4,
        spinesNeeded: 1,
        totalPorts: 224,
        usedPorts: 168,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warnings).toHaveLength(0)
    })
  })

  describe('ES_LAG_SINGLE_NIC', () => {
    it('should warn when ES-LAG enabled with single NIC in multi-class', () => {
      const spec: FabricSpec = {
        name: 'eslag-single-nic',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'eslag-class',
            name: 'ES-LAG Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [
              { 
                name: 'Single-NIC ES-LAG Server', 
                portsPerEndpoint: 2, 
                count: 20,
                esLag: true, // ES-LAG enabled
                nics: 1 // But only 1 NIC!
              }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 42,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'ES_LAG_SINGLE_NIC')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].leafClassId).toBe('eslag-class')
      expect(warnings[0].context?.nicCount).toBe(1)
      expect(warnings[0].context?.esLagEnabled).toBe(true)
    })

    it('should warn when ES-LAG enabled with default single NIC in legacy mode', () => {
      const spec: FabricSpec = {
        name: 'legacy-eslag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 20,
        endpointProfile: { 
          name: 'ES-LAG Server',
          portsPerEndpoint: 2,
          esLag: true
          // nics defaults to 1
        }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 42,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'ES_LAG_SINGLE_NIC')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].context?.nicCount).toBe(1)
    })

    it('should not warn when ES-LAG enabled with multiple NICs', () => {
      const spec: FabricSpec = {
        name: 'good-eslag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'good-eslag',
            name: 'Good ES-LAG Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [
              { 
                name: 'Multi-NIC ES-LAG Server', 
                portsPerEndpoint: 2, 
                count: 20,
                esLag: true,
                nics: 2 // Multiple NICs - good for ES-LAG
              }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 42,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'ES_LAG_SINGLE_NIC')
      expect(warnings).toHaveLength(0)
    })

    it('should not warn when ES-LAG disabled', () => {
      const spec: FabricSpec = {
        name: 'no-eslag',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 20,
        endpointProfile: { 
          name: 'Regular Server',
          portsPerEndpoint: 2,
          esLag: false, // ES-LAG disabled
          nics: 1 // Single NIC is fine when ES-LAG disabled
        }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 42,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'ES_LAG_SINGLE_NIC')
      expect(warnings).toHaveLength(0)
    })
  })

  describe('MODEL_PROFILE_MISMATCH', () => {
    it('should warn when spine model not optimized for uplinks', () => {
      const spec: FabricSpec = {
        name: 'mismatched-spine',
        spineModelId: 'DS1000', // Edge model used as spine
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 50,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 1,
        totalPorts: 168,
        usedPorts: 106,
        oversubscriptionRatio: 8.33,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MODEL_PROFILE_MISMATCH')
      expect(warnings.length).toBeGreaterThanOrEqual(1)
      const spineWarning = warnings.find(w => w.context?.role === 'spine')
      expect(spineWarning).toBeDefined()
      expect(spineWarning?.context?.modelId).toBe('DS1000')
    })

    it('should warn when leaf model not optimized for servers in multi-class', () => {
      const spec: FabricSpec = {
        name: 'mismatched-leaf',
        spineModelId: 'DS3000',
        leafModelId: 'DS4000', // Core model used as leaf
        leafClasses: [
          {
            id: 'server-class',
            name: 'Server Class',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 20, type: 'server' }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 96,
        usedPorts: 42,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MODEL_PROFILE_MISMATCH')
      expect(warnings.length).toBeGreaterThanOrEqual(1)
      const leafWarning = warnings.find(w => w.context?.role === 'leaf')
      expect(leafWarning).toBeDefined()
      expect(leafWarning?.leafClassId).toBe('server-class')
    })

    it('should not warn when models match their intended profiles', () => {
      const spec: FabricSpec = {
        name: 'well-matched',
        spineModelId: 'DS3000', // Good spine model
        leafModelId: 'DS2000',  // Good leaf model
        uplinksPerLeaf: 2,
        endpointCount: 50,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2, type: 'server' }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 1,
        totalPorts: 176,
        usedPorts: 106,
        oversubscriptionRatio: 8.33,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      const warnings = result.warnings.filter(w => w.code === 'MODEL_PROFILE_MISMATCH')
      expect(warnings).toHaveLength(0)
    })
  })

  describe('Integration Tests', () => {
    it('should handle multiple rule violations in one evaluation', () => {
      const spec: FabricSpec = {
        name: 'problem-fabric',
        spineModelId: 'DS1000', // Wrong spine model (MODEL_PROFILE_MISMATCH)
        leafModelId: 'DS1000',  // Small leaf model
        leafClasses: [
          {
            id: 'problem-class',
            name: 'Problematic Class',
            role: 'standard',
            uplinksPerLeaf: 3, // Odd uplinks (UPLINKS_NOT_DIVISIBLE_BY_SPINES)
            mcLag: true,       // MC-LAG enabled
            count: 3,          // Odd leaf count (MC_LAG_ODD_LEAFS)
            endpointProfiles: [
              { 
                name: 'Overloaded Server', 
                portsPerEndpoint: 2, 
                count: 50,       // Too many endpoints (LEAF_CAPACITY_EXCEEDED)
                esLag: true,     // ES-LAG enabled
                nics: 1          // Single NIC (ES_LAG_SINGLE_NIC)
              }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 2,
        totalPorts: 120,
        usedPorts: 109,
        oversubscriptionRatio: 5.56,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      // Should have multiple types of violations
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.warnings.length).toBeGreaterThan(0)
      
      const codes = [...result.errors, ...result.warnings].map(v => v.code)
      expect(codes).toContain('LEAF_CAPACITY_EXCEEDED')
      expect(codes).toContain('UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(codes).toContain('MC_LAG_ODD_LEAFS')
      expect(codes).toContain('ES_LAG_SINGLE_NIC')
      expect(codes).toContain('MODEL_PROFILE_MISMATCH')
    })

    it('should return empty results for valid fabric', () => {
      const spec: FabricSpec = {
        name: 'perfect-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 80,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2, type: 'server' }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 4,
        spinesNeeded: 1,
        totalPorts: 224,
        usedPorts: 168,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.info).toHaveLength(0)
    })
  })
})