/**
 * Leaf Capability Filter - WP-GFD3
 * Core algorithm for filtering leaf models by endpoint requirements and breakout capabilities
 */

import type { EndpointProfile } from '../app.types'

// Re-export for external consumers
export type { EndpointProfile } from '../app.types'

export interface LeafModel {
  id: string
  name: string
  description: string
  ports: LeafPortConfig[]
  uplinks: UplinkConfig[]
  capabilities: LeafCapabilities
}

export interface LeafPortConfig {
  type: 'access' | 'uplink' | 'breakout-parent' | 'breakout-child'
  speed: '10G' | '25G' | '100G' | '400G'
  count: number
  breakoutOptions?: BreakoutOption[]
  medium?: 'copper' | 'fiber' | 'dac'
}

export interface BreakoutOption {
  parentSpeed: '100G' | '400G'
  childSpeed: '10G' | '25G' | '100G'
  childCount: 2 | 4 | 8
  wholeGroupOnly: boolean
}

export interface UplinkConfig {
  speed: '25G' | '100G' | '400G'
  count: number
  maxPerSpine?: number
}

export interface LeafCapabilities {
  maxEndpoints: number
  supportsBreakout: boolean
  supportsMCLAG: boolean
  supportsESLAG: boolean
  lagTypes: ('bundled' | 'mclag' | 'eslag')[]
}

export interface CapabilityCheckResult {
  feasible: boolean
  errors: string[]
  warnings: string[]
  portsUsed: number
  portAllocation: Record<string, number>
  breakoutsUsed: Record<string, number>
  utilizationPercentage: number
}

/**
 * Enhanced breakout feasibility calculation  
 * Returns detailed analysis of port breakout options and constraints
 */
export interface BreakoutFeasibility {
  feasible: boolean
  parentPortsRequired: number
  childPortsGenerated: number
  efficiency: number // percentage of child ports used
  constraints: string[]
  alternatives: BreakoutAlternative[]
}

export interface BreakoutAlternative {
  parentSpeed: string
  breakoutPattern: string
  portsRequired: number
  efficiency: number
  description: string
}

// Simplified leaf model structure for UI compatibility
export interface LeafModel {
  id: string
  name: string
  description: string
  totalPorts: number
  portTypes: string[]
  lagSupport: boolean
  lacpSupport: boolean
  breakoutOptions?: Record<string, string[]>
}

// Default leaf models for testing/demo
export const DEFAULT_LEAF_MODELS: LeafModel[] = [
  {
    id: 'DS2000',
    name: 'Dell DS2000',
    description: '48x25G + 8x100G ToR Switch',
    totalPorts: 56,
    portTypes: ['25G', '100G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '100G': ['4x25G']
    }
  },
  {
    id: 'DS3000', 
    name: 'Dell DS3000',
    description: '32x100G High-Density Switch',
    totalPorts: 48,
    portTypes: ['100G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '100G': ['4x25G', '2x50G']
    }
  },
  {
    id: 'DS4000',
    name: 'Dell DS4000', 
    description: '32x400G Spine/Super-ToR Switch',
    totalPorts: 48,
    portTypes: ['400G', '100G', '25G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '400G': ['4x100G', '8x50G', '16x25G']
    }
  }
]

/**
 * Check if a leaf model can support the given endpoint profiles
 */
