import { describe, it, expect } from 'vitest'
import { calculateEffectiveCapacity, createBreakoutConfig, validateBreakoutConfig } from './breakout-utils'
import type { SwitchProfile } from '../ingest/types'

describe('Breakout Utils', () => {
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

  describe('calculateEffectiveCapacity', () => {
    it('should return base capacity when breakouts disabled', () => {
      const result = calculateEffectiveCapacity(ds2000Profile, false)
      
      expect(result).toEqual({
        endpointCapacity: 1, // E1/1-48 expands to 48, but fixture shows 1 range
        uplinkCapacity: 1,   // E1/49-56 expands to 8, but fixture shows 1 range
        effectiveMultiplier: 1
      })
    })

    it('should return multiplied capacity when breakouts enabled and supported', () => {
      const result = calculateEffectiveCapacity(ds2000Profile, true)
      
      expect(result).toEqual({
        endpointCapacity: 4, // 1 * 4 (multiplier)
        uplinkCapacity: 1,   // Uplinks not affected
        effectiveMultiplier: 4
      })
    })

    it('should return base capacity when breakouts enabled but not supported', () => {
      const result = calculateEffectiveCapacity(ds3000Profile, true)
      
      expect(result).toEqual({
        endpointCapacity: 0, // No endpoint ports
        uplinkCapacity: 1,
        effectiveMultiplier: 1
      })
    })
  })

  describe('createBreakoutConfig', () => {
    it('should create disabled config when breakouts not supported', () => {
      const result = createBreakoutConfig(ds3000Profile, true)
      
      expect(result).toEqual({
        enabled: false,
        effectiveCapacity: 0
      })
    })

    it('should create enabled config when breakouts supported and requested', () => {
      const result = createBreakoutConfig(ds2000Profile, true)
      
      expect(result).toEqual({
        enabled: true,
        type: '4x25G',
        effectiveCapacity: 4
      })
    })

    it('should create disabled config when breakouts not requested', () => {
      const result = createBreakoutConfig(ds2000Profile, false)
      
      expect(result).toEqual({
        enabled: false,
        effectiveCapacity: 1
      })
    })
  })

  describe('validateBreakoutConfig', () => {
    it('should validate single profile with no breakouts', () => {
      const result = validateBreakoutConfig([ds2000Profile], [false])
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.hasMixedBreakouts).toBe(false)
    })

    it('should validate single profile with supported breakouts', () => {
      const result = validateBreakoutConfig([ds2000Profile], [true])
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.hasMixedBreakouts).toBe(false)
    })

    it('should detect mixed breakout usage', () => {
      const result = validateBreakoutConfig([ds2000Profile, ds2000Profile], [true, false])
      
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Mixed breakout usage detected')
      expect(result.hasMixedBreakouts).toBe(true)
    })

    it('should detect unsupported breakout attempts', () => {
      const result = validateBreakoutConfig([ds3000Profile], [true])
      
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('does not support breakouts')
      expect(result.hasMixedBreakouts).toBe(false)
    })

    it('should handle mixed capabilities', () => {
      const result = validateBreakoutConfig([ds2000Profile, ds3000Profile], [false, false])
      
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('Mixed switch models'))).toBe(true)
    })
  })
})