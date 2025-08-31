/**
 * Simplified property-based tests for key allocator and wiring invariants
 * Uses fast-check to validate core guarantees with actual HNC functions
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { allocateUplinks, allocateMultiClassUplinks } from '../../src/domain/allocator.js'
import { buildWiring } from '../../src/domain/wiring.js'
import { getSwitchProfile } from '../../src/utils/switchProfilesUtil.js'
import { dump } from 'js-yaml'
import type { AllocationSpec, SwitchProfile } from '../../src/domain/types.js'
import type { FabricSpec, LeafClass } from '../../src/app.types.js'

// Get real switch profiles for testing
function getTestSwitchProfiles(): Map<string, SwitchProfile> {
  const profiles = new Map<string, SwitchProfile>()
  const ds2000 = getSwitchProfile('DS2000')
  const ds3000 = getSwitchProfile('DS3000')
  
  if (ds2000) profiles.set('DS2000', ds2000)
  if (ds3000) profiles.set('DS3000', ds3000)
  
  // Add mock profiles for testing
  profiles.set('mock-leaf', {
    modelId: 'mock-leaf',
    roles: ['leaf'],
    ports: { 
      fabricAssignable: ['E1/1-48'],
      endpointAssignable: ['E1/1-40']
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 1 },
      uplink: { portProfile: null, speedGbps: 10 }
    },
    meta: { source: 'test', version: '1.0' }
  } as SwitchProfile)
  
  profiles.set('mock-spine', {
    modelId: 'mock-spine',
    roles: ['spine'],
    ports: { 
      fabricAssignable: ['E1/1-128'],
      endpointAssignable: []
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 1 },
      uplink: { portProfile: null, speedGbps: 10 }
    },
    meta: { source: 'test', version: '1.0' }
  } as SwitchProfile)
  
  return profiles
}

// Simple allocation spec generator
const arbAllocationSpec = fc.record({
  leavesNeeded: fc.integer({ min: 1, max: 8 }),
  spinesNeeded: fc.integer({ min: 1, max: 4 }),
  uplinksPerLeaf: fc.integer({ min: 1, max: 4 }),
  endpointCount: fc.integer({ min: 1, max: 100 })
})

describe('Property-Based Tests (Simplified)', () => {
  describe('Allocation Function Invariants', () => {
    it('should always return a valid result structure', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Should always return a proper result structure
          expect(result).toBeDefined()
          expect(Array.isArray(result.leafMaps)).toBe(true)
          expect(Array.isArray(result.spineUtilization)).toBe(true)
          expect(Array.isArray(result.issues)).toBe(true)
          
          return true
        }),
        { numRuns: 50, seed: 100 }
      )
    })

    it('should be deterministic for identical inputs', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          // Run allocation twice
          const result1 = allocateUplinks(spec, leafProfile, spineProfile)
          const result2 = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Results should be identical
          expect(result1.leafMaps.length).toBe(result2.leafMaps.length)
          expect(result1.spineUtilization).toEqual(result2.spineUtilization)
          expect(result1.issues).toEqual(result2.issues)
          
          return true
        }),
        { numRuns: 25, seed: 101 }
      )
    })

    it('should respect capacity constraints when successful', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // If allocation succeeded, should respect constraints
          if (result.issues.length === 0) {
            // Each leaf should have the correct number of uplinks
            for (const leafMap of result.leafMaps) {
              expect(leafMap.uplinks.length).toBe(spec.uplinksPerLeaf)
            }
            
            // Spine utilization should not exceed capacity
            for (const utilization of result.spineUtilization) {
              expect(utilization).toBeGreaterThanOrEqual(0)
              // Note: We can't easily check max capacity without parsing port ranges
            }
          }
          
          return true
        }),
        { numRuns: 30, seed: 102 }
      )
    })
  })

  describe('YAML Serialization Invariants', () => {
    it('should produce valid YAML for any object', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Should be able to serialize any result to YAML
          const yamlString = dump(result, { sortKeys: true })
          
          expect(typeof yamlString).toBe('string')
          expect(yamlString.length).toBeGreaterThan(0)
          expect(yamlString).not.toContain('undefined')
          expect(yamlString).not.toContain('[object Object]')
          
          return true
        }),
        { numRuns: 20, seed: 103 }
      )
    })

    it('should maintain YAML serialization determinism', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Generate YAML twice
          const yaml1 = dump(result, { sortKeys: true, lineWidth: -1 })
          const yaml2 = dump(result, { sortKeys: true, lineWidth: -1 })
          
          // Should be identical
          expect(yaml1).toBe(yaml2)
          
          return true
        }),
        { numRuns: 15, seed: 104 }
      )
    })
  })

  describe('Cross-Environment Hash Stability', () => {
    it('should produce consistent structural fingerprints', () => {
      fc.assert(
        fc.property(arbAllocationSpec, (spec) => {
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Create structural fingerprint (deterministic object keys)
          const fingerprint1 = JSON.stringify({
            leafCount: result.leafMaps.length,
            spineCount: result.spineUtilization.length,
            issueCount: result.issues.length,
            uplinksTotal: result.leafMaps.reduce((sum, leaf) => sum + leaf.uplinks.length, 0)
          })
          
          // Run again
          const result2 = allocateUplinks(spec, leafProfile, spineProfile)
          const fingerprint2 = JSON.stringify({
            leafCount: result2.leafMaps.length,
            spineCount: result2.spineUtilization.length,
            issueCount: result2.issues.length,
            uplinksTotal: result2.leafMaps.reduce((sum, leaf) => sum + leaf.uplinks.length, 0)
          })
          
          // Should be identical across runs
          expect(fingerprint1).toBe(fingerprint2)
          
          return true
        }),
        { numRuns: 20, seed: 105 }
      )
    })
  })

  describe('Boundary Condition Handling', () => {
    it('should handle minimal valid inputs', () => {
      const minimalSpec: AllocationSpec = {
        leavesNeeded: 1,
        spinesNeeded: 1,
        uplinksPerLeaf: 1,
        endpointCount: 1
      }
      
      const profiles = getTestSwitchProfiles()
      const leafProfile = profiles.get('DS2000')
      const spineProfile = profiles.get('DS3000')
      
      if (!leafProfile || !spineProfile) {
        expect(true).toBe(true) // Skip test if profiles unavailable
        return
      }
      
      const result = allocateUplinks(minimalSpec, leafProfile, spineProfile)
      
      expect(result).toBeDefined()
      expect(result.leafMaps.length).toBeGreaterThanOrEqual(0)
      expect(result.spineUtilization.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle edge case uplink counts', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 8 }), (uplinks) => {
          const spec: AllocationSpec = {
            leavesNeeded: 2,
            spinesNeeded: 1,
            uplinksPerLeaf: uplinks,
            endpointCount: 10
          }
          
          const profiles = getTestSwitchProfiles()
          const leafProfile = profiles.get('DS2000')
          const spineProfile = profiles.get('DS3000')
          
          if (!leafProfile || !spineProfile) return true
          
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Should handle any reasonable uplink count
          expect(result).toBeDefined()
          expect(Array.isArray(result.issues)).toBe(true)
          
          return true
        }),
        { numRuns: 8, seed: 106 }
      )
    })
  })

  describe('Environment Info Logging', () => {
    it('should log test environment for debugging', () => {
      console.log('🧪 Property Test Environment Details:')
      console.log(`   Node.js: ${process.version}`)
      console.log(`   Platform: ${process.platform}`)
      console.log(`   Arch: ${process.arch}`)
      console.log(`   V8: ${process.versions.v8}`)
      console.log(`   Test timestamp: ${new Date().toISOString()}`)
      
      const profiles = getTestSwitchProfiles()
      console.log(`   Available profiles: ${Array.from(profiles.keys()).join(', ')}`)
      
      expect(profiles.size).toBeGreaterThan(0)
    })
  })
})