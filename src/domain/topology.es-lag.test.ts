/**
 * Unit tests for ES-LAG validation in topology computation
 * Tests planning-time guards for ES-LAG constraints
 */

import { describe, it, expect } from 'vitest'
import { computeDerived } from './topology'
import type { FabricSpec, ESLAGGuard } from '../app.types'

describe('ES-LAG Validation', () => {
  
  describe('Valid ES-LAG scenarios', () => {
    it('should pass validation when ES-LAG endpoint has 2 NICs', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'compute',
          name: 'Compute Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'dual-nic-server',
            portsPerEndpoint: 2,
            type: 'server',
            count: 10,
            esLag: true,
            nics: 2
          }]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(0)
      
      // No ES-LAG related guards should be present
      const esLagGuards = result.guards?.filter(g => g.guardType === 'ES_LAG_INVALID')
      expect(esLagGuards).toHaveLength(0)
    })

    it('should pass validation when ES-LAG endpoint has 4 NICs', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'storage',
          name: 'Storage Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'quad-nic-storage',
            portsPerEndpoint: 4,
            type: 'storage',
            count: 5,
            esLag: true,
            nics: 4
          }]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(0)
    })

    it('should pass validation when endpoint has ES-LAG disabled with 1 NIC', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'standard',
          name: 'Standard Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'single-nic-server',
            portsPerEndpoint: 1,
            type: 'server',
            count: 20,
            esLag: false,
            nics: 1
          }]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(0)
    })
  })

  describe('Invalid ES-LAG scenarios', () => {
    it('should generate guard when ES-LAG endpoint has only 1 NIC', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'broken',
          name: 'Broken Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'single-nic-with-eslag',
            portsPerEndpoint: 1,
            type: 'server',
            count: 10,
            esLag: true,
            nics: 1
          }]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(1)
      
      const esLagGuard = result.guards?.[0] as ESLAGGuard
      expect(esLagGuard.guardType).toBe('ES_LAG_INVALID')
      expect(esLagGuard.message).toContain('ES-LAG requires at least 2 NICs')
      expect(esLagGuard.message).toContain('single-nic-with-eslag')
      expect(esLagGuard.message).toContain('broken')
      expect(esLagGuard.message).toContain('has 1')
      
      expect(esLagGuard.details.leafClassId).toBe('broken')
      expect(esLagGuard.details.profileName).toBe('single-nic-with-eslag')
      expect(esLagGuard.details.requiredNics).toBe(2)
      expect(esLagGuard.details.actualNics).toBe(1)
    })

    it('should generate guard when ES-LAG endpoint has default 1 NIC', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'default-nic',
          name: 'Default NIC Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'default-nic-profile',
            portsPerEndpoint: 1,
            type: 'compute',
            count: 15,
            esLag: true
            // nics is undefined, should default to 1
          }]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(1)
      
      const esLagGuard = result.guards?.[0] as ESLAGGuard
      expect(esLagGuard.guardType).toBe('ES_LAG_INVALID')
      expect(esLagGuard.details.actualNics).toBe(1)
    })
  })

  describe('Mixed ES-LAG scenarios', () => {
    it('should generate guards only for invalid profiles in mixed setup', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'mixed',
          name: 'Mixed Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            {
              name: 'valid-eslag',
              portsPerEndpoint: 2,
              type: 'server',
              count: 5,
              esLag: true,
              nics: 2
            },
            {
              name: 'invalid-eslag',
              portsPerEndpoint: 1,
              type: 'server',
              count: 3,
              esLag: true,
              nics: 1
            },
            {
              name: 'no-eslag',
              portsPerEndpoint: 1,
              type: 'server',
              count: 10,
              esLag: false,
              nics: 1
            }
          ]
        }]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(1)
      
      const esLagGuard = result.guards?.[0] as ESLAGGuard
      expect(esLagGuard.guardType).toBe('ES_LAG_INVALID')
      expect(esLagGuard.details.profileName).toBe('invalid-eslag')
    })

    it('should handle multiple leaf classes with mixed ES-LAG configurations', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'class-a',
            name: 'Class A',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{
              name: 'invalid-a',
              portsPerEndpoint: 1,
              type: 'server',
              count: 5,
              esLag: true,
              nics: 1
            }]
          },
          {
            id: 'class-b',
            name: 'Class B', 
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{
              name: 'valid-b',
              portsPerEndpoint: 2,
              type: 'storage',
              count: 3,
              esLag: true,
              nics: 3
            }]
          },
          {
            id: 'class-c',
            name: 'Class C',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{
              name: 'invalid-c',
              portsPerEndpoint: 1,
              type: 'compute',
              count: 2,
              esLag: true
              // nics defaults to 1
            }]
          }
        ]
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(2)
      
      // Sort guards by class ID for consistent testing
      const sortedGuards = result.guards?.sort((a, b) => 
        (a as ESLAGGuard).details.leafClassId.localeCompare((b as ESLAGGuard).details.leafClassId)
      )
      
      const guardA = sortedGuards?.[0] as ESLAGGuard
      expect(guardA.details.leafClassId).toBe('class-a')
      expect(guardA.details.profileName).toBe('invalid-a')
      
      const guardC = sortedGuards?.[1] as ESLAGGuard
      expect(guardC.details.leafClassId).toBe('class-c')
      expect(guardC.details.profileName).toBe('invalid-c')
    })
  })

  describe('Edge cases', () => {
    it('should handle leaf class with no endpoint profiles', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'empty',
          name: 'Empty Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: []
        }]
      }

      const result = computeDerived(spec)
      
      // Should have validation errors for empty profiles, but no ES-LAG guards
      expect(result.isValid).toBe(false)
      expect(result.guards).toBeDefined()
      
      const esLagGuards = result.guards?.filter(g => g.guardType === 'ES_LAG_INVALID')
      expect(esLagGuards).toHaveLength(0)
    })

    it('should handle legacy mode (no guards expected)', () => {
      const spec: FabricSpec = {
        name: 'test-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: {
          name: 'legacy-profile',
          portsPerEndpoint: 1,
          type: 'server',
          esLag: true,
          nics: 1
        },
        endpointCount: 10
      }

      const result = computeDerived(spec)
      
      expect(result.guards).toBeDefined()
      expect(result.guards).toHaveLength(0)
    })
  })
})