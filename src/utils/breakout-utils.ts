/**
 * Breakout Utilities - HNC v0.4
 * Helper functions for breakout capacity calculations and validation
 */

import { SwitchProfile, BreakoutConfig } from '../ingest/types'

/**
 * Calculates effective capacity when breakouts are enabled
 */
export function calculateEffectiveCapacity(
  profile: SwitchProfile,
  breakoutEnabled: boolean = false
): { 
  endpointCapacity: number
  uplinkCapacity: number 
  effectiveMultiplier: number
} {
  const baseEndpointCapacity = profile.ports.endpointAssignable.length
  const baseUplinkCapacity = profile.ports.fabricAssignable.length
  
  if (!breakoutEnabled || !profile.profiles.breakout?.supportsBreakout) {
    return {
      endpointCapacity: baseEndpointCapacity,
      uplinkCapacity: baseUplinkCapacity,
      effectiveMultiplier: 1
    }
  }

  const multiplier = profile.profiles.breakout.capacityMultiplier || 1
  
  return {
    endpointCapacity: baseEndpointCapacity * multiplier,
    uplinkCapacity: baseUplinkCapacity,  // Uplinks typically don't use breakouts
    effectiveMultiplier: multiplier
  }
}

/**
 * Creates breakout configuration from switch profile
 */
export function createBreakoutConfig(
  profile: SwitchProfile,
  enabled: boolean = false
): BreakoutConfig {
  const breakout = profile.profiles.breakout
  
  if (!breakout?.supportsBreakout || !enabled) {
    return {
      enabled: false,
      effectiveCapacity: profile.ports.endpointAssignable.length
    }
  }

  const multiplier = breakout.capacityMultiplier || 1
  
  return {
    enabled: true,
    type: breakout.breakoutType,
    effectiveCapacity: profile.ports.endpointAssignable.length * multiplier
  }
}

/**
 * Validates breakout configuration for mixed-mode warnings
 */
export function validateBreakoutConfig(
  leafProfiles: SwitchProfile[],
  breakoutEnabled: boolean[] = []
): {
  isValid: boolean
  warnings: string[]
  hasMixedBreakouts: boolean
} {
  const warnings: string[] = []
  
  if (leafProfiles.length === 0) {
    return { isValid: true, warnings: [], hasMixedBreakouts: false }
  }

  // Check if all profiles support breakouts consistently
  const supportsBreakout = leafProfiles.map(p => p.profiles.breakout?.supportsBreakout || false)
  const hasBreakoutCapable = supportsBreakout.some(s => s)
  const hasNonBreakoutCapable = supportsBreakout.some(s => !s)
  
  if (hasBreakoutCapable && hasNonBreakoutCapable) {
    warnings.push('Mixed switch models with different breakout capabilities may cause capacity imbalances')
  }

  // Check for mixed breakout usage
  const actuallyEnabled = breakoutEnabled.slice(0, leafProfiles.length)
  const someEnabled = actuallyEnabled.some(e => e)
  const someDisabled = actuallyEnabled.some(e => !e)
  const hasMixedBreakouts = someEnabled && someDisabled

  if (hasMixedBreakouts) {
    warnings.push('Mixed breakout usage detected: some leaves have breakouts enabled, others disabled')
  }

  // Check for enabling breakouts on non-capable switches
  for (let i = 0; i < leafProfiles.length; i++) {
    const profile = leafProfiles[i]
    const enabled = breakoutEnabled[i] || false
    
    if (enabled && !profile.profiles.breakout?.supportsBreakout) {
      warnings.push(`Switch ${profile.modelId} does not support breakouts but breakout is enabled`)
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    hasMixedBreakouts
  }
}

/**
 * Gets breakout display string for UI
 */
export function getBreakoutDisplayString(profile: SwitchProfile): string | null {
  const breakout = profile.profiles.breakout
  if (!breakout?.supportsBreakout) {
    return null
  }
  
  return breakout.breakoutType || 'Breakout Capable'
}

/**
 * Calculates capacity impact from breakout configuration
 */
export function calculateCapacityImpact(
  profile: SwitchProfile,
  enableBreakout: boolean
): {
  baseCapacity: number
  effectiveCapacity: number
  capacityIncrease: number
  percentageIncrease: number
} {
  const baseCapacity = profile.ports.endpointAssignable.length
  const { endpointCapacity } = calculateEffectiveCapacity(profile, enableBreakout)
  const capacityIncrease = endpointCapacity - baseCapacity
  const percentageIncrease = baseCapacity > 0 ? (capacityIncrease / baseCapacity) * 100 : 0

  return {
    baseCapacity,
    effectiveCapacity: endpointCapacity,
    capacityIncrease,
    percentageIncrease
  }
}