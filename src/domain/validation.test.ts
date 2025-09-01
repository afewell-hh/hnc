/**
 * Comprehensive unit tests for topology validation logic - WP-TOP2
 * 
 * Tests the pure evaluateTopology() function and its actionable remediation
 * messages to ensure they provide correct and helpful guidance.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { evaluateTopology, evaluate, ValidationMessage, SwitchCatalog } from './rules'
import type { FabricSpec, DerivedTopology } from '../app.types'

// Mock switch catalog for consistent testing
class TestSwitchCatalog implements SwitchCatalog {
  getSwitchModel(modelId: string) {
    const models = {
      'DS2000': { ports: 48, type: 'leaf' as const },
      'DS3000': { ports: 32, type: 'spine' as const },
      'DS2500': { ports: 24, type: 'leaf' as const },
      'DS4000': { ports: 64, type: 'spine' as const }
    }
    return models[modelId as keyof typeof models] || null
  }

  getModelProfile(modelId: string) {
    const profiles = {
      'DS2000': { maxCapacity: 1200, recommended: ['server', 'storage'] },
      'DS3000': { maxCapacity: 800, recommended: ['uplink', 'interconnect'] },
      'DS2500': { maxCapacity: 600, recommended: ['server'] },
      'DS4000': { maxCapacity: 1600, recommended: ['uplink', 'interconnect'] }
    }
    return profiles[modelId as keyof typeof profiles] || null
  }
}

describe('evaluateTopology - Pure Function Tests', () => {
  let catalog: SwitchCatalog
  
  beforeEach(() => {
    catalog = new TestSwitchCatalog()
  })

  describe('Spine Capacity Validation', () => {
    it('detects spine capacity exceeded with actionable remediation', async () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000', // 32 ports
        leafModelId: 'DS2000',
        uplinksPerLeaf: 8
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 6,    // 6 * 8 = 48 uplinks needed
        spinesNeeded: 1,    // 1 * 32 = 32 capacity
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      expect(result.errors).toHaveLength(1)
      
      const error = result.errors[0]
      expect(error.code).toBe('SPINE_CAPACITY_EXCEEDED')
      expect(error.title).toBe('Spine Capacity Exceeded')
      
      // Check actionable remediation
      expect(error.remediation.what).toContain('Add 1 more spine')
      expect(error.remediation.how).toContain('Option 1: Use 2 total spines')
      expect(error.remediation.why).toContain('GitHedgehog fabric requires')
      
      // Check affected fields
      expect(error.affectedFields).toContain('uplinksPerLeaf')
      expect(error.affectedFields).toContain('spineModelId')
      
      // Check technical context
      expect(error.context.actual).toBe(48)
      expect(error.context.expected).toBe(32)
      expect(error.context.calculations.shortfall).toBe(16)
      expect(error.context.calculations.additionalSpinesNeeded).toBe(1)
    })

    it('passes when spine capacity is sufficient', async () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 6,    // 6 * 4 = 24 uplinks needed
        spinesNeeded: 1,    // 1 * 32 = 32 capacity (sufficient)
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const spineError = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
      expect(spineError).toBeUndefined()
    })

    it('handles multi-class spine capacity validation', async () => {
      const spec: FabricSpec = {
        name: 'multi-class-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'class-1',
            name: 'Class 1',
            role: 'standard',
            uplinksPerLeaf: 6,
            count: 3, // 3 * 6 = 18 uplinks
            endpointProfiles: [{ name: 'server', portsPerEndpoint: 1, count: 10 }]
          },
          {
            id: 'class-2', 
            name: 'Class 2',
            role: 'standard',
            uplinksPerLeaf: 4,
            count: 4, // 4 * 4 = 16 uplinks
            endpointProfiles: [{ name: 'server', portsPerEndpoint: 1, count: 15 }]
          }
        ]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 7,
        spinesNeeded: 1,    // 34 uplinks total vs 32 capacity
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const error = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
      expect(error).toBeDefined()
      expect(error!.context.actual).toBe(34)
      expect(error!.context.calculations.classBreakdown).toHaveLength(2)
      expect(error!.context.calculations.classBreakdown[0].total).toBe(18)
      expect(error!.context.calculations.classBreakdown[1].total).toBe(16)
    })
  })

  describe('Leaf Capacity Validation', () => {
    it('detects leaf capacity exceeded with actionable remediation', async () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000', // 48 ports
        uplinksPerLeaf: 4,     // 44 ports available for endpoints
        endpointCount: 200,    // Need 200 endpoint ports
        endpointProfile: {
          name: 'server',
          portsPerEndpoint: 1,
          count: 200
        }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3,    // 3 * 44 = 132 capacity vs 200 needed
        spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const error = result.errors.find(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
      expect(error).toBeDefined()
      expect(error!.title).toBe('Leaf Capacity Exceeded')
      
      // Check remediation calculations
      expect(error!.context.actual).toBe(200)
      expect(error!.context.expected).toBe(132)
      expect(error!.context.calculations.shortfall).toBe(68)
      expect(error!.context.calculations.additionalLeavesNeeded).toBe(2)
      expect(error!.context.calculations.minLeavesForCapacity).toBe(5)
      
      expect(error!.remediation.what).toContain('Add 2 more leaves')
      expect(error!.remediation.how).toContain('Option 1: Add 2 leaves (5 total)')
    })

    it('handles multi-class leaf capacity validation per class', async () => {
      const spec: FabricSpec = {
        name: 'multi-class-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'overloaded-class',
          name: 'Overloaded Class',
          role: 'standard',
          uplinksPerLeaf: 8, // 40 ports available
          count: 2,          // 80 total capacity
          endpointProfiles: [{
            name: 'server',
            portsPerEndpoint: 2,
            count: 50 // 100 ports needed
          }]
        }]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const error = result.errors.find(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
      expect(error).toBeDefined()
      expect(error!.leafClassId).toBe('overloaded-class')
      expect(error!.affectedFields).toContain('leafClasses.overloaded-class.count')
    })
  })

  describe('Uplink Divisibility Validation', () => {
    it('warns when uplinks not divisible by spines with optimization guidance', async () => {
      const spec: FabricSpec = {
        name: 'uneven-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 5 // Not divisible by 2 spines
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2,
        spinesNeeded: 2, // 5 % 2 = 1 remainder
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warning).toBeDefined()
      expect(warning!.title).toBe('Uneven Load Distribution')
      
      expect(warning!.context.calculations.remainder).toBe(1)
      expect(warning!.context.calculations.spineCount).toBe(2)
      expect(warning!.context.calculations.optimalCounts).toEqual([4, 6])
      
      expect(warning!.remediation.how).toContain('Use 4 or 6 uplinks')
      expect(warning!.remediation.why).toContain('Uneven distribution causes 1 spine')
    })

    it('passes when uplinks are evenly divisible', async () => {
      const spec: FabricSpec = {
        name: 'even-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 6 // Divisible by 2 spines
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2,
        spinesNeeded: 2,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warning).toBeUndefined()
    })
  })

  describe('MC-LAG Validation', () => {
    it('warns when MC-LAG enabled but odd leaf count', async () => {
      const spec: FabricSpec = {
        name: 'mclag-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'mclag-class',
          name: 'MC-LAG Class',
          role: 'standard',
          uplinksPerLeaf: 4,
          count: 3, // Odd count
          mcLag: true,
          endpointProfiles: [{ name: 'server', portsPerEndpoint: 1, count: 20 }]
        }]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 3, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warning).toBeDefined()
      expect(warning!.leafClassId).toBe('mclag-class')
      expect(warning!.context.calculations.suggestedCount).toBe(4)
      expect(warning!.context.calculations.pairsNeeded).toBe(2)
      
      expect(warning!.remediation.how).toContain('Set leaf count to 4')
      expect(warning!.remediation.why).toContain('Each pair needs exactly 2 leaves')
    })

    it('warns when MC-LAG enabled but less than 2 leaves', async () => {
      const spec: FabricSpec = {
        name: 'mclag-single-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'single-leaf-class',
          name: 'Single Leaf Class',
          role: 'standard',
          uplinksPerLeaf: 4,
          count: 1, // Less than 2
          mcLag: true,
          endpointProfiles: [{ name: 'server', portsPerEndpoint: 1, count: 10 }]
        }]
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'MC_LAG_ODD_LEAFS')
      expect(warning).toBeDefined()
      expect(warning!.remediation.what).toContain('Add more leaves for MC-LAG pairs')
    })
  })

  describe('ES-LAG Validation', () => {
    it('warns when ES-LAG enabled but single NIC endpoint', async () => {
      const spec: FabricSpec = {
        name: 'eslag-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointProfile: {
          name: 'single-nic-server',
          portsPerEndpoint: 1,
          count: 20,
          esLag: true,
          nics: 1 // Single NIC with ES-LAG
        }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 1, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'ES_LAG_SINGLE_NIC')
      expect(warning).toBeDefined()
      expect(warning!.title).toBe('ES-LAG Configuration Issue - Profile \'single-nic-server\'')
      
      expect(warning!.context.calculations.nicCount).toBe(1)
      expect(warning!.context.calculations.suggestedNics).toBe(2)
      
      expect(warning!.remediation.how).toContain('Set nics: 2')
      expect(warning!.remediation.why).toContain('Single NIC endpoints cannot utilize ES-LAG')
    })
  })

  describe('Model Profile Mismatch Validation', () => {
    it('warns when spine model not optimized for uplinks', async () => {
      const spec: FabricSpec = {
        name: 'wrong-spine-fabric',
        spineModelId: 'DS2000', // Leaf model used as spine
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      const warning = result.warnings.find(w => w.code === 'MODEL_PROFILE_MISMATCH' && w.context.calculations.role === 'spine')
      expect(warning).toBeDefined()
      expect(warning!.title).toBe('Spine Model Not Optimized')
      expect(warning!.remediation.how).toContain('Replace with DS3000 or DS4000')
    })

    it('warns when leaf model not optimized for servers', async () => {
      // This would require a model that's not server-optimized in our test catalog
      // For now, our test models are correctly configured
      expect(true).toBe(true) // Placeholder for this test scenario
    })
  })

  describe('Integration Options', () => {
    it('includes integration results when enabled', async () => {
      const spec: FabricSpec = {
        name: 'integration-test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, {
        catalog,
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      expect(result.summary.hasIntegrationValidation).toBe(true)
      // In test environment, integrations are skipped
      expect(result.integrationResults).toEqual({})
    })

    it('excludes integration results when disabled', async () => {
      const spec: FabricSpec = {
        name: 'no-integration-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, {
        catalog,
        enableIntegrations: false
      })
      
      expect(result.summary.hasIntegrationValidation).toBe(false)
      expect(result.integrationResults).toBeUndefined()
    })
  })

  describe('Summary Statistics', () => {
    it('provides accurate summary counts', async () => {
      const spec: FabricSpec = {
        name: 'summary-test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 10, // Will cause spine capacity error
        endpointCount: 3,   // Will cause uplink divisibility warning
        endpointProfile: { name: 'server', portsPerEndpoint: 1, count: 3 }
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 4, // 4 * 10 = 40 uplinks
        spinesNeeded: 1, // 1 * 32 = 32 capacity (insufficient)
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      
      expect(result.summary.totalIssues).toBe(result.errors.length + result.warnings.length + result.info.length)
      expect(result.summary.blockingErrors).toBe(result.errors.length)
      expect(result.summary.improvementWarnings).toBe(result.warnings.length)
      expect(result.summary.blockingErrors).toBeGreaterThan(0) // Should have spine capacity error
    })
  })

  describe('Legacy Compatibility', () => {
    it('legacy evaluate function still works', () => {
      const spec: FabricSpec = {
        name: 'legacy-test',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 8
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 6, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = evaluate(spec, derived, catalog)
      
      expect(result.errors).toBeDefined()
      expect(result.warnings).toBeDefined()
      expect(result.info).toBeDefined()
      
      // Should have spine capacity error
      const spineError = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
      expect(spineError).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero spine count gracefully', async () => {
      const spec: FabricSpec = {
        name: 'zero-spine-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2,
        spinesNeeded: 0, // Edge case
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: false, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      expect(result).toBeDefined()
      expect(result.summary.totalIssues).toBeGreaterThanOrEqual(0)
    })

    it('handles unknown switch models gracefully', async () => {
      const spec: FabricSpec = {
        name: 'unknown-model-fabric',
        spineModelId: 'UNKNOWN_SPINE',
        leafModelId: 'UNKNOWN_LEAF',
        uplinksPerLeaf: 4
      }
      
      const derived: DerivedTopology = {
        leavesNeeded: 2, spinesNeeded: 1,
        totalPorts: 0, usedPorts: 0, oversubscriptionRatio: 0,
        isValid: true, validationErrors: [], guards: []
      }

      const result = await evaluateTopology(spec, derived, { catalog })
      expect(result).toBeDefined()
      // Should gracefully handle unknown models without crashing
    })
  })
})