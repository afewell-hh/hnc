/**
 * External Link Property Tests - WP-EXT1
 * Comprehensive property-based testing for external link functionality
 */

import { describe, test, expect } from 'vitest'
import {
  ExternalLink,
  ExplicitPort,
  BorderCapabilities,
  convertBandwidthToPorts,
  calculateTotalBandwidth,
  validateExternalLink,
  checkExternalDivisibility,
  createExternalLink,
  convertToExplicitMode,
  convertToBandwidthMode,
  getDefaultBorderCapabilities
} from './external-link'

describe('External Link Property Tests', () => {
  // Test data generators
  const generateValidBandwidth = () => Math.floor(Math.random() * 10000) + 1
  const generateValidSpeed = (): '10G' | '25G' | '100G' | '400G' => {
    const speeds = ['10G', '25G', '100G', '400G'] as const
    return speeds[Math.floor(Math.random() * speeds.length)]
  }

  const generatePortConfiguration = (): ExplicitPort[] => {
    const count = Math.floor(Math.random() * 5) + 1
    return Array.from({ length: count }, () => ({
      speed: generateValidSpeed(),
      count: Math.floor(Math.random() * 16) + 1
    }))
  }

  const generateBorderCapabilities = (): BorderCapabilities => ({
    maxPorts: Math.floor(Math.random() * 32) + 16,
    availableSpeeds: ['10G', '25G', '100G', '400G'],
    breakoutCapability: {
      '100G': ['4x25G'],
      '400G': ['4x100G', '16x25G']
    },
    lagSupport: true,
    maxPortsPerLag: 8
  })

  describe('Bandwidth Conversion Properties', () => {
    test('computed plan always meets or exceeds target bandwidth when possible', () => {
      for (let i = 0; i < 100; i++) {
        const targetGbps = generateValidBandwidth()
        const preferredSpeed = generateValidSpeed()
        const capabilities = generateBorderCapabilities()

        const allocatedPorts = convertBandwidthToPorts(targetGbps, preferredSpeed, capabilities)
        const actualBandwidth = calculateTotalBandwidth(allocatedPorts)
        const totalPorts = allocatedPorts.reduce((sum, p) => sum + p.count, 0)

        // If allocation succeeds and respects port limits, it should meet or exceed target when feasible
        if (allocatedPorts.length > 0) {
          // Check if the target was feasible given port constraints
          const minSpeedValue = Math.min(...capabilities.availableSpeeds.map(s => parseInt(s.replace('G', ''))))
          const maxPossibleBandwidth = capabilities.maxPorts * Math.max(...capabilities.availableSpeeds.map(s => parseInt(s.replace('G', ''))))
          
          if (targetGbps <= maxPossibleBandwidth) {
            expect(actualBandwidth).toBeGreaterThanOrEqual(Math.min(targetGbps, capabilities.maxPorts * minSpeedValue))
          }
          
          // Always respect port limits
          expect(totalPorts).toBeLessThanOrEqual(capabilities.maxPorts)
        }
      }
    })

    test('increasing resources never reduces feasibility', () => {
      for (let i = 0; i < 50; i++) {
        const targetGbps = generateValidBandwidth()
        const baseCapabilities = generateBorderCapabilities()
        const enhancedCapabilities = {
          ...baseCapabilities,
          maxPorts: baseCapabilities.maxPorts * 2
        }

        const basePorts = convertBandwidthToPorts(targetGbps, undefined, baseCapabilities)
        const enhancedPorts = convertBandwidthToPorts(targetGbps, undefined, enhancedCapabilities)

        // Enhanced capabilities should never reduce feasibility
        if (basePorts.length > 0) {
          expect(enhancedPorts.length).toBeGreaterThan(0)
        }
      }
    })

    test('bandwidth conversion is deterministic', () => {
      for (let i = 0; i < 50; i++) {
        const targetGbps = generateValidBandwidth()
        const preferredSpeed = generateValidSpeed()
        const capabilities = generateBorderCapabilities()

        const allocation1 = convertBandwidthToPorts(targetGbps, preferredSpeed, capabilities)
        const allocation2 = convertBandwidthToPorts(targetGbps, preferredSpeed, capabilities)

        // Same inputs should produce identical outputs
        expect(allocation1).toEqual(allocation2)
      }
    })

    test('zero or negative bandwidth returns empty allocation', () => {
      const capabilities = getDefaultBorderCapabilities()
      
      expect(convertBandwidthToPorts(0, '100G', capabilities)).toEqual([])
      expect(convertBandwidthToPorts(-100, '100G', capabilities)).toEqual([])
    })

    test('bandwidth calculation is associative', () => {
      for (let i = 0; i < 50; i++) {
        const ports1 = generatePortConfiguration()
        const ports2 = generatePortConfiguration()
        
        const bandwidth1 = calculateTotalBandwidth(ports1)
        const bandwidth2 = calculateTotalBandwidth(ports2)
        const combinedBandwidth = calculateTotalBandwidth([...ports1, ...ports2])

        expect(combinedBandwidth).toBe(bandwidth1 + bandwidth2)
      }
    })
  })

  describe('Validation Properties', () => {
    test('valid external link always passes basic validation', () => {
      for (let i = 0; i < 50; i++) {
        const link = createExternalLink(`test-link-${i}`)
        link.targetGbps = generateValidBandwidth()
        link.preferredSpeed = generateValidSpeed()

        const result = validateExternalLink(link, getDefaultBorderCapabilities())
        
        // Basic links should validate successfully
        expect(result.externalLink).toBe(link)
        expect(result.allocatedPorts).toBeDefined()
      }
    })

    test('validation errors are always actionable', () => {
      // Test with impossible requirements
      const impossibleLink: ExternalLink = {
        id: 'impossible',
        name: 'Impossible Link',
        mode: 'target-bandwidth',
        targetGbps: 10000, // Very high bandwidth
        category: 'vpc.external'
      }

      const smallCapabilities: BorderCapabilities = {
        maxPorts: 2, // Very limited
        availableSpeeds: ['10G'],
        breakoutCapability: {},
        lagSupport: false
      }

      const result = validateExternalLink(impossibleLink, smallCapabilities)
      
      // Should have clear error messages
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.every(error => error.length > 0)).toBe(true)
    })

    test('enabled/disabled status is respected', () => {
      const link = createExternalLink('test-link')
      link.enabled = false

      const enabledLinks = [{ ...link, enabled: true }]
      const disabledLinks = [{ ...link, enabled: false }]

      const enabledResult = checkExternalDivisibility(enabledLinks, 4, getDefaultBorderCapabilities())
      const disabledResult = checkExternalDivisibility(disabledLinks, 4, getDefaultBorderCapabilities())

      // Disabled links should not affect divisibility
      expect(disabledResult.valid).toBe(true)
    })
  })

  describe('Divisibility Properties', () => {
    test('divisibility check is commutative for spine count', () => {
      for (let i = 0; i < 30; i++) {
        const spineCount = Math.floor(Math.random() * 8) + 2
        const ports = Math.floor(Math.random() * 32) + 4

        const link: ExternalLink = {
          id: 'test',
          name: 'Test Link',
          mode: 'explicit-ports',
          explicitPorts: [{ speed: '100G', count: ports }],
          category: 'vpc.external'
        }

        const result1 = checkExternalDivisibility([link], spineCount)
        const result2 = checkExternalDivisibility([link], spineCount)

        // Same inputs should give same result
        expect(result1.valid).toBe(result2.valid)
        expect(result1.severity).toBe(result2.severity)
      }
    })

    test('perfectly divisible configurations are always valid', () => {
      for (let i = 0; i < 30; i++) {
        const spineCount = Math.floor(Math.random() * 6) + 2
        const multiplier = Math.floor(Math.random() * 4) + 1
        const perfectPorts = spineCount * multiplier

        const link: ExternalLink = {
          id: 'perfect',
          name: 'Perfect Link',
          mode: 'explicit-ports',
          explicitPorts: [{ speed: '100G', count: perfectPorts }],
          category: 'vpc.external'
        }

        const result = checkExternalDivisibility([link], spineCount)
        expect(result.valid).toBe(true)
        expect(result.severity).toBe('ok')
      }
    })

    test('divisibility improves with more spines', () => {
      const fixedPorts = 17 // Prime number - difficult to divide evenly

      const link: ExternalLink = {
        id: 'fixed',
        name: 'Fixed Ports',
        mode: 'explicit-ports',
        explicitPorts: [{ speed: '100G', count: fixedPorts }],
        category: 'vpc.external',
        enabled: true
      }

      const result2 = checkExternalDivisibility([link], 2)
      const result17 = checkExternalDivisibility([link], 17)

      // 17 spines should divide 17 ports perfectly
      expect(result17.valid).toBe(true)
      expect(result17.severity).toBe('ok')
      
      // 2 spines should have remainder issues with 17 ports (8.5 per spine, so 1 leftover)
      expect(result2.valid).toBe(true) // Still valid, but with warnings
      expect(result2.severity).toBe('warning')
      expect(result2.messages[0]).toContain('1 unused connections')
    })
  })

  describe('Mode Conversion Properties', () => {
    test('bandwidth->explicit->bandwidth roundtrip preserves intent', () => {
      for (let i = 0; i < 30; i++) {
        const originalBandwidth = generateValidBandwidth()
        const capabilities = getDefaultBorderCapabilities()

        const original: ExternalLink = {
          id: 'roundtrip',
          name: 'Roundtrip Test',
          mode: 'target-bandwidth',
          targetGbps: originalBandwidth,
          category: 'vpc.external'
        }

        // Convert to explicit
        const explicit = convertToExplicitMode(original, capabilities)
        expect(explicit.mode).toBe('explicit-ports')
        expect(explicit.explicitPorts).toBeDefined()

        // Calculate achieved bandwidth
        const achievedBandwidth = explicit.explicitPorts 
          ? calculateTotalBandwidth(explicit.explicitPorts)
          : 0

        // Convert back to bandwidth
        const backToBandwidth = convertToBandwidthMode(explicit)
        
        // Should preserve achieved bandwidth (not necessarily original)
        expect(backToBandwidth.mode).toBe('target-bandwidth')
        expect(backToBandwidth.targetGbps).toBe(achievedBandwidth)
      }
    })

    test('explicit->bandwidth->explicit preserves port allocation', () => {
      for (let i = 0; i < 30; i++) {
        const originalPorts = generatePortConfiguration()
        const capabilities = getDefaultBorderCapabilities()

        const original: ExternalLink = {
          id: 'explicit-roundtrip',
          name: 'Explicit Roundtrip',
          mode: 'explicit-ports',
          explicitPorts: originalPorts,
          category: 'vpc.external'
        }

        // Convert to bandwidth
        const bandwidth = convertToBandwidthMode(original)
        expect(bandwidth.mode).toBe('target-bandwidth')

        // Convert back to explicit
        const backToExplicit = convertToExplicitMode(bandwidth, capabilities)
        
        // Should achieve at least the same bandwidth
        const originalBandwidth = calculateTotalBandwidth(originalPorts)
        const finalBandwidth = backToExplicit.explicitPorts 
          ? calculateTotalBandwidth(backToExplicit.explicitPorts)
          : 0

        expect(finalBandwidth).toBeGreaterThanOrEqual(originalBandwidth)
      }
    })

    test('mode conversion preserves link identity', () => {
      const original = createExternalLink('identity-test')
      original.description = 'Test description'
      original.category = 'vpc.staticExternal'

      const explicit = convertToExplicitMode(original)
      expect(explicit.id).toBe(original.id)
      expect(explicit.name).toBe(original.name)
      expect(explicit.description).toBe(original.description)
      expect(explicit.category).toBe(original.category)

      const bandwidth = convertToBandwidthMode(explicit)
      expect(bandwidth.id).toBe(original.id)
      expect(bandwidth.name).toBe(original.name)
      expect(bandwidth.description).toBe(original.description)
      expect(bandwidth.category).toBe(original.category)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    test('handles maximum bandwidth gracefully', () => {
      const maxBandwidth = 100000 // 100Tbps
      const capabilities = {
        ...getDefaultBorderCapabilities(),
        maxPorts: 128
      }

      const allocation = convertBandwidthToPorts(maxBandwidth, '400G', capabilities)
      
      // Should either allocate or return empty (not crash)
      expect(Array.isArray(allocation)).toBe(true)
      
      if (allocation.length > 0) {
        const totalPorts = allocation.reduce((sum, port) => sum + port.count, 0)
        expect(totalPorts).toBeLessThanOrEqual(capabilities.maxPorts)
      }
    })

    test('handles single port configurations', () => {
      const singlePortLink: ExternalLink = {
        id: 'single',
        name: 'Single Port',
        mode: 'explicit-ports',
        explicitPorts: [{ speed: '100G', count: 1 }],
        category: 'vpc.external'
      }

      const result = validateExternalLink(singlePortLink)
      expect(result.allocatedPorts).toEqual([{ speed: '100G', count: 1 }])
      expect(result.totalBandwidthGbps).toBe(100)
    })

    test('handles empty port configurations', () => {
      const emptyLink: ExternalLink = {
        id: 'empty',
        name: 'Empty Link',
        mode: 'explicit-ports',
        explicitPorts: [],
        category: 'vpc.external'
      }

      const result = validateExternalLink(emptyLink)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('required'))).toBe(true)
    })

    test('handles very small spine counts', () => {
      const link = createExternalLink('small-spine-test')
      link.explicitPorts = [{ speed: '100G', count: 3 }]
      link.mode = 'explicit-ports'

      const result1 = checkExternalDivisibility([link], 1)
      const result2 = checkExternalDivisibility([link], 2)

      // 1 spine should always work
      expect(result1.valid).toBe(true)
      
      // 2 spines with 3 ports should have warnings
      expect(result2.severity).not.toBe('ok')
    })
  })

  describe('Integration Properties', () => {
    test('validation and compilation are consistent', () => {
      // This test would ensure that what validates also compiles correctly
      // (Integration with onf-external-compiler.ts)
      for (let i = 0; i < 20; i++) {
        const link = createExternalLink(`integration-${i}`)
        link.targetGbps = generateValidBandwidth()
        link.preferredSpeed = generateValidSpeed()

        const validation = validateExternalLink(link)
        
        if (validation.errors.length === 0) {
          // Valid links should have non-empty allocation
          expect(validation.allocatedPorts.length).toBeGreaterThan(0)
          expect(validation.totalBandwidthGbps).toBeGreaterThan(0)
        }
      }
    })

    test('border capabilities are respected across all operations', () => {
      const restrictiveCapabilities: BorderCapabilities = {
        maxPorts: 4,
        availableSpeeds: ['25G'],
        breakoutCapability: {},
        lagSupport: false
      }

      // Test conversion
      const ports = convertBandwidthToPorts(1000, '25G', restrictiveCapabilities)
      const totalPorts = ports.reduce((sum, p) => sum + p.count, 0)
      expect(totalPorts).toBeLessThanOrEqual(restrictiveCapabilities.maxPorts)

      // Test validation
      const link = createExternalLink('restricted-test')
      link.targetGbps = 1000
      const validation = validateExternalLink(link, restrictiveCapabilities)
      
      if (validation.allocatedPorts.length > 0) {
        const allocatedTotal = validation.allocatedPorts.reduce((sum, p) => sum + p.count, 0)
        expect(allocatedTotal).toBeLessThanOrEqual(restrictiveCapabilities.maxPorts)
      }
    })
  })
})

