/**
 * Snapshot tests for Fabric Validation Rules Engine - HNC v0.4.1
 * Canonical fabric specs → expected rule violation codes
 */

import { describe, it, expect } from 'vitest'
import { evaluate, type RuleEvaluationResult, type SwitchCatalog } from './rules'
import type { FabricSpec, DerivedTopology } from '../app.types'

// Test switch catalog with comprehensive models
const testCatalog: SwitchCatalog = {
  getSwitchModel: (modelId: string) => {
    const models: Record<string, { ports: number; type: 'leaf' | 'spine' }> = {
      'DS2000': { ports: 48, type: 'leaf' },
      'DS3000': { ports: 32, type: 'spine' },
      'DS1000': { ports: 24, type: 'leaf' },
      'DS4000': { ports: 64, type: 'spine' },
      'DS5000': { ports: 16, type: 'spine' }, // Edge spine for profile mismatch test
      'celestica-ds2000': { ports: 48, type: 'leaf' },
      'celestica-ds3000': { ports: 32, type: 'spine' }
    }
    return models[modelId] || null
  },
  getModelProfile: (modelId: string) => {
    const profiles: Record<string, { maxCapacity: number; recommended: string[] }> = {
      'DS2000': { maxCapacity: 1200, recommended: ['server', 'storage'] },
      'DS3000': { maxCapacity: 800, recommended: ['uplink', 'interconnect'] },
      'DS1000': { maxCapacity: 600, recommended: ['edge', 'access'] },
      'DS4000': { maxCapacity: 1600, recommended: ['core', 'uplink'] },
      'DS5000': { maxCapacity: 400, recommended: ['edge', 'access'] }, // No uplink recommendation
      'celestica-ds2000': { maxCapacity: 1200, recommended: ['server', 'storage'] },
      'celestica-ds3000': { maxCapacity: 800, recommended: ['uplink', 'interconnect'] }
    }
    return profiles[modelId] || null
  }
}

// Helper to extract rule codes for snapshot comparison
function extractRuleCodes(result: RuleEvaluationResult): {
  errorCodes: string[]
  warningCodes: string[]
  infoCodes: string[]
} {
  return {
    errorCodes: result.errors.map(e => e.code).sort(),
    warningCodes: result.warnings.map(w => w.code).sort(),
    infoCodes: result.info.map(i => i.code).sort()
  }
}