export function checkLeafCapability(
  leafModel: LeafModel,
  profiles: EndpointProfile[],
  uplinksPerLeaf: number = 4
): CapabilityCheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const portAllocation: Record<string, number> = {}
  const breakoutsUsed: Record<string, number> = {}

  try {
    // Calculate total ports needed
    const totalEndpoints = profiles.reduce((sum, p) => sum + (p.serverCount * p.nicCount), 0)
    const availableAccessPorts = leafModel.totalPorts - uplinksPerLeaf
    
    // Basic capacity check
    if (totalEndpoints > availableAccessPorts) {
      errors.push(`Insufficient ports: need ${totalEndpoints}, have ${availableAccessPorts} available`)
      return {
        feasible: false,
        errors,
        warnings,
        portsUsed: 0,
        portAllocation: {},
        breakoutsUsed: {},
        utilizationPercentage: 0
      }
    }

    // Port speed compatibility check
    for (const profile of profiles) {
      const speedSupported = leafModel.portTypes.includes(profile.nicSpeed)
      const canBreakout = leafModel.breakoutOptions && Object.values(leafModel.breakoutOptions)
        .some(options => options.some(opt => opt.includes(profile.nicSpeed)))
      
      if (!speedSupported && !canBreakout) {
        errors.push(`${profile.nicSpeed} not supported on ${leafModel.name}`)
      } else {
        // Track port allocation
        const profilePorts = profile.serverCount * profile.nicCount
        if (speedSupported) {
          portAllocation[profile.nicSpeed] = (portAllocation[profile.nicSpeed] || 0) + profilePorts
        } else if (canBreakout) {
          // Find breakout option
          for (const [parentSpeed, options] of Object.entries(leafModel.breakoutOptions || {})) {
            const breakoutOption = options.find(opt => opt.includes(profile.nicSpeed))
            if (breakoutOption) {
              const breakoutFactor = parseInt(breakoutOption.split('x')[0]) || 1
              const parentPortsNeeded = Math.ceil(profilePorts / breakoutFactor)
              breakoutsUsed[`${parentSpeed}->${profile.nicSpeed}`] = parentPortsNeeded
              break
            }
          }
        }
      }
      
      // LAG compatibility warnings
      if (profile.lagConfig?.enabled) {
        if (profile.lagConfig.mclag && !leafModel.lagSupport) {
          warnings.push(`MC-LAG requested for ${profile.name} but model has limited support`)
        }
        if (!leafModel.lacpSupport) {
          warnings.push(`LACP requested for ${profile.name} but not supported`)
        }
      }
    }

    // Divisibility warnings for uplinks
    if (uplinksPerLeaf > 0) {
      const maxUplinks = Math.floor(leafModel.totalPorts * 0.3) // Assume ~30% for uplinks
      if (uplinksPerLeaf > maxUplinks) {
        warnings.push(`${uplinksPerLeaf} uplinks may exceed typical ratio for this model`)
      }
    }

    const portsUsed = totalEndpoints + uplinksPerLeaf
    const utilizationPercentage = Math.round((portsUsed / leafModel.totalPorts) * 100)

    return {
      feasible: errors.length === 0,
      errors,
      warnings,
      portsUsed,
      portAllocation,
      breakoutsUsed,
      utilizationPercentage
    }

  } catch (error) {
    errors.push(`Capability check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      feasible: false,
      errors,
      warnings,
      portsUsed: 0,
      portAllocation: {},
      breakoutsUsed: {},
      utilizationPercentage: 0
    }
  }
}

/**
 * Filter leaf models to show only viable ones
 */
export function filterViableLeafModels(
  leafModels: LeafModel[],
  profiles: EndpointProfile[],
  uplinksPerLeaf: number = 4,
  showAll: boolean = false
): { viable: LeafModel[]; nonViable: Array<{ model: LeafModel; result: CapabilityCheckResult }> } {
  const viable: LeafModel[] = []
  const nonViable: Array<{ model: LeafModel; result: CapabilityCheckResult }> = []

  leafModels.forEach(model => {
    const result = checkLeafCapability(model, profiles, uplinksPerLeaf)
    
    if (result.feasible) {
      viable.push(model)
    } else {
      nonViable.push({ model, result })
    }
  })

  return { viable, nonViable }
}

/**
 * Calculate breakout feasibility for endpoint requirements
 */
export function calculateBreakoutFeasibility(
  leafModel: LeafModel,
  targetSpeed: string,
  portsNeeded: number
): BreakoutFeasibility {
  const result: BreakoutFeasibility = {
    feasible: false,
    parentPortsRequired: 0,
    childPortsGenerated: 0,
    efficiency: 0,
    constraints: [],
    alternatives: []
  }

  if (!leafModel.breakoutOptions) {
    result.constraints.push('No breakout options available on this model')
    return result
  }

  // Find all possible breakout patterns for target speed
  const breakoutCandidates: BreakoutAlternative[] = []

  Object.entries(leafModel.breakoutOptions).forEach(([parentSpeed, patterns]) => {
    patterns.forEach(pattern => {
      if (pattern.includes(targetSpeed)) {
        const breakoutFactor = parseInt(pattern.split('x')[0]) || 1
        const parentPortsRequired = Math.ceil(portsNeeded / breakoutFactor)
        const childPortsGenerated = parentPortsRequired * breakoutFactor
        const efficiency = Math.round((portsNeeded / childPortsGenerated) * 100)
        
        breakoutCandidates.push({
          parentSpeed,
          breakoutPattern: pattern,
          portsRequired: parentPortsRequired,
          efficiency,
          description: `Break ${parentPortsRequired}x${parentSpeed} to ${childPortsGenerated}x${targetSpeed}`
        })
      }
    })
  })

  if (breakoutCandidates.length === 0) {
    result.constraints.push(`No breakout options available for ${targetSpeed} on this model`)
    return result
  }

  // Find best (most efficient) option
  const bestOption = breakoutCandidates.reduce((best, current) => 
    current.efficiency > best.efficiency ? current : best
  )

  // Check if we have enough parent ports
  const availableParentPorts = leafModel.totalPorts // Simplified assumption
  const canAffordBreakout = bestOption.portsRequired <= availableParentPorts

  if (!canAffordBreakout) {
    result.constraints.push(`Insufficient ${bestOption.parentSpeed} ports: need ${bestOption.portsRequired}, have ${availableParentPorts}`)
  }

  // Calculate divisibility warnings
  const wastedPorts = bestOption.portsRequired * parseInt(bestOption.breakoutPattern.split('x')[0]) - portsNeeded
  if (wastedPorts > 0 && wastedPorts >= portsNeeded * 0.5) {
    result.constraints.push(`High waste: ${wastedPorts} unused child ports (${Math.round(wastedPorts/portsNeeded*100)}% overhead)`)
  }

  result.feasible = canAffordBreakout
  result.parentPortsRequired = bestOption.portsRequired
  result.childPortsGenerated = bestOption.portsRequired * parseInt(bestOption.breakoutPattern.split('x')[0])
  result.efficiency = bestOption.efficiency
  result.alternatives = breakoutCandidates

  return result
}

/**
 * Enhanced divisibility check with warnings vs errors
 */
export function checkDivisibility(
  value: number,
  divisor: number,
  context: string
): { valid: boolean; severity: 'error' | 'warning' | 'ok'; message?: string } {
  if (divisor === 0) {
    return {
      valid: false,
      severity: 'error',
      message: `${context}: Division by zero is not allowed`
    }
  }

  if (value % divisor === 0) {
    return {
      valid: true,
      severity: 'ok'
    }
  }

  const remainder = value % divisor
  const wastePercentage = (remainder / value) * 100

  if (wastePercentage > 50) {
    return {
      valid: false,
      severity: 'error', 
      message: `${context}: ${remainder} wasted units (${Math.round(wastePercentage)}% waste) - too inefficient`
    }
  }

  if (wastePercentage > 20) {
    return {
      valid: true,
      severity: 'warning',
      message: `${context}: ${remainder} wasted units (${Math.round(wastePercentage)}% waste) - consider adjustment`
    }
  }

  return {
    valid: true,
    severity: 'warning',
    message: `${context}: ${remainder} wasted units (${Math.round(wastePercentage)}% waste) - minor inefficiency`
  }
}

/**
 * Get capability summary for UI display
 */
export function getCapabilitySummary(
  result: CapabilityCheckResult
): { status: 'viable' | 'warning' | 'error'; summary: string; details: string[] } {
  if (!result.feasible) {
    return {
      status: 'error',
      summary: `Not viable (${result.errors.length} issues)`,
      details: result.errors
    }
  }

  if (result.warnings.length > 0) {
    return {
      status: 'warning',
      summary: `Viable with warnings (${result.warnings.length})`,
      details: result.warnings
    }
  }

  const remainingPorts = 100 - result.utilizationPercentage
  return {
    status: 'viable',
    summary: `Viable (${remainingPorts}% capacity remaining)`,
    details: []
  }
}

