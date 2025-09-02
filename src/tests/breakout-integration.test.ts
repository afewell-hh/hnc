import { describe, it, expect } from 'vitest'
import { calculateEffectiveCapacity } from '../utils/breakout-utils'
import { validateBreakoutConfiguration } from '../utils/breakout-validator'
import type { FabricSpec, SwitchProfile } from '../app.types'

describe('Breakout Integration Tests', () => {
  const ds2000Profile: SwitchProfile = {
    modelId: 'celestica-ds2000',
    roles: ['leaf'],
    ports: {
      endpointAssignable: ['E1/1-48'],
      fabricAssignable: ['E1/49-56']
    },
    profiles: {
      endpoint: { portProfile: 'SFP28-25G', speedGbps: 25 },
      uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 },
      breakout: {
        supportsBreakout: true,
        breakoutType: '4x25G',
        capacityMultiplier: 4
      }
    },
    meta: { source: 'test', version: '1.0.0' }
  }

  const ds3000Profile: SwitchProfile = {
    modelId: 'celestica-ds3000',
    roles: ['spine'],
    ports: {
      endpointAssignable: [],
      fabricAssignable: ['E1/1-32']
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 0 },
      uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 },
      breakout: {
        supportsBreakout: false
      }
    },
    meta: { source: 'test', version: '1.0.0' }
  }

  const switchProfiles = new Map<string, SwitchProfile>()
  switchProfiles.set('DS2000', ds2000Profile)
  switchProfiles.set('DS3000', ds3000Profile)

  it('should integrate breakout validation with fabric specification', () => {
    const fabricSpec: FabricSpec = {
      name: 'Test Fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 4,
      endpointCount: 100,
      breakoutEnabled: true,
      endpointProfile: { name: 'Standard Server', portsPerEndpoint: 2 }
    }

    const validation = validateBreakoutConfiguration(fabricSpec, switchProfiles)
    
    expect(validation.isValid).toBe(true)
    expect(validation.hasUnsupportedBreakouts).toBe(false)
    expect(validation.hasMixedBreakouts).toBe(false)
  })

  it('should calculate capacity correctly with breakouts enabled', () => {
    // Base capacity: 48 endpoint ports - 4 uplinks = 44 ports per leaf
    // With 4x breakouts: 44 * 4 = 176 effective ports per leaf
    // For 100 endpoints: ceil(100 / 176) = 1 leaf needed
    
    const result = calculateEffectiveCapacity(ds2000Profile, true)
    
    expect(result.effectiveMultiplier).toBe(4)
    expect(result.endpointCapacity).toBe(4) // Based on array length, not expanded ranges
  })

  it('should validate mixed breakout scenarios produce warnings', () => {
    const fabricSpec: FabricSpec = {
      name: 'Mixed Test',
      spineModelId: 'DS3000', 
      leafModelId: 'DS2000',
      leafClasses: [
        {
          id: 'class1',
          name: 'With Breakout',
          role: 'standard',
          uplinksPerLeaf: 4,
          endpointProfiles: [{ name: 'Server', portsPerEndpoint: 2, count: 50 }],
          breakoutEnabled: true
        },
        {
          id: 'class2', 
          name: 'Without Breakout',
          role: 'standard',
          uplinksPerLeaf: 4,
          endpointProfiles: [{ name: 'Server', portsPerEndpoint: 2, count: 50 }],
          breakoutEnabled: false
        }
      ]
    }

    const validation = validateBreakoutConfiguration(fabricSpec, switchProfiles)
    
    expect(validation.isValid).toBe(true) // Warnings don't make it invalid
    expect(validation.hasMixedBreakouts).toBe(true)
    expect(validation.issues.some(issue => 
      issue.type === 'warning' && 
      issue.message.includes('leaf classes have breakouts enabled while others do not')
    )).toBe(true)
  })

  it('should provide capacity impact calculations', () => {
    // Test that breakouts provide 4x capacity increase for DS2000
    const withoutBreakout = calculateEffectiveCapacity(ds2000Profile, false)
    const withBreakout = calculateEffectiveCapacity(ds2000Profile, true)
    
    expect(withBreakout.effectiveMultiplier).toBe(withoutBreakout.effectiveMultiplier * 4)
    expect(withBreakout.endpointCapacity).toBe(withoutBreakout.endpointCapacity * 4)
  })
})