describe('Rules Snapshot Tests - Canonical Specs to Expected Issue Codes', () => {
  
  describe('SPINE_CAPACITY_EXCEEDED scenarios', () => {
    it('should detect spine capacity exceeded - overloaded multi-class fabric', () => {
      const spec: FabricSpec = {
        name: 'overloaded-fabric',
        spineModelId: 'DS3000', // 32 ports per spine
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'compute-heavy',
            name: 'Compute Heavy',
            role: 'standard',
            uplinksPerLeaf: 8, // High uplink demand
            count: 12, // 12 * 8 = 96 uplinks needed
            endpointProfiles: [
              { name: 'High-Density Server', portsPerEndpoint: 2, count: 20 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 12,
        spinesNeeded: 2, // Only 64 ports total (2 * 32), but need 96
        totalPorts: 640,
        usedPorts: 336,
        oversubscriptionRatio: 15,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('spine-capacity-exceeded-multi-class')
      expect(codes.errorCodes).toContain('SPINE_CAPACITY_EXCEEDED')
    })

    it('should detect spine capacity exceeded - legacy mode', () => {
      const spec: FabricSpec = {
        name: 'legacy-overloaded',
        spineModelId: 'DS3000', // 32 ports per spine
        leafModelId: 'DS2000',
        uplinksPerLeaf: 6,
        endpointCount: 100,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 8, // 8 * 6 = 48 uplinks needed
        spinesNeeded: 1, // Only 32 ports available
        totalPorts: 408,
        usedPorts: 248,
        oversubscriptionRatio: 8.33,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('spine-capacity-exceeded-legacy')
      expect(codes.errorCodes).toContain('SPINE_CAPACITY_EXCEEDED')
    })
  })

  describe('LEAF_CAPACITY_EXCEEDED scenarios', () => {
    it('should detect leaf capacity exceeded - small leaves high demand', () => {
      const spec: FabricSpec = {
        name: 'leaf-overloaded',
        spineModelId: 'DS3000',
        leafModelId: 'DS1000', // 24 ports total
        leafClasses: [
          {
            id: 'dense-servers',
            name: 'Dense Server Class',
            role: 'standard',
            uplinksPerLeaf: 4, // 24 - 4 = 20 ports for endpoints
            count: 1,
            endpointProfiles: [
              { name: 'Dense Server', portsPerEndpoint: 1, count: 25 } // Need 25, have 20
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 56,
        usedPorts: 29,
        oversubscriptionRatio: 6.25,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('leaf-capacity-exceeded-high-density')
      expect(codes.errorCodes).toContain('LEAF_CAPACITY_EXCEEDED')
    })
  })

  describe('UPLINKS_NOT_DIVISIBLE_BY_SPINES scenarios', () => {
    it('should detect uneven uplink distribution - 3 uplinks 2 spines', () => {
      const spec: FabricSpec = {
        name: 'uneven-uplinks',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'uneven-class',
            name: 'Uneven Uplinks',
            role: 'standard',
            uplinksPerLeaf: 3, // Not divisible by 2 spines
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 50 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 2,
        totalPorts: 208,
        usedPorts: 109,
        oversubscriptionRatio: 11.1,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('uplinks-not-divisible-warning')
      expect(codes.warningCodes).toContain('UPLINKS_NOT_DIVISIBLE_BY_SPINES')
    })

    it('should detect uneven uplink distribution - legacy mode 5 uplinks 2 spines', () => {
      const spec: FabricSpec = {
        name: 'legacy-uneven',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 5, // Not divisible by 2
        endpointCount: 80,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 4,
        spinesNeeded: 2,
        totalPorts: 256,
        usedPorts: 180,
        oversubscriptionRatio: 8,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('uplinks-not-divisible-legacy')
      expect(codes.warningCodes).toContain('UPLINKS_NOT_DIVISIBLE_BY_SPINES')
    })
  })

  describe('MC_LAG_ODD_LEAFS scenarios', () => {
    it('should detect MC-LAG with odd leaf count', () => {
      const spec: FabricSpec = {
        name: 'mclag-odd',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'mclag-odd-class',
            name: 'MC-LAG Odd',
            role: 'standard',
            uplinksPerLeaf: 2,
            mcLag: true, // MC-LAG enabled
            count: 5, // Odd number - problematic for MC-LAG
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 20 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 5,
        spinesNeeded: 1,
        totalPorts: 272,
        usedPorts: 210,
        oversubscriptionRatio: 20,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('mc-lag-odd-leafs')
      expect(codes.warningCodes).toContain('MC_LAG_ODD_LEAFS')
    })

    it('should detect MC-LAG with single leaf', () => {
      const spec: FabricSpec = {
        name: 'mclag-single',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'mclag-single-class',
            name: 'MC-LAG Single',
            role: 'standard',
            uplinksPerLeaf: 4,
            mcLag: true,
            count: 1, // Single leaf - invalid for MC-LAG
            endpointProfiles: [
              { name: 'Server', portsPerEndpoint: 2, count: 15 }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        totalPorts: 80,
        usedPorts: 34,
        oversubscriptionRatio: 7.5,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('mc-lag-single-leaf')
      expect(codes.warningCodes).toContain('MC_LAG_ODD_LEAFS')
    })
  })

  describe('ES_LAG_SINGLE_NIC scenarios', () => {
    it('should detect ES-LAG with single NIC in multi-class', () => {
      const spec: FabricSpec = {
        name: 'eslag-single-nic',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'eslag-class',
            name: 'ES-LAG Single NIC',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [
              { 
                name: 'Single-NIC ES-LAG Server',
                portsPerEndpoint: 2,
                count: 20,
                esLag: true, // ES-LAG enabled
                nics: 1 // Single NIC - suboptimal for ES-LAG
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
        oversubscriptionRatio: 20,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('es-lag-single-nic')
      expect(codes.warningCodes).toContain('ES_LAG_SINGLE_NIC')
    })

    it('should detect ES-LAG with default single NIC in legacy mode', () => {
      const spec: FabricSpec = {
        name: 'legacy-eslag-default-nic',
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
        oversubscriptionRatio: 20,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('es-lag-single-nic-legacy')
      expect(codes.warningCodes).toContain('ES_LAG_SINGLE_NIC')
    })
  })

  describe('MODEL_PROFILE_MISMATCH scenarios', () => {
    it('should detect spine model not optimized for uplinks', () => {
      const spec: FabricSpec = {
        name: 'mismatched-spine',
        spineModelId: 'DS5000', // Edge model used as spine (not recommended for uplinks)
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
        oversubscriptionRatio: 16.67,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('model-profile-mismatch-spine')
      expect(codes.warningCodes).toContain('MODEL_PROFILE_MISMATCH')
    })

    it('should detect leaf model not optimized for server connectivity', () => {
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
        oversubscriptionRatio: 20,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('model-profile-mismatch-leaf')
      expect(codes.warningCodes).toContain('MODEL_PROFILE_MISMATCH')
    })
  })

  describe('Multiple violations - complex scenarios', () => {
    it('should detect multiple rule violations in problematic fabric', () => {
      const spec: FabricSpec = {
        name: 'multi-problem-fabric',
        spineModelId: 'DS5000', // Edge model as spine (profile mismatch)
        leafModelId: 'DS1000',  // Small leaf model
        leafClasses: [
          {
            id: 'problem-class',
            name: 'Problematic Class',
            role: 'standard',
            uplinksPerLeaf: 3, // Odd uplinks
            mcLag: true,       // MC-LAG enabled
            count: 3,          // Odd leaf count
            endpointProfiles: [
              { 
                name: 'Overloaded ES-LAG Server',
                portsPerEndpoint: 2,
                count: 40,       // Too many endpoints for leaf capacity (40 * 2 = 80 > 63)
                esLag: true,     // ES-LAG enabled
                nics: 1,         // Single NIC
                type: 'server'
              }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,
        spinesNeeded: 2,
        totalPorts: 136,
        usedPorts: 113,
        oversubscriptionRatio: 8.33,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('multiple-violations-complex')
      
      // Should detect multiple issues
      expect(codes.errorCodes).toContain('LEAF_CAPACITY_EXCEEDED')
      expect(codes.warningCodes).toContain('UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(codes.warningCodes).toContain('MC_LAG_ODD_LEAFS')
      expect(codes.warningCodes).toContain('ES_LAG_SINGLE_NIC')
      expect(codes.warningCodes).toContain('MODEL_PROFILE_MISMATCH')
    })

    it('should return empty results for perfect fabric configuration', () => {
      const spec: FabricSpec = {
        name: 'perfect-fabric',
        spineModelId: 'DS3000', // Good spine model
        leafModelId: 'DS2000',  // Good leaf model
        leafClasses: [
          {
            id: 'optimal-class',
            name: 'Optimal Class',
            role: 'standard',
            uplinksPerLeaf: 4, // Even, divisible by 2 spines
            mcLag: false,      // MC-LAG disabled (no constraints)
            count: 4,          // Even count (would be good for MC-LAG if enabled)
            endpointProfiles: [
              { 
                name: 'Well-Configured Server',
                portsPerEndpoint: 2,
                count: 15,       // Reasonable endpoint count
                esLag: false,    // ES-LAG disabled (no constraints)
                nics: 2,         // Multiple NICs (would be good for ES-LAG if enabled)
                type: 'server'
              }
            ]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 4,
        spinesNeeded: 2,
        totalPorts: 256,
        usedPorts: 136,
        oversubscriptionRatio: 2.27,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('perfect-fabric-no-violations')
      
      // Perfect fabric should have no rule violations
      expect(codes.errorCodes).toHaveLength(0)
      expect(codes.warningCodes).toHaveLength(0)
      expect(codes.infoCodes).toHaveLength(0)
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('should handle missing switch models gracefully', () => {
      const spec: FabricSpec = {
        name: 'missing-models',
        spineModelId: 'UNKNOWN_SPINE', // Non-existent model
        leafModelId: 'UNKNOWN_LEAF',   // Non-existent model
        uplinksPerLeaf: 2,
        endpointCount: 20,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2,
        spinesNeeded: 1,
        totalPorts: 0,
        usedPorts: 0,
        oversubscriptionRatio: 0,
        isValid: false,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('missing-models-graceful')
      // Should not crash, might have empty or minimal violations
    })

    it('should handle single spine scenarios (no divisibility warnings)', () => {
      const spec: FabricSpec = {
        name: 'single-spine',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 3, // Would be problematic with multiple spines
        endpointCount: 30,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2,
        spinesNeeded: 1, // Single spine - no divisibility concerns
        totalPorts: 128,
        usedPorts: 66,
        oversubscriptionRatio: 10,
        isValid: true,
        validationErrors: [],
        guards: []
      }
      
      const result = evaluate(spec, derived, testCatalog)
      const codes = extractRuleCodes(result)
      
      expect(codes).toMatchSnapshot('single-spine-no-divisibility-warning')
      expect(codes.warningCodes).not.toContain('UPLINKS_NOT_DIVISIBLE_BY_SPINES')
    })
  })
})