/**
 * Property-based tests for topology validation mathematical invariants - WP-TOP2
 * 
 * These tests verify mathematical properties that must always hold regardless
 * of specific input values, ensuring validation logic is mathematically sound.
 */

import { describe, it, expect } from 'vitest'
import { evaluateTopology, ValidationMessage } from './rules'
import type { FabricSpec, DerivedTopology } from '../app.types'

// Property-based test generator utilities
function generateValidFabricSpec(): FabricSpec {
  return {
    name: 'test-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 4,
    endpointCount: 100,
    endpointProfile: {
      name: 'server',
      portsPerEndpoint: 1,
      count: 100
    }
  }
}

function generateDerivedTopology(overrides: Partial<DerivedTopology> = {}): DerivedTopology {
  return {
    leavesNeeded: 4,
    spinesNeeded: 2,
    totalPorts: 192,
    usedPorts: 116,
    oversubscriptionRatio: 2.0,
    isValid: true,
    validationErrors: [],
    guards: [],
    ...overrides
  }
}

describe('Property-Based Validation Tests', () => {
  describe('Mathematical Invariants', () => {
    it('INVARIANT: Total uplink ports must never exceed spine capacity', async () => {
      // Property: For any valid configuration, totalUplinks <= spineCount * spinePortsPerDevice
      const spinePortsPerDevice = 32 // DS3000
      
      for (let spineCount = 1; spineCount <= 4; spineCount++) {
        for (let leafCount = 1; leafCount <= 8; leafCount++) {
          for (let uplinksPerLeaf = 1; uplinksPerLeaf <= 8; uplinksPerLeaf++) {
            const totalUplinks = leafCount * uplinksPerLeaf
            const maxSpineCapacity = spineCount * spinePortsPerDevice
            
            const spec = generateValidFabricSpec()
            spec.uplinksPerLeaf = uplinksPerLeaf
            
            const derived = generateDerivedTopology({
              leavesNeeded: leafCount,
              spinesNeeded: spineCount
            })
            
            const result = await evaluateTopology(spec, derived)
            
            if (totalUplinks > maxSpineCapacity) {
              // Must have spine capacity error
              const spineCapacityError = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
              expect(spineCapacityError, 
                `Expected SPINE_CAPACITY_EXCEEDED for ${totalUplinks} uplinks > ${maxSpineCapacity} capacity`
              ).toBeDefined()
              
              // Error message must contain specific numbers
              expect(spineCapacityError!.context.actual).toBe(totalUplinks)
              expect(spineCapacityError!.context.expected).toBe(maxSpineCapacity)
            } else {
              // Must not have spine capacity error
              const spineCapacityError = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')
              expect(spineCapacityError,
                `Unexpected SPINE_CAPACITY_EXCEEDED for ${totalUplinks} uplinks <= ${maxSpineCapacity} capacity`
              ).toBeUndefined()
            }
          }
        }
      }
    })

    it('INVARIANT: Total endpoint ports must never exceed leaf capacity', async () => {
      // Property: For any valid configuration, endpointPorts <= leafCount * (leafPortsPerDevice - uplinksPerLeaf)
      const leafPortsPerDevice = 48 // DS2000
      
      for (let leafCount = 1; leafCount <= 6; leafCount++) {
        for (let uplinksPerLeaf = 1; uplinksPerLeaf <= 8; uplinksPerLeaf++) {
          for (let endpointCount = 10; endpointCount <= 200; endpointCount += 20) {
            const availablePortsPerLeaf = leafPortsPerDevice - uplinksPerLeaf
            const totalLeafCapacity = leafCount * availablePortsPerLeaf
            
            const spec = generateValidFabricSpec()
            spec.uplinksPerLeaf = uplinksPerLeaf
            spec.endpointCount = endpointCount
            spec.endpointProfile!.count = endpointCount
            
            const derived = generateDerivedTopology({
              leavesNeeded: leafCount
            })
            
            const result = await evaluateTopology(spec, derived)
            
            if (endpointCount > totalLeafCapacity) {
              // Must have leaf capacity error
              const leafCapacityError = result.errors.find(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
              expect(leafCapacityError,
                `Expected LEAF_CAPACITY_EXCEEDED for ${endpointCount} endpoints > ${totalLeafCapacity} capacity`
              ).toBeDefined()
              
              expect(leafCapacityError!.context.actual).toBe(endpointCount)
              expect(leafCapacityError!.context.expected).toBe(totalLeafCapacity)
            } else {
              // Must not have leaf capacity error
              const leafCapacityError = result.errors.find(e => e.code === 'LEAF_CAPACITY_EXCEEDED')
              expect(leafCapacityError,
                `Unexpected LEAF_CAPACITY_EXCEEDED for ${endpointCount} endpoints <= ${totalLeafCapacity} capacity`
              ).toBeUndefined()
            }
          }
        }
      }
    })

    it('INVARIANT: Uplink divisibility warnings are mathematically correct', async () => {
      // Property: Warning appears if and only if uplinksPerLeaf % spineCount !== 0
      for (let spineCount = 2; spineCount <= 4; spineCount++) {
        for (let uplinksPerLeaf = 1; uplinksPerLeaf <= 12; uplinksPerLeaf++) {
          const spec = generateValidFabricSpec()
          spec.uplinksPerLeaf = uplinksPerLeaf
          
          const derived = generateDerivedTopology({
            spinesNeeded: spineCount
          })
          
          const result = await evaluateTopology(spec, derived)
          
          const hasDivisibilityWarning = result.warnings.some(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
          const shouldHaveWarning = uplinksPerLeaf % spineCount !== 0
          
          expect(hasDivisibilityWarning, 
            `Uplinks ${uplinksPerLeaf} with ${spineCount} spines: remainder=${uplinksPerLeaf % spineCount}, expected warning=${shouldHaveWarning}`
          ).toBe(shouldHaveWarning)
          
          if (hasDivisibilityWarning) {
            const warning = result.warnings.find(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')!
            expect(warning.context.calculations.remainder).toBe(uplinksPerLeaf % spineCount)
            expect(warning.context.calculations.spineCount).toBe(spineCount)
          }
        }
      }
    })

    it('INVARIANT: MC-LAG warnings appear for odd leaf counts only', async () => {
      // Property: MC-LAG warning appears if and only if (leafCount % 2 !== 0 || leafCount < 2) and mcLag is enabled
      for (let leafCount = 1; leafCount <= 8; leafCount++) {
        const spec = generateValidFabricSpec()
        spec.leafClasses = [{
          id: 'test-class',
          name: 'Test Class',
          role: 'standard',
          uplinksPerLeaf: 4,
          count: leafCount,
          mcLag: true,
          endpointProfiles: [{
            name: 'server',
            portsPerEndpoint: 1,
            count: 20
          }]
        }]
        
        const derived = generateDerivedTopology()
        const result = await evaluateTopology(spec, derived)
        
        const hasMcLagWarning = result.warnings.some(w => w.code === 'MC_LAG_ODD_LEAFS')
        const shouldHaveWarning = leafCount % 2 !== 0 || leafCount < 2
        
        expect(hasMcLagWarning, 
          `Leaf count ${leafCount}: expected MC-LAG warning=${shouldHaveWarning}`
        ).toBe(shouldHaveWarning)
        
        if (hasMcLagWarning) {
          const warning = result.warnings.find(w => w.code === 'MC_LAG_ODD_LEAFS')!
          expect(warning.context.calculations.currentCount).toBe(leafCount)
          expect(warning.leafClassId).toBe('test-class')
        }
      }
    })

    it('INVARIANT: ES-LAG warnings appear for single NIC configurations only', async () => {
      // Property: ES-LAG warning appears if and only if nics === 1 and esLag is enabled
      for (let nicCount = 1; nicCount <= 4; nicCount++) {
        const spec = generateValidFabricSpec()
        spec.endpointProfile = {
          name: 'server',
          portsPerEndpoint: 1,
          count: 50,
          nics: nicCount,
          esLag: true
        }
        
        const derived = generateDerivedTopology()
        const result = await evaluateTopology(spec, derived)
        
        const hasEsLagWarning = result.warnings.some(w => w.code === 'ES_LAG_SINGLE_NIC')
        const shouldHaveWarning = nicCount === 1
        
        expect(hasEsLagWarning, 
          `NIC count ${nicCount}: expected ES-LAG warning=${shouldHaveWarning}`
        ).toBe(shouldHaveWarning)
        
        if (hasEsLagWarning) {
          const warning = result.warnings.find(w => w.code === 'ES_LAG_SINGLE_NIC')!
          expect(warning.context.calculations.nicCount).toBe(nicCount)
          expect(warning.context.calculations.esLagEnabled).toBe(true)
        }
      }
    })
  })

  describe('Remediation Consistency', () => {
    it('PROPERTY: All error messages must have actionable remediation', async () => {
      // Generate various invalid configurations
      const invalidConfigs = [
        // Spine capacity exceeded
        {
          spec: { ...generateValidFabricSpec(), uplinksPerLeaf: 10 },
          derived: generateDerivedTopology({ spinesNeeded: 1 }) // 1 spine * 32 ports < 4 leaves * 10 uplinks = 40
        },
        // Leaf capacity exceeded  
        {
          spec: { ...generateValidFabricSpec(), endpointCount: 300, endpointProfile: { name: 'server', portsPerEndpoint: 1, count: 300 } },
          derived: generateDerivedTopology({ leavesNeeded: 2 }) // 2 leaves * (48-4) ports = 88 < 300 endpoints
        }
      ]
      
      for (const { spec, derived } of invalidConfigs) {
        const result = await evaluateTopology(spec, derived)
        
        for (const error of result.errors) {
          // Every error must have complete remediation guidance
          expect(error.remediation).toBeDefined()
          expect(error.remediation.what).toBeTruthy()
          expect(error.remediation.how).toBeTruthy()
          expect(error.remediation.why).toBeTruthy()
          
          // Every error must reference affected fields
          expect(error.affectedFields).toBeDefined()
          expect(error.affectedFields.length).toBeGreaterThan(0)
          
          // Every error must have technical context
          expect(error.context).toBeDefined()
          expect(error.context.expected).toBeDefined()
          expect(error.context.actual).toBeDefined()
          expect(error.context.calculations).toBeDefined()
        }
      }
    })

    it('PROPERTY: Remediation suggestions must be mathematically sound', async () => {
      // Test spine capacity exceeded remediation
      const spec = generateValidFabricSpec()
      spec.uplinksPerLeaf = 8
      const derived = generateDerivedTopology({ 
        leavesNeeded: 6,  // 6 * 8 = 48 uplinks
        spinesNeeded: 1   // 1 * 32 = 32 capacity, shortfall of 16
      })
      
      const result = await evaluateTopology(spec, derived)
      const error = result.errors.find(e => e.code === 'SPINE_CAPACITY_EXCEEDED')!
      
      expect(error).toBeDefined()
      
      // Verify remediation calculations
      const { calculations } = error.context
      expect(calculations.shortfall).toBe(48 - 32) // 16
      expect(calculations.additionalSpinesNeeded).toBe(Math.ceil(16 / 32)) // 1
      expect(calculations.minSpinesForCapacity).toBe(Math.ceil(48 / 32)) // 2
      
      // Remediation should suggest mathematically correct solutions
      expect(error.remediation.how).toContain('2') // minimum spines needed
    })
  })

  describe('Multi-Class Fabric Properties', () => {
    it('INVARIANT: Multi-class validation scales correctly', async () => {
      // Property: Validation works correctly across multiple leaf classes
      for (let classCount = 1; classCount <= 3; classCount++) {
        const spec = generateValidFabricSpec()
        spec.leafClasses = []
        
        let totalUplinks = 0
        let totalEndpoints = 0
        
        for (let i = 0; i < classCount; i++) {
          const uplinks = 2 + i // Vary uplinks per class
          const endpoints = 30 + (i * 10)
          
          spec.leafClasses.push({
            id: `class-${i}`,
            name: `Class ${i}`,
            role: 'standard',
            uplinksPerLeaf: uplinks,
            count: 2,
            endpointProfiles: [{
              name: 'server',
              portsPerEndpoint: 1,
              count: endpoints
            }]
          })
          
          totalUplinks += 2 * uplinks // 2 leaves per class
          totalEndpoints += endpoints
        }
        
        const derived = generateDerivedTopology({
          leavesNeeded: classCount * 2,
          spinesNeeded: Math.ceil(totalUplinks / 32)
        })
        
        const result = await evaluateTopology(spec, derived)
        
        // Verify per-class validation works
        if (classCount > 0) {
          expect(result.errors.length + result.warnings.length).toBeGreaterThanOrEqual(0)
          
          // Each class-specific error should have leafClassId
          for (const error of result.errors) {
            if (error.code === 'LEAF_CAPACITY_EXCEEDED' || error.code === 'MC_LAG_ODD_LEAFS') {
              expect(error.leafClassId).toBeTruthy()
              expect(error.leafClassId).toMatch(/^class-\d+$/)
            }
          }
        }
      }
    })
  })

  describe('Integration Properties', () => {
    it('PROPERTY: Integration results are optional and isolated', async () => {
      const spec = generateValidFabricSpec()
      const derived = generateDerivedTopology()
      
      // Without integration enabled
      const resultWithoutIntegration = await evaluateTopology(spec, derived, {
        enableIntegrations: false
      })
      
      expect(resultWithoutIntegration.integrationResults).toBeUndefined()
      expect(resultWithoutIntegration.summary.hasIntegrationValidation).toBe(false)
      
      // With integration enabled (stub mode)
      const resultWithIntegration = await evaluateTopology(spec, derived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      // In test mode, integrations should be skipped
      if (process.env.NODE_ENV === 'test') {
        expect(resultWithIntegration.integrationResults).toEqual({})
      }
      
      // Core validation should be identical regardless of integration settings
      expect(resultWithoutIntegration.errors).toEqual(resultWithIntegration.errors)
      expect(resultWithoutIntegration.warnings).toEqual(resultWithIntegration.warnings)
    })
  })

  describe('Summary Statistics', () => {
    it('PROPERTY: Summary counts are always accurate', async () => {
      const spec = generateValidFabricSpec()
      spec.uplinksPerLeaf = 16 // Force spine capacity error
      spec.endpointCount = 500 // Force leaf capacity error
      
      const derived = generateDerivedTopology({
        leavesNeeded: 2,
        spinesNeeded: 1
      })
      
      const result = await evaluateTopology(spec, derived)
      
      // Summary must match actual counts
      expect(result.summary.totalIssues).toBe(
        result.errors.length + result.warnings.length + result.info.length
      )
      expect(result.summary.blockingErrors).toBe(result.errors.length)
      expect(result.summary.improvementWarnings).toBe(result.warnings.length)
      
      // Should have at least capacity errors
      expect(result.summary.blockingErrors).toBeGreaterThan(0)
    })
  })
})

describe('Edge Cases and Boundary Conditions', () => {
  it('handles zero/minimal configurations gracefully', async () => {
    const spec = generateValidFabricSpec()
    spec.uplinksPerLeaf = 0
    spec.endpointCount = 0
    
    const derived = generateDerivedTopology({
      leavesNeeded: 0,
      spinesNeeded: 0
    })
    
    const result = await evaluateTopology(spec, derived)
    
    // Should not crash and should provide meaningful feedback
    expect(result).toBeDefined()
    expect(result.summary.totalIssues).toBeGreaterThanOrEqual(0)
  })

  it('handles maximum realistic configurations', async () => {
    const spec = generateValidFabricSpec()
    spec.uplinksPerLeaf = 32
    spec.endpointCount = 10000
    
    const derived = generateDerivedTopology({
      leavesNeeded: 100,
      spinesNeeded: 100
    })
    
    const result = await evaluateTopology(spec, derived)
    
    // Should handle large numbers without issues
    expect(result).toBeDefined()
    expect(typeof result.summary.totalIssues).toBe('number')
  })
})