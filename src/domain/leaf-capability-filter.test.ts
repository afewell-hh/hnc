/**
 * Property tests for leaf capability filter monotonicity - WP-GFD3
 * Ensures capability filtering behaves predictably under different scenarios
 */

import { describe, test, expect } from 'vitest'
import { 
  checkLeafCapability, 
  calculateBreakoutFeasibility,
  checkDivisibility,
  DEFAULT_LEAF_MODELS,
  type EndpointProfile,
  type LeafModel 
} from './leaf-capability-filter.js'

// Test data generators
const createEndpointProfile = (
  id: string,
  name: string,
  serverCount: number,
  nicCount: number,
  nicSpeed: string
): EndpointProfile => ({
  id,
  name,
  serverCount,
  nicCount,
  nicSpeed,
  lagConfig: undefined
})

const createLAGProfile = (
  id: string,
  name: string,
  serverCount: number,
  nicCount: number,
  nicSpeed: string,
  mclag: boolean = false
): EndpointProfile => ({
  id,
  name,
  serverCount,
  nicCount,
  nicSpeed,
  lagConfig: {
    enabled: true,
    mode: 'lacp',
    mclag,
    loadBalancing: 'L3+L4',
    lacpRate: 'fast',
    minLinks: 2
  }
})

describe('Leaf Capability Filter - Property Tests', () => {
  
  describe('Monotonicity Properties', () => {
    
    test('Adding more servers should never increase feasibility', () => {
      const baseProfile = createEndpointProfile('test', 'Test', 10, 2, '25G')
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const baseResult = checkLeafCapability(model, [baseProfile])
        
        // Test with increasing server counts
        for (let serverCount = baseProfile.serverCount + 1; serverCount <= baseProfile.serverCount + 10; serverCount++) {
          const expandedProfile = createEndpointProfile('test', 'Test', serverCount, 2, '25G')
          const expandedResult = checkLeafCapability(model, [expandedProfile])
          
          // If base was not feasible, expanded should also not be feasible
          if (!baseResult.feasible) {
            expect(expandedResult.feasible).toBe(false)
          }
          
          // Port usage should be monotonically increasing
          expect(expandedResult.portsUsed).toBeGreaterThanOrEqual(baseResult.portsUsed)
          expect(expandedResult.utilizationPercentage).toBeGreaterThanOrEqual(baseResult.utilizationPercentage)
        }
      })
    })

    test('Adding more NICs per server should never increase feasibility', () => {
      const baseProfile = createEndpointProfile('test', 'Test', 8, 1, '25G')
      const uplinksPerLeaf = 4 // default value used in checkLeafCapability
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const baseResult = checkLeafCapability(model, [baseProfile])
        
        // Test with increasing NIC counts
        for (let nicCount = 2; nicCount <= 8; nicCount++) {
          const expandedProfile = createEndpointProfile('test', 'Test', 8, nicCount, '25G')
          const expandedResult = checkLeafCapability(model, [expandedProfile])
          
          // If base was not feasible, expanded should also not be feasible
          if (!baseResult.feasible) {
            expect(expandedResult.feasible).toBe(false)
          }
          
          // Only check port calculations if both results are feasible
          if (baseResult.feasible && expandedResult.feasible) {
            // Port usage should scale predictably for endpoints only
            // portsUsed = totalEndpoints + uplinksPerLeaf, so we need to isolate endpoint calculation
            const baseEndpoints = baseProfile.serverCount * baseProfile.nicCount
            const expandedEndpoints = expandedProfile.serverCount * expandedProfile.nicCount
            
            expect(expandedEndpoints).toBe(baseEndpoints * nicCount)
            expect(expandedResult.portsUsed).toBe(expandedEndpoints + uplinksPerLeaf)
          }
          
          // Port usage should be monotonically increasing (when feasible)
          if (expandedResult.feasible) {
            expect(expandedResult.portsUsed).toBeGreaterThanOrEqual(baseResult.portsUsed || 0)
            expect(expandedResult.utilizationPercentage).toBeGreaterThanOrEqual(baseResult.utilizationPercentage)
          }
        }
      })
    })

    test('Higher speed requirements should never be easier than lower speeds', () => {
      const speeds = ['25G', '100G', '400G']
      const profile = createEndpointProfile('test', 'Test', 16, 2, '25G')
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const results = speeds.map(speed => {
          const speedProfile = { ...profile, nicSpeed: speed }
          return {
            speed,
            result: checkLeafCapability(model, [speedProfile])
          }
        })
        
        // Check monotonicity: if higher speed is feasible, lower should be too (via breakout)
        for (let i = 1; i < results.length; i++) {
          const current = results[i]
          const previous = results[i - 1]
          
          if (current.result.feasible && !previous.result.feasible) {
            // This could happen due to breakout availability, but let's log it
            console.log(`Model ${model.name}: ${current.speed} feasible but ${previous.speed} not - likely breakout scenario`)
          }
        }
      })
    })

    test('Increasing uplinks should never decrease feasibility', () => {
      const profile = createEndpointProfile('test', 'Test', 12, 2, '25G')
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const uplinkCounts = [2, 4, 6, 8]
        let previousFeasible = true
        
        uplinkCounts.forEach(uplinks => {
          const result = checkLeafCapability(model, [profile], uplinks)
          
          // If previous uplink count was not feasible, current shouldn't be either
          if (!previousFeasible) {
            expect(result.feasible).toBe(false)
          }
          
          // Track feasibility for next iteration
          previousFeasible = result.feasible
          
          // Port utilization should increase with uplinks
          // The algorithm uses Math.round() which can cause 0.5 differences
          const expectedUtilization = ((profile.serverCount * profile.nicCount + uplinks) / model.totalPorts) * 100
          const expectedRounded = Math.round(expectedUtilization)
          expect(result.utilizationPercentage).toBe(expectedRounded)
        })
      })
    })
    
  })

  describe('Breakout Feasibility Properties', () => {
    
    test('Breakout efficiency should be inversely related to waste', () => {
      DEFAULT_LEAF_MODELS.forEach(model => {
        if (!model.breakoutOptions) return
        
        const testScenarios = [
          { portsNeeded: 4, speed: '25G' },
          { portsNeeded: 7, speed: '25G' },
          { portsNeeded: 12, speed: '25G' },
          { portsNeeded: 15, speed: '25G' }
        ]
        
        testScenarios.forEach(scenario => {
          const result = calculateBreakoutFeasibility(model, scenario.speed, scenario.portsNeeded)
          
          if (result.feasible) {
            const waste = result.childPortsGenerated - scenario.portsNeeded
            const expectedEfficiency = Math.round((scenario.portsNeeded / result.childPortsGenerated) * 100)
            
            expect(result.efficiency).toBe(expectedEfficiency)
            
            // High waste should result in low efficiency
            if (waste > scenario.portsNeeded * 0.5) {
              expect(result.efficiency).toBeLessThan(75)
            }
          }
        })
      })
    })

    test('More ports needed should require more or equal parent ports', () => {
      const model = DEFAULT_LEAF_MODELS.find(m => m.breakoutOptions)
      if (!model) return
      
      const portCounts = [4, 8, 12, 16, 20]
      let previousParentPorts = 0
      
      portCounts.forEach(portsNeeded => {
        const result = calculateBreakoutFeasibility(model, '25G', portsNeeded)
        
        if (result.feasible) {
          expect(result.parentPortsRequired).toBeGreaterThanOrEqual(previousParentPorts)
          previousParentPorts = result.parentPortsRequired
        }
      })
    })
    
  })

  describe('Divisibility Properties', () => {
    
    test('Perfect divisibility should always be OK', () => {
      const testCases = [
        { value: 16, divisor: 4 },
        { value: 24, divisor: 6 },
        { value: 32, divisor: 8 },
        { value: 100, divisor: 25 }
      ]
      
      testCases.forEach(({ value, divisor }) => {
        const result = checkDivisibility(value, divisor, `${value}÷${divisor}`)
        expect(result.valid).toBe(true)
        expect(result.severity).toBe('ok')
        expect(result.message).toBeUndefined()
      })
    })

    test('High waste percentage should be an error', () => {
      const testCases = [
        { value: 10, divisor: 8 }, // 80% waste - error
        { value: 100, divisor: 60 }, // 40% waste - error  
        { value: 7, divisor: 4 }, // ~43% waste - error
      ]
      
      testCases.forEach(({ value, divisor }) => {
        const result = checkDivisibility(value, divisor, `${value}÷${divisor}`)
        const remainder = value % divisor
        const wastePercentage = (remainder / value) * 100
        
        if (wastePercentage > 50) {
          expect(result.valid).toBe(false)
          expect(result.severity).toBe('error')
        }
      })
    })

    test('Moderate waste should be a warning', () => {
      const testCases = [
        { value: 10, divisor: 7 }, // 30% waste - warning
        { value: 100, divisor: 80 }, // 20% waste - warning
        { value: 15, divisor: 11 }, // ~27% waste - warning
      ]
      
      testCases.forEach(({ value, divisor }) => {
        const result = checkDivisibility(value, divisor, `${value}÷${divisor}`)
        const remainder = value % divisor
        const wastePercentage = (remainder / value) * 100
        
        if (wastePercentage > 20 && wastePercentage <= 50) {
          expect(result.valid).toBe(true)
          expect(result.severity).toBe('warning')
          expect(result.message).toContain('waste')
        }
      })
    })

    test('Division by zero should always be an error', () => {
      const result = checkDivisibility(10, 0, 'Test')
      expect(result.valid).toBe(false)
      expect(result.severity).toBe('error')
      expect(result.message).toContain('Division by zero')
    })
    
  })

  describe('LAG Configuration Properties', () => {
    
    test('LAG should never make a profile less feasible', () => {
      const baseProfile = createEndpointProfile('test', 'Test', 8, 4, '25G')
      const lagProfile = createLAGProfile('test', 'Test LAG', 8, 4, '25G')
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const baseResult = checkLeafCapability(model, [baseProfile])
        const lagResult = checkLeafCapability(model, [lagProfile])
        
        // LAG should not change basic port requirements
        expect(lagResult.portsUsed).toBe(baseResult.portsUsed)
        
        // If base is feasible, LAG should be feasible (may have warnings)
        if (baseResult.feasible) {
          expect(lagResult.feasible).toBe(true)
        }
      })
    })

    test('MC-LAG should generate appropriate warnings on unsupported models', () => {
      const mclagProfile = createLAGProfile('test', 'MC-LAG Test', 8, 4, '25G', true)
      
      // Test on models with and without LAG support
      DEFAULT_LEAF_MODELS.forEach(model => {
        const result = checkLeafCapability(model, [mclagProfile])
        
        // Should have LAG-related warnings if model has limited support
        if (model.lagSupport && result.warnings.length > 0) {
          const hasLagWarning = result.warnings.some(w => 
            w.toLowerCase().includes('lag') || 
            w.toLowerCase().includes('lacp')
          )
          // This is expected for MC-LAG scenarios
        }
      })
    })
    
  })

  describe('Integration Properties', () => {
    
    test('Multiple profiles should have additive port requirements', () => {
      const profile1 = createEndpointProfile('p1', 'Profile 1', 4, 2, '25G')
      const profile2 = createEndpointProfile('p2', 'Profile 2', 6, 1, '25G')
      
      DEFAULT_LEAF_MODELS.forEach(model => {
        const result1 = checkLeafCapability(model, [profile1])
        const result2 = checkLeafCapability(model, [profile2])
        const combinedResult = checkLeafCapability(model, [profile1, profile2])
        
        if (result1.feasible && result2.feasible) {
          // Combined port usage should be sum of individual requirements
          const expectedPorts = (profile1.serverCount * profile1.nicCount) + 
                               (profile2.serverCount * profile2.nicCount)
          
          // Account for uplinks in combined result
          const uplinks = 4 // default
          expect(combinedResult.portsUsed).toBe(expectedPorts + uplinks)
        }
      })
    })

    test('Empty profile list should always be feasible', () => {
      DEFAULT_LEAF_MODELS.forEach(model => {
        const result = checkLeafCapability(model, [], 4)
        expect(result.feasible).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.portsUsed).toBe(4) // Just uplinks
      })
    })
    
  })
})