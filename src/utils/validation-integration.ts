/**
 * Validation Integration Utilities - WP-NAV1
 * Integration helpers for existing validation systems (WP-GFD3, WP-EXT1)
 */

import { ValidationIssue, getBadgeForIssues } from '../components/gfd/StatusBadge'
import { StepValidation } from '../components/gfd/StepTab'
import { ValidationMessage } from '../components/gfd/MultiProfileEndpointEditor'
import { BorderValidation } from '../domain/border-validation'

/**
 * Convert MultiProfileEndpointEditor validation messages to navigation issues
 */
export function convertEndpointValidationToIssues(
  validationMessages: ValidationMessage[]
): ValidationIssue[] {
  return validationMessages.map(msg => ({
    type: msg.type,
    message: msg.message,
    field: msg.field,
    suggestion: msg.suggestion
  }))
}

/**
 * Convert BorderValidation results to navigation issues
 */
export function convertBorderValidationToIssues(
  borderValidation: BorderValidation
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check overall status
  if (borderValidation.overallStatus.level === 'error') {
    issues.push({
      type: 'error',
      message: borderValidation.overallStatus.summary,
      field: 'borderValidation'
    })
  } else if (borderValidation.overallStatus.level === 'warning') {
    issues.push({
      type: 'warning',
      message: borderValidation.overallStatus.summary,
      field: 'borderValidation'
    })
  }

  // Add divisibility issues
  if (borderValidation.divisibilityCheck && !borderValidation.divisibilityCheck.valid) {
    issues.push({
      type: borderValidation.divisibilityCheck.severity as 'error' | 'warning',
      message: borderValidation.divisibilityCheck.message || 'Divisibility check failed',
      field: 'divisibility',
      suggestion: borderValidation.divisibilityCheck.recommendations?.join('; ')
    })
  }

  // Add border compatibility issues
  if (borderValidation.borderClassCompatibility && !borderValidation.borderClassCompatibility.compatible) {
    borderValidation.borderClassCompatibility.issues.forEach(issue => {
      issues.push({
        type: 'error',
        message: issue,
        field: 'borderClassCompatibility'
      })
    })

    borderValidation.borderClassCompatibility.warnings.forEach(warning => {
      issues.push({
        type: 'warning',
        message: warning,
        field: 'borderClassCompatibility'
      })
    })
  }

  return issues
}

/**
 * Create step validation state from various validation sources
 */
export function createStepValidation(
  stepId: string,
  validationSources: {
    endpointValidation?: ValidationMessage[]
    borderValidation?: BorderValidation
    customIssues?: ValidationIssue[]
    hasChanged?: boolean
  }
): StepValidation {
  const allIssues: ValidationIssue[] = []

  // Add endpoint validation issues
  if (validationSources.endpointValidation) {
    allIssues.push(...convertEndpointValidationToIssues(validationSources.endpointValidation))
  }

  // Add border validation issues
  if (validationSources.borderValidation) {
    allIssues.push(...convertBorderValidationToIssues(validationSources.borderValidation))
  }

  // Add custom issues
  if (validationSources.customIssues) {
    allIssues.push(...validationSources.customIssues)
  }

  return {
    stepId,
    badge: getBadgeForIssues(allIssues),
    issues: allIssues,
    hasChanged: validationSources.hasChanged ?? false
  }
}

/**
 * Fabric spec validation for basic step
 */
export function validateFabricBasics(fabricSpec: any): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!fabricSpec.name || fabricSpec.name.trim() === '') {
    issues.push({
      type: 'error',
      message: 'Fabric name is required',
      field: 'name',
      suggestion: 'Provide a descriptive name for your fabric'
    })
  } else if (fabricSpec.name.length < 3) {
    issues.push({
      type: 'warning',
      message: 'Fabric name should be at least 3 characters',
      field: 'name',
      suggestion: 'Use a more descriptive name'
    })
  }

  if (!fabricSpec.description || fabricSpec.description.trim() === '') {
    issues.push({
      type: 'warning',
      message: 'Fabric description is recommended',
      field: 'description',
      suggestion: 'Add a description to help identify this fabric'
    })
  }

  // Validate switch models
  if (!fabricSpec.spineModelId) {
    issues.push({
      type: 'error',
      message: 'Spine switch model is required',
      field: 'spineModelId',
      suggestion: 'Select a spine switch model from the catalog'
    })
  }

  if (!fabricSpec.leafModelId) {
    issues.push({
      type: 'error',
      message: 'Leaf switch model is required',
      field: 'leafModelId',
      suggestion: 'Select a leaf switch model from the catalog'
    })
  }

  if (fabricSpec.uplinksPerLeaf && (fabricSpec.uplinksPerLeaf < 1 || fabricSpec.uplinksPerLeaf > 8)) {
    issues.push({
      type: 'error',
      message: 'Uplinks per leaf must be between 1 and 8',
      field: 'uplinksPerLeaf',
      suggestion: 'Adjust uplinks per leaf to a valid range'
    })
  }

  return issues
}

/**
 * Endpoint configuration validation
 */
