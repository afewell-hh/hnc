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

/**
 * Generates deterministic child port names for breakout configurations
 * Uses whole-group allocation (4 ports per breakout group)
 */
export function generateBreakoutPortNames(
  basePort: string,
  breakoutType: string = '4x25G'
): string[] {
  const childPorts: string[] = []
  const multiplier = breakoutType.startsWith('4x') ? 4 : 1
  
  // Parse base port format (e.g., "E1/48" -> slot=1, port=48)
  const ethernetMatch = basePort.match(/^E(\d+)\/(\d+)$/)
  if (ethernetMatch) {
    const [, slot, portNum] = ethernetMatch
    const portNumber = parseInt(portNum, 10)
    
    // Generate child ports using deterministic naming scheme
    for (let i = 1; i <= multiplier; i++) {
      // Use format: Ethernet{portNum}/0/{child} for breakout ports
      childPorts.push(`Ethernet${portNumber}/0/${i}`)
    }
  } else {
    // Try alternative format "Ethernet{N}"
    const ethernetAltMatch = basePort.match(/^Ethernet(\d+)$/)
    if (ethernetAltMatch) {
      const [, portNum] = ethernetAltMatch
      const portNumber = parseInt(portNum, 10)
      
      for (let i = 1; i <= multiplier; i++) {
        childPorts.push(`Ethernet${portNumber}/0/${i}`)
      }
    } else {
      // Fallback for unrecognized formats
      for (let i = 1; i <= multiplier; i++) {
        childPorts.push(`${basePort}/0/${i}`)
      }
    }
  }
  
  return childPorts
}

/**
 * Allocates breakout ports in whole groups (4-port groups)
 * Ensures deterministic allocation for consistent wiring generation
 */
export function allocateBreakoutGroups(
  availablePorts: string[],
  requiredGroups: number,
  breakoutType: string = '4x25G'
): {
  allocatedGroups: Array<{
    basePort: string
    childPorts: string[]
    groupId: number
  }>
  remainingPorts: string[]
  warnings: string[]
} {
  const groupSize = breakoutType.startsWith('4x') ? 4 : 1
  const allocatedGroups: Array<{
    basePort: string
    childPorts: string[]
    groupId: number
  }> = []
  const warnings: string[] = []
  const usedPorts = new Set<string>()
  
  // Sort ports for deterministic allocation
  const sortedPorts = [...availablePorts].sort()
  
  if (requiredGroups > sortedPorts.length) {
    warnings.push(`Requested ${requiredGroups} breakout groups but only ${sortedPorts.length} ports available`)
  }
  
  // Allocate whole groups only
  let groupId = 1
  for (let i = 0; i < Math.min(requiredGroups, sortedPorts.length); i++) {
    const basePort = sortedPorts[i]
    if (usedPorts.has(basePort)) continue
    
    const childPorts = generateBreakoutPortNames(basePort, breakoutType)
    
    allocatedGroups.push({
      basePort,
      childPorts,
      groupId: groupId++
    })
    
    usedPorts.add(basePort)
  }
  
  const remainingPorts = sortedPorts.filter(port => !usedPorts.has(port))
  
  return {
    allocatedGroups,
    remainingPorts,
    warnings
  }
}

/**
 * Validates breakout port allocation for mixed-mode detection
 */
export function validateBreakoutAllocation(
  breakoutGroups: Array<{ basePort: string; childPorts: string[] }>,
  regularPorts: string[],
  allowMixedMode: boolean = false
): {
  isValid: boolean
  warnings: string[]
  errors: string[]
  hasMixedAllocation: boolean
} {
  const warnings: string[] = []
  const errors: string[] = []
  const hasBreakoutPorts = breakoutGroups.length > 0
  const hasRegularPorts = regularPorts.length > 0
  const hasMixedAllocation = hasBreakoutPorts && hasRegularPorts
  
  if (hasMixedAllocation && !allowMixedMode) {
    warnings.push(
      'Mixed port allocation detected: Some ports use breakouts while others use regular allocation. ' +
      'This may cause capacity imbalances and wiring complexity.'
    )
  }
  
  // Check for port conflicts
  const allBasePorts = breakoutGroups.map(g => g.basePort)
  const allChildPorts = breakoutGroups.flatMap(g => g.childPorts)
  const duplicateBasePorts = findDuplicates(allBasePorts)
  const duplicateChildPorts = findDuplicates(allChildPorts)
  
  if (duplicateBasePorts.length > 0) {
    errors.push(`Duplicate base ports in breakout allocation: ${duplicateBasePorts.join(', ')}`)
  }
  
  if (duplicateChildPorts.length > 0) {
    errors.push(`Duplicate child ports in breakout allocation: ${duplicateChildPorts.join(', ')}`)
  }
  
  // Check for overlapping port names between regular and breakout
  const regularPortSet = new Set(regularPorts)
  const conflictingPorts = allBasePorts.filter(port => regularPortSet.has(port))
  
  if (conflictingPorts.length > 0) {
    errors.push(`Port conflicts between regular and breakout allocation: ${conflictingPorts.join(', ')}`)
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    hasMixedAllocation
  }
}

/**
 * Helper function to find duplicate values in an array
 */
function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item)
    }
    seen.add(item)
  }
  
  return Array.from(duplicates)
}