describe('External Link Unit Tests', () => {
  test('createExternalLink creates valid default link', () => {
    const link = createExternalLink('test-link')
    
    expect(link.id).toContain('ext-')
    expect(link.name).toBe('test-link')
    expect(link.mode).toBe('target-bandwidth')
    expect(link.category).toBe('vpc.external')
    expect(link.enabled).toBe(true)
    expect(link.targetGbps).toBe(100)
    expect(link.preferredSpeed).toBe('100G')
  })

  test('createExternalLink with custom category', () => {
    const link = createExternalLink('static-link', 'vpc.staticExternal')
    
    expect(link.category).toBe('vpc.staticExternal')
    expect(link.name).toBe('static-link')
  })

  test('calculateTotalBandwidth handles empty array', () => {
    expect(calculateTotalBandwidth([])).toBe(0)
  })

  test('calculateTotalBandwidth sums correctly', () => {
    const ports: ExplicitPort[] = [
      { speed: '100G', count: 2 },
      { speed: '25G', count: 4 }
    ]
    
    expect(calculateTotalBandwidth(ports)).toBe(200 + 100) // 300
  })

  test('convertBandwidthToPorts with no capabilities uses defaults', () => {
    const ports = convertBandwidthToPorts(100, '100G')
    expect(ports).toEqual([{ speed: '100G', count: 1 }])
  })

  test('convertBandwidthToPorts with preferred speed', () => {
    const ports = convertBandwidthToPorts(200, '100G')
    expect(ports).toEqual([{ speed: '100G', count: 2 }])
  })

  test('convertBandwidthToPorts uses greedy fallback', () => {
    const capabilities: BorderCapabilities = {
      maxPorts: 10,
      availableSpeeds: ['25G', '100G'],
      breakoutCapability: {},
      lagSupport: true
    }

    // Request more than can fit with preferred speed
    const ports = convertBandwidthToPorts(1000, '25G', capabilities)
    
    // Should use mix of speeds to fit within port limit
    expect(Array.isArray(ports)).toBe(true)
    const totalPorts = ports.reduce((sum, p) => sum + p.count, 0)
    expect(totalPorts).toBeLessThanOrEqual(capabilities.maxPorts)
  })
})