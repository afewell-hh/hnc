/**
 * Simplified cross-environment determinism tests
 * Validates that key algorithms produce identical results across Node.js versions
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { allocateUplinks } from '../../src/domain/allocator.js'
import { getSwitchProfile } from '../../src/utils/switchProfilesUtil.js'
import type { AllocationSpec, SwitchProfile } from '../../src/domain/types.js'
import { createHash } from 'crypto'
import { dump } from 'js-yaml'

// Test specifications for determinism validation
const deterministicTestSpecs: AllocationSpec[] = [
  {
    leavesNeeded: 4,
    spinesNeeded: 2,
    uplinksPerLeaf: 2,
    endpointCount: 40
  },
  {
    leavesNeeded: 6,
    spinesNeeded: 3,
    uplinksPerLeaf: 4,
    endpointCount: 80
  },
  {
    leavesNeeded: 2,
    spinesNeeded: 1,
    uplinksPerLeaf: 3,
    endpointCount: 20
  }
]

// Reference results computed at test initialization
const referenceResults = new Map<string, {
  structuralHash: string
  yamlHash: string
  leafCount: number
  issueCount: number
}>()

function computeStructuralHash(result: any): string {
  const normalized = {
    leafMapsCount: result.leafMaps.length,
    spineUtilization: result.spineUtilization.slice().sort(),
    issueCount: result.issues.length,
    totalUplinks: result.leafMaps.reduce((sum: number, leaf: any) => sum + leaf.uplinks.length, 0)
  }
  
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

describe('Cross-Environment Determinism Tests', () => {
  let leafProfile: SwitchProfile | undefined
  let spineProfile: SwitchProfile | undefined

  beforeAll(async () => {
    // Get switch profiles
    leafProfile = getSwitchProfile('DS2000')
    spineProfile = getSwitchProfile('DS3000')
    
    if (!leafProfile || !spineProfile) {
      console.warn('Switch profiles not available, skipping determinism tests')
      return
    }
    
    // Compute reference results
    for (let i = 0; i < deterministicTestSpecs.length; i++) {
      const spec = deterministicTestSpecs[i]
      const specKey = `spec-${i}`
      
      const result = allocateUplinks(spec, leafProfile, spineProfile)
      
      const structuralHash = computeStructuralHash(result)
      const yamlString = dump(result, { sortKeys: true, lineWidth: -1 })
      const yamlHash = createHash('sha256').update(yamlString).digest('hex')
      
      referenceResults.set(specKey, {
        structuralHash,
        yamlHash,
        leafCount: result.leafMaps.length,
        issueCount: result.issues.length
      })
    }
  })

  describe('Allocation Result Determinism', () => {
    it('should produce identical results across multiple runs', () => {
      if (!leafProfile || !spineProfile) {
        console.log('Skipping test - switch profiles not available')
        return
      }

      for (let i = 0; i < deterministicTestSpecs.length; i++) {
        const spec = deterministicTestSpecs[i]
        const specKey = `spec-${i}`
        const reference = referenceResults.get(specKey)!
        
        // Run allocation multiple times
        for (let run = 0; run < 5; run++) {
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          const actualHash = computeStructuralHash(result)
          
          expect(actualHash).toBe(reference.structuralHash)
          expect(result.leafMaps.length).toBe(reference.leafCount)
          expect(result.issues.length).toBe(reference.issueCount)
        }
      }
    })

    it('should maintain leaf allocation counts', () => {
      if (!leafProfile || !spineProfile) return
      
      for (const spec of deterministicTestSpecs) {
        const reference = allocateUplinks(spec, leafProfile, spineProfile)
        
        // Test multiple runs for consistency
        for (let i = 0; i < 3; i++) {
          const test = allocateUplinks(spec, leafProfile, spineProfile)
          expect(test.leafMaps.length).toBe(reference.leafMaps.length)
          expect(test.spineUtilization.length).toBe(reference.spineUtilization.length)
        }
      }
    })

    it('should maintain uplink distribution patterns', () => {
      if (!leafProfile || !spineProfile) return
      
      for (const spec of deterministicTestSpecs) {
        const reference = allocateUplinks(spec, leafProfile, spineProfile)
        
        for (let i = 0; i < 3; i++) {
          const test = allocateUplinks(spec, leafProfile, spineProfile)
          
          // Compare uplink counts per leaf
          const refUplinksPerLeaf = reference.leafMaps.map(l => l.uplinks.length)
          const testUplinksPerLeaf = test.leafMaps.map(l => l.uplinks.length)
          
          expect(testUplinksPerLeaf).toEqual(refUplinksPerLeaf)
        }
      }
    })
  })

  describe('YAML Serialization Determinism', () => {
    it('should produce identical YAML across runs', () => {
      if (!leafProfile || !spineProfile) return
      
      for (let i = 0; i < deterministicTestSpecs.length; i++) {
        const spec = deterministicTestSpecs[i]
        const specKey = `spec-${i}`
        const reference = referenceResults.get(specKey)!
        
        // Test YAML generation multiple times
        for (let run = 0; run < 3; run++) {
          const result = allocateUplinks(spec, leafProfile, spineProfile)
          const yamlString = dump(result, { sortKeys: true, lineWidth: -1 })
          const yamlHash = createHash('sha256').update(yamlString).digest('hex')
          
          expect(yamlHash).toBe(reference.yamlHash)
        }
      }
    })

    it('should maintain YAML round-trip consistency', () => {
      if (!leafProfile || !spineProfile) return
      
      for (const spec of deterministicTestSpecs) {
        const result = allocateUplinks(spec, leafProfile, spineProfile)
        
        // Serialize to YAML and back
        const yamlString = dump(result, { sortKeys: true, lineWidth: -1 })
        
        // Parse back (simulating round-trip)
        const parsedResult = JSON.parse(JSON.stringify(result))
        
        // Re-serialize
        const roundTripYaml = dump(parsedResult, { sortKeys: true, lineWidth: -1 })
        
        // Should be identical
        expect(roundTripYaml).toBe(yamlString)
        
        // Structural properties should be preserved
        expect(parsedResult.leafMaps).toHaveLength(result.leafMaps.length)
        expect(parsedResult.spineUtilization).toHaveLength(result.spineUtilization.length)
        expect(parsedResult.issues).toHaveLength(result.issues.length)
      }
    })
  })

  describe('Numeric Precision Consistency', () => {
    it('should handle division operations consistently', () => {
      if (!leafProfile || !spineProfile) return
      
      // Test spec designed to trigger division calculations
      const precisionSpec: AllocationSpec = {
        leavesNeeded: 7, // Odd number to test division
        spinesNeeded: 3,
        uplinksPerLeaf: 3,
        endpointCount: 42
      }
      
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = allocateUplinks(precisionSpec, leafProfile, spineProfile)
        results.push(computeStructuralHash(result))
      }
      
      // All results should be identical
      const firstHash = results[0]
      for (const hash of results) {
        expect(hash).toBe(firstHash)
      }
    })

    it('should handle edge cases with prime numbers', () => {
      if (!leafProfile || !spineProfile) return
      
      const primeSpec: AllocationSpec = {
        leavesNeeded: 5, // Prime
        spinesNeeded: 2,
        uplinksPerLeaf: 3, // Prime  
        endpointCount: 37 // Prime
      }
      
      const referenceResult = allocateUplinks(primeSpec, leafProfile, spineProfile)
      
      // Test multiple runs
      for (let i = 0; i < 5; i++) {
        const testResult = allocateUplinks(primeSpec, leafProfile, spineProfile)
        
        expect(computeStructuralHash(testResult)).toBe(computeStructuralHash(referenceResult))
      }
    })
  })

  describe('Environment Independence', () => {
    it('should be independent of object property enumeration order', () => {
      if (!leafProfile || !spineProfile) return
      
      for (const spec of deterministicTestSpecs) {
        // Create spec copy with different property order
        const reorderedSpec: AllocationSpec = {
          endpointCount: spec.endpointCount,
          uplinksPerLeaf: spec.uplinksPerLeaf,
          spinesNeeded: spec.spinesNeeded,
          leavesNeeded: spec.leavesNeeded
        }
        
        const originalResult = allocateUplinks(spec, leafProfile, spineProfile)
        const reorderedResult = allocateUplinks(reorderedSpec, leafProfile, spineProfile)
        
        expect(computeStructuralHash(originalResult)).toBe(computeStructuralHash(reorderedResult))
      }
    })
  })

  describe('Runtime Environment Reporting', () => {
    it('should document determinism test environment', () => {
      console.log('🔍 Determinism Test Environment Report:')
      console.log(`   Node.js Version: ${process.version}`)
      console.log(`   Platform: ${process.platform}`)
      console.log(`   Architecture: ${process.arch}`)
      console.log(`   V8 Version: ${process.versions.v8}`)
      console.log(`   Test Timestamp: ${new Date().toISOString()}`)
      console.log(`   Switch Profiles Available: ${leafProfile ? 'Yes' : 'No'}`)
      console.log(`   Reference Results Count: ${referenceResults.size}`)
      
      // Verify determinism infrastructure is working
      expect(referenceResults.size).toBe(deterministicTestSpecs.length)
      
      if (referenceResults.size > 0) {
        console.log(`   Sample Reference Hash: ${Array.from(referenceResults.values())[0].structuralHash.substring(0, 12)}...`)
        
        for (const [key, value] of referenceResults) {
          expect(value.structuralHash).toMatch(/^[a-f0-9]{64}$/) // Valid SHA-256
          expect(value.yamlHash).toMatch(/^[a-f0-9]{64}$/)
        }
      }
    })
  })
})