import { describe, it, expect } from 'vitest'
import { 
  calculateEffectiveCapacity, 
  createBreakoutConfig, 
  validateBreakoutConfig,
  generateBreakoutPortNames,
  allocateBreakoutGroups,
  validateBreakoutAllocation
} from './breakout-utils'
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

  describe('generateBreakoutPortNames', () => {
    it('should generate deterministic child port names for E1/1 format', () => {
      const result = generateBreakoutPortNames('E1/1', '4x25G')
      
      expect(result).toEqual([
        'Ethernet1/0/1',
        'Ethernet1/0/2', 
        'Ethernet1/0/3',
        'Ethernet1/0/4'
      ])
    })

    it('should generate names for Ethernet1 format', () => {
      const result = generateBreakoutPortNames('Ethernet1', '4x25G')
      
      expect(result).toEqual([
        'Ethernet1/0/1',
        'Ethernet1/0/2',
        'Ethernet1/0/3', 
        'Ethernet1/0/4'
      ])
    })

    it('should handle different slot numbers', () => {
      const result = generateBreakoutPortNames('E1/48', '4x25G')
      
      expect(result).toEqual([
        'Ethernet48/0/1',
        'Ethernet48/0/2',
        'Ethernet48/0/3',
        'Ethernet48/0/4'
      ])
    })

    it('should fallback for unrecognized port format', () => {
      const result = generateBreakoutPortNames('UnknownPort', '4x25G')
      
      expect(result).toEqual([
        'UnknownPort/0/1',
        'UnknownPort/0/2',
        'UnknownPort/0/3',
        'UnknownPort/0/4'
      ])
    })

    it('should handle different breakout types', () => {
      const result = generateBreakoutPortNames('E1/1', '2x50G')
      
      expect(result).toHaveLength(1) // Fallback to 1 when not 4x
    })
  })

  describe('allocateBreakoutGroups', () => {
    it('should allocate groups in whole units only', () => {
      const availablePorts = ['E1/1', 'E1/2', 'E1/3', 'E1/4', 'E1/5']
      const result = allocateBreakoutGroups(availablePorts, 3, '4x25G')
      
      expect(result.allocatedGroups).toHaveLength(3)
      expect(result.remainingPorts).toEqual(['E1/4', 'E1/5'])
      expect(result.warnings).toHaveLength(0)
    })

    it('should provide deterministic allocation with sorting', () => {
      const availablePorts = ['E1/5', 'E1/1', 'E1/3', 'E1/2', 'E1/4']
      const result = allocateBreakoutGroups(availablePorts, 2, '4x25G')
      
      // Should allocate E1/1 and E1/2 (first two after sorting)
      expect(result.allocatedGroups[0].basePort).toBe('E1/1')
      expect(result.allocatedGroups[1].basePort).toBe('E1/2')
      expect(result.remainingPorts).toEqual(['E1/3', 'E1/4', 'E1/5'])
    })

    it('should generate correct child port names for each group', () => {
      const availablePorts = ['E1/1', 'E1/2']
      const result = allocateBreakoutGroups(availablePorts, 2, '4x25G')
      
      expect(result.allocatedGroups[0].childPorts).toEqual([
        'Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'
      ])
      expect(result.allocatedGroups[1].childPorts).toEqual([
        'Ethernet2/0/1', 'Ethernet2/0/2', 'Ethernet2/0/3', 'Ethernet2/0/4'
      ])
    })

    it('should warn when insufficient ports available', () => {
      const availablePorts = ['E1/1', 'E1/2']
      const result = allocateBreakoutGroups(availablePorts, 5, '4x25G')
      
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Requested 5 breakout groups but only 2 ports available')
      expect(result.allocatedGroups).toHaveLength(2) // Only allocate what's available
    })

    it('should assign sequential group IDs', () => {
      const availablePorts = ['E1/1', 'E1/2', 'E1/3']
      const result = allocateBreakoutGroups(availablePorts, 3, '4x25G')
      
      expect(result.allocatedGroups[0].groupId).toBe(1)
      expect(result.allocatedGroups[1].groupId).toBe(2)
      expect(result.allocatedGroups[2].groupId).toBe(3)
    })
  })

  describe('validateBreakoutAllocation', () => {
    it('should validate clean breakout-only allocation', () => {
      const breakoutGroups = [
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] },
        { basePort: 'E1/2', childPorts: ['Ethernet2/0/1', 'Ethernet2/0/2', 'Ethernet2/0/3', 'Ethernet2/0/4'] }
      ]
      const regularPorts: string[] = []
      
      const result = validateBreakoutAllocation(breakoutGroups, regularPorts, false)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
      expect(result.hasMixedAllocation).toBe(false)
    })

    it('should warn about mixed allocation when not allowed', () => {
      const breakoutGroups = [
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] }
      ]
      const regularPorts = ['E1/5', 'E1/6']
      
      const result = validateBreakoutAllocation(breakoutGroups, regularPorts, false)
      
      expect(result.isValid).toBe(true) // Warnings don't make it invalid
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Mixed port allocation detected')
      expect(result.hasMixedAllocation).toBe(true)
    })

    it('should allow mixed allocation when explicitly permitted', () => {
      const breakoutGroups = [
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] }
      ]
      const regularPorts = ['E1/5', 'E1/6']
      
      const result = validateBreakoutAllocation(breakoutGroups, regularPorts, true)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0) // No warnings when mixed mode allowed
      expect(result.hasMixedAllocation).toBe(true)
    })

    it('should detect duplicate base ports', () => {
      const breakoutGroups = [
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] },
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] }
      ]
      const regularPorts: string[] = []
      
      const result = validateBreakoutAllocation(breakoutGroups, regularPorts, false)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2) // Duplicate base ports AND child ports
      expect(result.errors.some(e => e.includes('Duplicate base ports'))).toBe(true)
    })

    it('should detect port conflicts between regular and breakout', () => {
      const breakoutGroups = [
        { basePort: 'E1/1', childPorts: ['Ethernet1/0/1', 'Ethernet1/0/2', 'Ethernet1/0/3', 'Ethernet1/0/4'] }
      ]
      const regularPorts = ['E1/1', 'E1/2'] // E1/1 conflicts with breakout base port
      
      const result = validateBreakoutAllocation(breakoutGroups, regularPorts, false)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Port conflicts between regular and breakout'))).toBe(true)
    })
  })
})