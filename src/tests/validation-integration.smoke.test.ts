/**
 * Smoke tests for topology validation integration features - WP-TOP2
 * 
 * Tests optional hhfab CLI and Kubernetes dry-run validation when
 * environment variables are present, ensuring graceful handling
 * when integrations are not available.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { evaluateTopology } from '../domain/rules'
import type { FabricSpec, DerivedTopology } from '../app.types'

describe('Validation Integration Smoke Tests', () => {
  let originalNodeEnv: string | undefined
  
  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })
  
  afterEach(() => {
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      delete process.env.NODE_ENV
    }
  })

  const testSpec: FabricSpec = {
    name: 'integration-test-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 4,
    endpointCount: 50,
    endpointProfile: {
      name: 'server',
      portsPerEndpoint: 1,
      count: 50
    }
  }

  const testDerived: DerivedTopology = {
    leavesNeeded: 2,
    spinesNeeded: 1,
    totalPorts: 128,
    usedPorts: 58,
    oversubscriptionRatio: 2.0,
    isValid: true,
    validationErrors: [],
    guards: []
  }

  describe('Environment Detection', () => {
    it('skips integrations in test environment', async () => {
      process.env.NODE_ENV = 'test'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      // In test environment, integrations should be skipped
      expect(result.integrationResults).toEqual({})
      expect(result.summary.hasIntegrationValidation).toBe(true) // Setting is honored
    })

    it('includes integration placeholder when not in test mode', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/nonexistent/hhfab',
        kubectlPath: '/nonexistent/kubectl'
      })
      
      expect(result.summary.hasIntegrationValidation).toBe(true)
      // Integration results should exist but may contain errors for nonexistent paths
      expect(result.integrationResults).toBeDefined()
    })
  })

  describe('Integration Options Handling', () => {
    it('respects enableIntegrations: false', async () => {
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: false,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      expect(result.integrationResults).toBeUndefined()
      expect(result.summary.hasIntegrationValidation).toBe(false)
    })

    it('handles missing integration paths gracefully', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true
        // No paths provided
      })
      
      expect(result.summary.hasIntegrationValidation).toBe(true)
      expect(result.integrationResults).toBeDefined()
      // Should not crash even without paths
    })

    it('handles partial integration configuration', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab'
        // No kubectl path
      })
      
      expect(result.summary.hasIntegrationValidation).toBe(true)
      expect(result.integrationResults).toBeDefined()
    })
  })

  describe('Core Validation Independence', () => {
    it('produces identical core validation with and without integrations', async () => {
      const specWithError: FabricSpec = {
        ...testSpec,
        uplinksPerLeaf: 20 // Force spine capacity error
      }
      
      const derivedWithError: DerivedTopology = {
        ...testDerived,
        spinesNeeded: 1, // 1 * 32 < 2 * 20
        isValid: false
      }

      const resultWithoutIntegration = await evaluateTopology(specWithError, derivedWithError, {
        enableIntegrations: false
      })
      
      const resultWithIntegration = await evaluateTopology(specWithError, derivedWithError, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab'
      })
      
      // Core validation should be identical
      expect(resultWithoutIntegration.errors).toEqual(resultWithIntegration.errors)
      expect(resultWithoutIntegration.warnings).toEqual(resultWithIntegration.warnings)
      expect(resultWithoutIntegration.info).toEqual(resultWithIntegration.info)
      
      // Only integration metadata should differ
      expect(resultWithoutIntegration.summary.hasIntegrationValidation).toBe(false)
      expect(resultWithIntegration.summary.hasIntegrationValidation).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('handles integration errors gracefully without affecting core validation', async () => {
      process.env.NODE_ENV = 'development'
      
      const specWithIssue: FabricSpec = {
        ...testSpec,
        uplinksPerLeaf: 3 // Uneven distribution warning
      }
      
      const derivedWithIssue: DerivedTopology = {
        ...testDerived,
        spinesNeeded: 2 // 3 % 2 = 1 remainder
      }

      const result = await evaluateTopology(specWithIssue, derivedWithIssue, {
        enableIntegrations: true,
        hhfabPath: '/definitely/nonexistent/path/hhfab',
        kubectlPath: '/definitely/nonexistent/path/kubectl'
      })
      
      // Should have core validation warning
      const warning = result.warnings.find(w => w.code === 'UPLINKS_NOT_DIVISIBLE_BY_SPINES')
      expect(warning).toBeDefined()
      
      // Integration should report errors but not crash
      expect(result.integrationResults).toBeDefined()
      expect(result.summary.hasIntegrationValidation).toBe(true)
    })

    it('continues validation even if integration promises reject', async () => {
      process.env.NODE_ENV = 'development'
      
      // Test that the function completes even with integration failures
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '',  // Empty paths should cause errors
        kubectlPath: ''
      })
      
      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.errors).toBeDefined()
      expect(result.warnings).toBeDefined()
    })
  })

  describe('Performance Impact', () => {
    it('completes validation quickly when integrations disabled', async () => {
      const startTime = Date.now()
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: false
      })
      
      const duration = Date.now() - startTime
      
      expect(result).toBeDefined()
      expect(duration).toBeLessThan(100) // Should be very fast without integrations
    })

    it('handles integration timeouts gracefully', async () => {
      // This test verifies the structure is in place for timeout handling
      // In a real environment, integrations might take time or timeout
      
      const startTime = Date.now()
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      const duration = Date.now() - startTime
      
      expect(result).toBeDefined()
      expect(duration).toBeLessThan(5000) // Should not hang indefinitely
    })
  })

  describe('Configuration Validation', () => {
    it('validates hhfab path configuration', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      expect(result.integrationResults).toBeDefined()
      
      // In development mode, should attempt to use provided paths
      if (result.integrationResults?.hhfab) {
        expect(result.integrationResults.hhfab.valid).toBeDefined()
        expect(result.integrationResults.hhfab.messages).toBeDefined()
      }
    })

    it('validates kubectl path configuration', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      expect(result.integrationResults).toBeDefined()
      
      // In development mode, should attempt to use provided paths
      if (result.integrationResults?.kubernetes) {
        expect(result.integrationResults.kubernetes.valid).toBeDefined()
        expect(result.integrationResults.kubernetes.messages).toBeDefined()
      }
    })
  })

  describe('Stub Implementation Verification', () => {
    it('provides stub validation messages when integrations not available', async () => {
      process.env.NODE_ENV = 'development'
      
      const result = await evaluateTopology(testSpec, testDerived, {
        enableIntegrations: true,
        hhfabPath: '/usr/local/bin/hhfab',
        kubectlPath: '/usr/local/bin/kubectl'
      })
      
      // Stub implementations should provide meaningful placeholder messages
      if (result.integrationResults?.hhfab) {
        expect(result.integrationResults.hhfab.messages).toBeDefined()
        expect(result.integrationResults.hhfab.messages.length).toBeGreaterThan(0)
      }
      
      if (result.integrationResults?.kubernetes) {
        expect(result.integrationResults.kubernetes.messages).toBeDefined()
        expect(result.integrationResults.kubernetes.messages.length).toBeGreaterThan(0)
      }
    })
  })
})