export function validateEndpointConfiguration(fabricSpec: any): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!fabricSpec.endpointCount || fabricSpec.endpointCount <= 0) {
    issues.push({
      type: 'error',
      message: 'Endpoint count must be greater than 0',
      field: 'endpointCount',
      suggestion: 'Set the number of servers/endpoints to connect'
    })
  } else if (fabricSpec.endpointCount > 1000) {
    issues.push({
      type: 'warning',
      message: 'High endpoint count may require multiple fabrics',
      field: 'endpointCount',
      suggestion: 'Consider splitting into multiple smaller fabrics'
    })
  }

  if (!fabricSpec.endpointProfile || !fabricSpec.endpointProfile.name) {
    issues.push({
      type: 'error',
      message: 'At least one endpoint profile is required',
      field: 'endpointProfile',
      suggestion: 'Create an endpoint profile with server specifications'
    })
  }

  return issues
}

/**
 * Topology validation
 */
export function validateTopologyConfiguration(fabricSpec: any): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check if we have enough information to compute topology
  if (!fabricSpec.spineModelId || !fabricSpec.leafModelId || !fabricSpec.endpointCount) {
    issues.push({
      type: 'error',
      message: 'Incomplete configuration for topology computation',
      suggestion: 'Complete basic configuration and endpoint setup first'
    })
    return issues
  }

  // Validate spine count if computed
  if (fabricSpec.spineCount) {
    if (fabricSpec.spineCount < 2) {
      issues.push({
        type: 'warning',
        message: 'Single spine configuration lacks redundancy',
        field: 'spineCount',
        suggestion: 'Consider using at least 2 spines for redundancy'
      })
    }

    if (fabricSpec.spineCount > 16) {
      issues.push({
        type: 'warning',
        message: 'Very high spine count may be unnecessary',
        field: 'spineCount',
        suggestion: 'Verify topology requirements'
      })
    }
  }

  // Validate oversubscription ratio
  if (fabricSpec.oversubscriptionRatio && fabricSpec.oversubscriptionRatio > 4.0) {
    issues.push({
      type: 'warning',
      message: `High oversubscription ratio: ${fabricSpec.oversubscriptionRatio}:1`,
      field: 'oversubscriptionRatio',
      suggestion: 'Consider adding more spine switches or reducing endpoints'
    })
  }

  return issues
}

/**
 * External connectivity validation
 */
export function validateExternalConnectivity(fabricSpec: any): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!fabricSpec.externalLinks || fabricSpec.externalLinks.length === 0) {
    issues.push({
      type: 'warning',
      message: 'No external links configured',
      field: 'externalLinks',
      suggestion: 'Add external links for connectivity to other networks'
    })
  }

  // Validate border capabilities if present
  if (fabricSpec.borderCapabilities) {
    const caps = fabricSpec.borderCapabilities
    
    if (!caps.routing && !caps.switching) {
      issues.push({
        type: 'error',
        message: 'Border must support either routing or switching',
        field: 'borderCapabilities',
        suggestion: 'Enable at least one border capability'
      })
    }

    if (caps.bgp && !caps.routing) {
      issues.push({
        type: 'error',
        message: 'BGP requires routing capability',
        field: 'borderCapabilities',
        suggestion: 'Enable routing capability for BGP support'
      })
    }
  }

  return issues
}

/**
 * Integration function to validate all steps and return navigation state
 */
export function validateAllSteps(fabricSpec: any): Record<string, StepValidation> {
  return {
    templates: createStepValidation('templates', {
      customIssues: validateFabricBasics(fabricSpec),
      hasChanged: true
    }),
    endpoints: createStepValidation('endpoints', {
      customIssues: validateEndpointConfiguration(fabricSpec),
      hasChanged: !!fabricSpec.endpointCount
    }),
    externals: createStepValidation('externals', {
      customIssues: validateExternalConnectivity(fabricSpec),
      hasChanged: !!(fabricSpec.externalLinks && fabricSpec.externalLinks.length > 0)
    }),
    topology: createStepValidation('topology', {
      customIssues: validateTopologyConfiguration(fabricSpec),
      hasChanged: !!fabricSpec.spineCount
    }),
    review: createStepValidation('review', {
      customIssues: [],
      hasChanged: false
    }),
    deploy: createStepValidation('deploy', {
      customIssues: [],
      hasChanged: false
    })
  }
}

/**
 * Check if save should be blocked based on validation state
 */
export function shouldBlockSave(validationState: Record<string, StepValidation>): boolean {
  return Object.values(validationState).some(step => step.badge === 'error')
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(validationState: Record<string, StepValidation>) {
  const steps = Object.values(validationState)
  const errorSteps = steps.filter(s => s.badge === 'error').length
  const warningSteps = steps.filter(s => s.badge === 'warning').length
  const completedSteps = steps.filter(s => s.badge === 'ok').length
  const pendingSteps = steps.filter(s => s.badge === 'pending').length

  return {
    totalSteps: steps.length,
    errorSteps,
    warningSteps,
    completedSteps,
    pendingSteps,
    overallStatus: errorSteps > 0 ? 'error' : warningSteps > 0 ? 'warning' : 'ok',
    canSave: errorSteps === 0,
    canPromote: errorSteps === 0 && warningSteps === 0
  }
}