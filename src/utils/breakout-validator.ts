/**
 * Breakout Validation Utilities - HNC v0.4
 * Validates breakout configurations and detects mixed-mode issues
 */

import { FabricSpec, LeafClass, Issue } from '../app.types'
import { SwitchProfile } from '../ingest/types'

export interface BreakoutValidationResult {
  isValid: boolean
  issues: Issue[]
  hasMixedBreakouts: boolean
  hasUnsupportedBreakouts: boolean
}

/**
 * Validates breakout configuration across a fabric specification
 */
export function validateBreakoutConfiguration(
  fabricSpec: FabricSpec,
  switchProfiles: Map<string, SwitchProfile>
): BreakoutValidationResult {
  const issues: Issue[] = []
  let hasMixedBreakouts = false
  let hasUnsupportedBreakouts = false

  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode validation
    const breakoutStates = fabricSpec.leafClasses.map((lc, index) => ({
      classId: lc.id,
      enabled: lc.breakoutEnabled || false,
      modelId: lc.leafModelId || fabricSpec.leafModelId,
      index
    }))

    // Check for mixed breakout usage
    const someEnabled = breakoutStates.some(s => s.enabled)
    const someDisabled = breakoutStates.some(s => !s.enabled)
    hasMixedBreakouts = someEnabled && someDisabled

    if (hasMixedBreakouts) {
      issues.push({
        id: 'mixed-breakout-usage',
        type: 'warning',
        severity: 'medium',
        title: 'Mixed Breakout Usage',
        message: 'Some leaf classes have breakouts enabled while others do not. This may cause capacity imbalances.',
        category: 'validation',
        overridable: true
      })
    }

    // Check each class for unsupported breakout attempts
    for (const state of breakoutStates) {
      if (state.enabled) {
        const profile = switchProfiles.get(state.modelId)
        const supportsBreakout = profile?.profiles.breakout?.supportsBreakout || false
        
        if (!supportsBreakout) {
          hasUnsupportedBreakouts = true
          issues.push({
            id: `unsupported-breakout-${state.classId}`,
            type: 'error',
            severity: 'high',
            title: 'Unsupported Breakout',
            message: `Leaf class '${state.classId}' using model ${state.modelId} does not support breakouts but breakout is enabled.`,
            field: `leafClasses.${state.index}.breakoutEnabled`,
            category: 'validation',
            overridable: false
          })
        }
      }
    }
  } else {
    // Legacy single-class mode validation
    if (fabricSpec.breakoutEnabled) {
      const profile = switchProfiles.get(fabricSpec.leafModelId)
      const supportsBreakout = profile?.profiles.breakout?.supportsBreakout || false
      
      if (!supportsBreakout) {
        hasUnsupportedBreakouts = true
        issues.push({
          id: 'unsupported-breakout-legacy',
          type: 'error',
          severity: 'high',
          title: 'Unsupported Breakout',
          message: `Switch model ${fabricSpec.leafModelId} does not support breakouts but breakout is enabled.`,
          field: 'breakoutEnabled',
          category: 'validation',
          overridable: false
        })
      }
    }
  }

  return {
    isValid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    hasMixedBreakouts,
    hasUnsupportedBreakouts
  }
}

/**
 * Generates capacity impact warnings for breakout configurations
 */
export function generateCapacityWarnings(
  fabricSpec: FabricSpec,
  switchProfiles: Map<string, SwitchProfile>
): Issue[] {
  const warnings: Issue[] = []

  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode: check for significant capacity differences
    const classCapacities: { classId: string; capacity: number; multiplier: number }[] = []
    
    for (const leafClass of fabricSpec.leafClasses) {
      const modelId = leafClass.leafModelId || fabricSpec.leafModelId
      const profile = switchProfiles.get(modelId)
      const baseCapacity = 48 - leafClass.uplinksPerLeaf // DS2000 hardcode
      
      let effectiveCapacity = baseCapacity
      let multiplier = 1
      
      if (leafClass.breakoutEnabled && profile?.profiles.breakout?.supportsBreakout) {
        multiplier = profile.profiles.breakout.capacityMultiplier || 4
        effectiveCapacity = baseCapacity * multiplier
      }
      
      classCapacities.push({
        classId: leafClass.id,
        capacity: effectiveCapacity,
        multiplier
      })
    }

    // Check for significant capacity imbalances
    if (classCapacities.length > 1) {
      const minCapacity = Math.min(...classCapacities.map(c => c.capacity))
      const maxCapacity = Math.max(...classCapacities.map(c => c.capacity))
      
      if (maxCapacity > minCapacity * 2) {
        const lowClasses = classCapacities.filter(c => c.capacity === minCapacity).map(c => c.classId)
        const highClasses = classCapacities.filter(c => c.capacity === maxCapacity).map(c => c.classId)
        
        warnings.push({
          id: 'capacity-imbalance',
          type: 'warning',
          severity: 'medium',
          title: 'Capacity Imbalance',
          message: `Significant capacity difference detected. Classes [${lowClasses.join(', ')}] have ${minCapacity} ports while [${highClasses.join(', ')}] have ${maxCapacity} ports.`,
          category: 'optimization',
          overridable: true
        })
      }
    }
  }

  return warnings
}

/**
 * Provides breakout recommendations based on fabric configuration
 */
export function generateBreakoutRecommendations(
  fabricSpec: FabricSpec,
  switchProfiles: Map<string, SwitchProfile>
): Issue[] {
  const recommendations: Issue[] = []

  // Check if breakouts could help with high port utilization
  const leafProfile = switchProfiles.get(fabricSpec.leafModelId)
  if (!leafProfile?.profiles.breakout?.supportsBreakout) {
    return recommendations
  }

  if (fabricSpec.endpointCount && fabricSpec.uplinksPerLeaf) {
    const baseCapacity = 48 - fabricSpec.uplinksPerLeaf
    const currentUtilization = fabricSpec.endpointCount / baseCapacity
    
    if (currentUtilization > 0.8 && !fabricSpec.breakoutEnabled) {
      const withBreakouts = baseCapacity * 4
      const newUtilization = fabricSpec.endpointCount / withBreakouts
      
      recommendations.push({
        id: 'consider-breakouts',
        type: 'info',
        severity: 'low',
        title: 'Consider Breakouts',
        message: `High port utilization detected (${(currentUtilization * 100).toFixed(1)}%). Enabling 4x25G breakouts would reduce utilization to ${(newUtilization * 100).toFixed(1)}%.`,
        category: 'optimization',
        overridable: true
      })
    }
  }

  return recommendations
}