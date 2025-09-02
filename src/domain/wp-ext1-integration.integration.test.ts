/**
 * WP-EXT1 Integration Tests
 * Comprehensive validation of complete external connectivity system
 */

import { describe, test, expect } from 'vitest'
import {
  createExternalLink,
  validateExternalLink,
  convertBandwidthToPorts,
  convertToExplicitMode,
  getDefaultBorderCapabilities,
  type ExternalLink,
  type BorderCapabilities
} from './external-link'

import { validateBorderConfiguration } from './border-validation'

import { 
  compileExternalLinksToONF,
  generateONFYAML,
  createDefaultInternetUplink,
  createDefaultDatacenterInterconnect
} from '../io/onf-external-compiler'

import { 
  convertBandwidthToPortsAdvanced,
  convertBandwidthToPortsSimple
} from './bandwidth-converter'

describe('WP-EXT1 Integration Tests', () => {
  describe('Complete Workflow Integration', () => {
    test('end-to-end external connectivity workflow', () => {
      // 1. Create external links using domain functions
      const internetUplink = createDefaultInternetUplink()
      const dcInterconnect = createDefaultDatacenterInterconnect()
      
      expect(internetUplink.mode).toBe('target-bandwidth')
      expect(internetUplink.category).toBe('vpc.external')
      expect(dcInterconnect.category).toBe('vpc.staticExternal')

      // 2. Validate external links
      const internetValidation = validateExternalLink(internetUplink)
      const dcValidation = validateExternalLink(dcInterconnect)

      expect(internetValidation.errors).toHaveLength(0)
      expect(dcValidation.errors).toHaveLength(0)
      expect(internetValidation.totalBandwidthGbps).toBeGreaterThan(0)
      expect(dcValidation.totalBandwidthGbps).toBeGreaterThan(0)

      // 3. Convert to explicit mode
      const internetExplicit = convertToExplicitMode(internetUplink)
      expect(internetExplicit.mode).toBe('explicit-ports')
      expect(internetExplicit.explicitPorts).toBeDefined()
      expect(internetExplicit.explicitPorts!.length).toBeGreaterThan(0)

      // 4. Validate with border configuration
      const externalLinks = [internetUplink, dcInterconnect]
      const borderValidation = validateBorderConfiguration(externalLinks, {
        spineCount: 4,
        strictMode: false
      })

      expect(borderValidation.overallStatus.canSave).toBe(true)

      // 5. Compile to ONF
      const compilation = compileExternalLinksToONF(externalLinks)
      expect(compilation.errors).toHaveLength(0)
      expect(compilation.spec.external).toBeDefined()
      expect(compilation.spec.staticExternal).toBeDefined()
      expect(compilation.spec.external!.length).toBe(1)
      expect(compilation.spec.staticExternal!.length).toBe(1)

      // 6. Generate ONF YAML
      const onfYaml = generateONFYAML(compilation, 'test-vpc')
      expect(onfYaml).toContain('apiVersion: vpc.githedgehog.com/v1alpha2')
      expect(onfYaml).toContain('kind: VPC')
      expect(onfYaml).toContain('external:')
      expect(onfYaml).toContain('staticExternal:')
    })

    test('bandwidth conversion consistency across components', () => {
      const targetBandwidth = 300
      const capabilities = getDefaultBorderCapabilities()

      // Test different conversion methods produce compatible results
      const simple = convertBandwidthToPortsSimple(targetBandwidth, '100G')
      const advanced = convertBandwidthToPortsAdvanced(targetBandwidth, capabilities, {
        optimizeFor: 'efficiency'
      })
      const basic = convertBandwidthToPorts(targetBandwidth, '100G', capabilities)

      // All should provide at least the target bandwidth
      const calculateBandwidth = (ports: any[]) => 
        ports.reduce((sum, p) => sum + (parseInt(p.speed.replace('G', '')) * p.count), 0)

      expect(calculateBandwidth(simple)).toBeGreaterThanOrEqual(targetBandwidth)
      expect(calculateBandwidth(advanced.ports)).toBeGreaterThanOrEqual(targetBandwidth)
      expect(calculateBandwidth(basic)).toBeGreaterThanOrEqual(targetBandwidth)
    })
  })

  describe('Integration with WP-GFD3 Capability Filter', () => {
    test('border validation leverages capability filter correctly', () => {
      const externalLink = createExternalLink('Test Link')
      externalLink.targetGbps = 500

      // Test with limited border capabilities
      const limitedCapabilities: BorderCapabilities = {
        maxPorts: 8,
        availableSpeeds: ['25G', '100G'],
        breakoutCapability: {
          '100G': ['4x25G']
        },
        lagSupport: true
      }

      // This should trigger capacity validation from WP-GFD3
      const validation = validateBorderConfiguration([externalLink], {
        spineCount: 4,
        strictMode: false
      })

      // Should have capacity check result
      expect(validation.capacityCheck).toBeDefined()
      expect(validation.breakoutFeasibility).toBeDefined()
      expect(validation.borderClassCompatibility).toBeDefined()
    })

    test('breakout requirements are properly calculated', () => {
      const breakoutLink = createExternalLink('Breakout Link')
      breakoutLink.targetGbps = 100
      breakoutLink.preferredSpeed = '25G'

      const capabilities: BorderCapabilities = {
        maxPorts: 32,
        availableSpeeds: ['100G'], // No native 25G
        breakoutCapability: {
          '100G': ['4x25G']
        },
        lagSupport: true
      }

      const validation = validateBorderConfiguration([breakoutLink], {
        borderLeafModel: undefined, // Use default
        spineCount: 4
      })

      expect(validation.breakoutFeasibility).toBeDefined()
      // Should require breakout for 25G
      expect(validation.breakoutFeasibility.parentPortsRequired).toBeGreaterThan(0)
    })
  })

  describe('ONF Compliance Validation', () => {
    test('compiled output matches ONF schema requirements', () => {
      const validLinks = [
        createDefaultInternetUplink(),
        createDefaultDatacenterInterconnect()
      ]

      const compilation = compileExternalLinksToONF(validLinks, {
        validateCompliance: true
      })

      // Should pass compliance validation
      expect(compilation.errors.filter(e => e.includes('compliance') || e.includes('invalid'))).toHaveLength(0)

      // Check ONF structure
      expect(compilation.spec.external).toBeDefined()
      expect(compilation.spec.staticExternal).toBeDefined()

      // Each link should have valid structure
      compilation.spec.external?.forEach(link => {
        expect(link.name).toMatch(/^[a-z0-9-]+$/) // ONF name format
        expect(link.name.length).toBeLessThanOrEqual(63) // DNS limit
        expect(link.links.length).toBeGreaterThan(0)
        
        link.links.forEach(linkSpec => {
          expect(['10G', '25G', '100G', '400G']).toContain(linkSpec.speed)
          expect(linkSpec.count).toBeGreaterThan(0)
        })
      })
    })

    test('invalid configurations are caught by compliance validation', () => {
      const invalidLink: ExternalLink = {
        id: 'invalid',
        name: 'Invalid@Link!Name', // Invalid characters
        mode: 'explicit-ports',
        explicitPorts: [
          { speed: '100G', count: 0 } // Invalid count
        ],
        category: 'vpc.external'
      }

      const compilation = compileExternalLinksToONF([invalidLink], {
        validateCompliance: true
      })

      // Should have compliance errors
      expect(compilation.errors.length).toBeGreaterThan(0)
      expect(compilation.errors.some(e => e.includes('invalid characters'))).toBe(true)
    })
  })

  describe('Spine Divisibility Integration', () => {
    test('divisibility validation phases work correctly', () => {
      const unevenLink = createExternalLink('Uneven Link')
      unevenLink.mode = 'explicit-ports'
      unevenLink.explicitPorts = [{ speed: '100G', count: 7 }] // Odd count

      // Pre-spine selection: should show warnings
      const preSpineValidation = validateBorderConfiguration([unevenLink], {
        spineCount: undefined // Pre-spine
      })
      expect(preSpineValidation.divisibilityCheck.severity).not.toBe('error')

      // Post-spine selection: should show warnings/errors based on waste
      const postSpineValidation = validateBorderConfiguration([unevenLink], {
        spineCount: 4 // 7 ports / 4 spines = 1.75 per spine
      })
      expect(postSpineValidation.divisibilityCheck).toBeDefined()
      expect(postSpineValidation.divisibilityCheck.spineCount).toBe(4)
    })

    test('perfect divisibility scenarios validate correctly', () => {
      const perfectLink = createExternalLink('Perfect Link')
      perfectLink.mode = 'explicit-ports'
      perfectLink.explicitPorts = [{ speed: '100G', count: 8 }] // 2 per spine for 4 spines

      const validation = validateBorderConfiguration([perfectLink], {
        spineCount: 4
      })

      expect(validation.divisibilityCheck.valid).toBe(true)
      expect(validation.divisibilityCheck.severity).toBe('ok')
      expect(validation.overallStatus.level).toBe('valid')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('graceful handling of empty external links', () => {
      const emptyLinks: ExternalLink[] = []

      const validation = validateBorderConfiguration(emptyLinks)
      expect(validation.overallStatus.canSave).toBe(true)

      const compilation = compileExternalLinksToONF(emptyLinks)
      expect(compilation.errors).toHaveLength(0)
      expect(compilation.spec.external).toEqual([])
      expect(compilation.spec.staticExternal).toEqual([])
    })

    test('handles disabled external links correctly', () => {
      const enabledLink = createExternalLink('Enabled')
      enabledLink.enabled = true

      const disabledLink = createExternalLink('Disabled')
      disabledLink.enabled = false

      const validation = validateBorderConfiguration([enabledLink, disabledLink])
      
      // Should only validate enabled links
      expect(validation.capacityCheck).toBeDefined()
      
      const compilation = compileExternalLinksToONF([enabledLink, disabledLink], {
        includeDisabled: false
      })

      // Should only compile enabled links
      expect(compilation.spec.external?.length).toBe(1)
    })

    test('handles malformed external link configurations', () => {
      const malformedLink: ExternalLink = {
        id: 'malformed',
        name: '', // Empty name
        mode: 'target-bandwidth',
        targetGbps: -100, // Negative bandwidth
        category: 'vpc.external'
      }

      const validation = validateExternalLink(malformedLink)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors.some(e => e.includes('name is required'))).toBe(true)
      expect(validation.errors.some(e => e.includes('greater than 0'))).toBe(true)
    })
  })

  describe('Real-World Scenario Integration', () => {
    test('common enterprise scenario validates end-to-end', () => {
      // Typical enterprise setup
      const primaryInternet = createExternalLink('Primary Internet')
      primaryInternet.targetGbps = 200
      primaryInternet.preferredSpeed = '100G'

      const backupInternet = createExternalLink('Backup Internet')  
      backupInternet.targetGbps = 100
      backupInternet.preferredSpeed = '100G'

      const awsDirect = createExternalLink('AWS Direct Connect', 'vpc.staticExternal')
      awsDirect.targetGbps = 400
      awsDirect.preferredSpeed = '100G'

      const enterpriseLinks = [primaryInternet, backupInternet, awsDirect]

      // Validate
      const validation = validateBorderConfiguration(enterpriseLinks, {
        spineCount: 4,
        strictMode: false
      })

      expect(validation.overallStatus.canSave).toBe(true)

      // Convert all to explicit for final configuration
      const explicitLinks = enterpriseLinks.map(link => convertToExplicitMode(link))

      // Compile
      const compilation = compileExternalLinksToONF(explicitLinks)
      expect(compilation.errors).toHaveLength(0)
      expect(compilation.metadata.totalExternalBandwidth).toBe(300) // 2 external links
      expect(compilation.metadata.totalStaticBandwidth).toBe(400) // 1 static external

      // Generate deployment YAML
      const yaml = generateONFYAML(compilation, 'enterprise-vpc')
      expect(yaml).toContain('name: enterprise-vpc')
      expect(yaml).toContain('external:')
      expect(yaml).toContain('staticExternal:')
    })

    test('high-density border scenario with breakouts', () => {
      const highDensityLink = createExternalLink('High Density Border')
      highDensityLink.mode = 'explicit-ports'
      highDensityLink.explicitPorts = [
        { speed: '400G', count: 4 },
        { speed: '100G', count: 8 },
        { speed: '25G', count: 16 } // Requires breakout
      ]

      const highCapacityBorder: BorderCapabilities = {
        maxPorts: 48,
        availableSpeeds: ['100G', '400G'], // 25G requires breakout
        breakoutCapability: {
          '100G': ['4x25G'],
          '400G': ['4x100G', '16x25G']
        },
        lagSupport: true,
        maxPortsPerLag: 8
      }

      const validation = validateBorderConfiguration([highDensityLink], {
        borderLeafModel: undefined,
        spineCount: 8 // Need many spines for distribution
      })

      // Should handle breakout requirements
      expect(validation.breakoutFeasibility).toBeDefined()
      expect(validation.capacityCheck).toBeDefined()

      // Should compile successfully
      const compilation = compileExternalLinksToONF([highDensityLink])
      expect(compilation.errors).toHaveLength(0)
      expect(compilation.metadata.totalExternalBandwidth).toBe(
        4 * 400 + 8 * 100 + 16 * 25 // 2800 Gbps total
      )
    })
  })

  describe('Performance and Scalability', () => {
    test('handles large numbers of external links efficiently', () => {
      const manyLinks = Array.from({ length: 50 }, (_, i) => {
        const link = createExternalLink(`Link-${i}`)
        link.targetGbps = 100 + (i % 5) * 50 // Vary bandwidth
        return link
      })

      const startTime = Date.now()
      
      const validation = validateBorderConfiguration(manyLinks, {
        spineCount: 8
      })
      
      const compilation = compileExternalLinksToONF(manyLinks)
      
      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000) // 5 seconds

      expect(validation.overallStatus).toBeDefined()
      expect(compilation.spec.external?.length).toBe(50)
    })
  })
})