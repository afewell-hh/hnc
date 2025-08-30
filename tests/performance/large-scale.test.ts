import { describe, it, expect } from 'vitest'
import { computeTopology, validateFabricSpec } from '../../src/app.state.js'
import { FabricSpec } from '../../src/app.state.js'

describe('HNC v0.2 Performance Testing', () => {
  it('should handle large fabric with 100+ endpoints efficiently', () => {
    const startTime = performance.now()
    
    const largeSpec: FabricSpec = {
      name: 'Performance Test Large',
      spineModelId: 'DS3000-spine',
      leafModelId: 'DS2000-leaf', 
      uplinksPerLeaf: 4,
      endpointProfile: { name: 'Server', portsPerEndpoint: 1 },
      endpointCount: 128
    }

    const validation = validateFabricSpec(largeSpec)
    expect(validation.isValid).toBe(true)

    const topology = computeTopology(largeSpec)
    const endTime = performance.now()
    
    // Should complete in under 50ms for large topology
    expect(endTime - startTime).toBeLessThan(50)
    
    // Verify computation correctness
    expect(topology.leavesNeeded).toBeGreaterThan(0)
    expect(topology.spinesNeeded).toBeGreaterThan(0)
    expect(topology.isValid).toBe(true)
    
    console.log(`Large fabric (${largeSpec.endpointCount} endpoints) computed in ${(endTime - startTime).toFixed(2)}ms`)
    console.log(`Result: ${topology.leavesNeeded} leaves, ${topology.spinesNeeded} spines`)
  })

  it('should handle extreme fabric with 500+ endpoints', () => {
    const startTime = performance.now()
    
    const extremeSpec: FabricSpec = {
      name: 'Performance Test Extreme',
      spineModelId: 'DS3000-spine',
      leafModelId: 'DS2000-leaf',
      uplinksPerLeaf: 8,
      endpointProfile: { name: 'Server', portsPerEndpoint: 2 },
      endpointCount: 512
    }

    const validation = validateFabricSpec(extremeSpec)
    expect(validation.isValid).toBe(true)

    const topology = computeTopology(extremeSpec)
    const endTime = performance.now()
    
    // Should complete in under 100ms even for extreme scenarios
    expect(endTime - startTime).toBeLessThan(100)
    
    expect(topology.isValid).toBe(true)
    expect(topology.leavesNeeded).toBeGreaterThan(10)
    
    console.log(`Extreme fabric (${extremeSpec.endpointCount} endpoints) computed in ${(endTime - startTime).toFixed(2)}ms`)
  })

  it('should process multiple fabric computations efficiently', () => {
    const startTime = performance.now()
    const fabrics: FabricSpec[] = []
    
    // Create 10 different fabric configurations
    for (let i = 1; i <= 10; i++) {
      fabrics.push({
        name: `Multi-Fabric-${i}`,
        spineModelId: 'DS3000-spine',
        leafModelId: 'DS2000-leaf',
        uplinksPerLeaf: i % 2 === 0 ? 4 : 6,
        endpointProfile: { name: 'Server', portsPerEndpoint: 1 },
        endpointCount: i * 10
      })
    }

    // Process all fabrics
    const results = fabrics.map(spec => ({
      spec,
      topology: computeTopology(spec)
    }))
    
    const endTime = performance.now()
    
    // All 10 fabrics should process in under 100ms total
    expect(endTime - startTime).toBeLessThan(100)
    
    // All should be valid
    results.forEach(result => {
      expect(result.topology.isValid).toBe(true)
    })
    
    console.log(`10 fabric computations completed in ${(endTime - startTime).toFixed(2)}ms`)
    console.log(`Average per fabric: ${((endTime - startTime) / 10).toFixed(2)}ms`)
  })

  it('should validate input efficiently for batch operations', () => {
    const startTime = performance.now()
    const validationCount = 100
    
    for (let i = 0; i < validationCount; i++) {
      const spec = {
        name: `Validation-Test-${i}`,
        spineModelId: 'DS3000-spine',
        leafModelId: 'DS2000-leaf',
        uplinksPerLeaf: (i % 4 + 1) * 2, // 2, 4, 6, 8
        endpointProfile: { name: 'Server', portsPerEndpoint: 1 },
        endpointCount: i + 1
      }
      
      const validation = validateFabricSpec(spec)
      expect(validation.isValid).toBe(true)
    }
    
    const endTime = performance.now()
    
    // 100 validations should complete in under 50ms
    expect(endTime - startTime).toBeLessThan(50)
    
    console.log(`${validationCount} validations completed in ${(endTime - startTime).toFixed(2)}ms`)
    console.log(`Average per validation: ${((endTime - startTime) / validationCount).toFixed(3)}ms`)
  })
})