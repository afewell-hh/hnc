/**
 * Border Validation System - WP-EXT1
 * Comprehensive validation leveraging WP-GFD3 capability filter
 */

import type { ExternalLink, BorderCapabilities, ExternalLinkAllocation } from './external-link'
import { 
  checkLeafCapability, 
  calculateBreakoutFeasibility, 
  checkDivisibility,
  type CapabilityCheckResult,
  type BreakoutFeasibility,
  type LeafModel
} from './leaf-capability-filter'

export interface BorderValidation {
  capacityCheck: CapabilityCheckResult      // from WP-GFD3 filter
  breakoutFeasibility: BreakoutFeasibility  // from WP-GFD3 filter  
  divisibilityCheck: DivisibilityResult     // warn pre-spine, error post-spine
  borderClassCompatibility: BorderCompatibilityResult
  overallStatus: ValidationStatus
}

export interface DivisibilityResult {
  valid: boolean
  severity: 'error' | 'warning' | 'ok'
  spineCount?: number
  message?: string
  recommendations?: string[]
}

export interface BorderCompatibilityResult {
  compatible: boolean
  issues: string[]
  warnings: string[]
  recommendations: string[]
  capacityUtilization: number  // percentage
}

export interface ValidationStatus {
  level: 'valid' | 'warning' | 'error'
  canSave: boolean
  summary: string
  details: string[]
}

export interface BorderValidationOptions {
  borderLeafModel?: LeafModel
  spineCount?: number  // undefined = pre-spine selection (warnings only)
  strictMode?: boolean // true = error on any issues, false = allow warnings
}

/**
 * Comprehensive border validation for external links
 */
export function validateBorderConfiguration(
  externalLinks: ExternalLink[],
  options: BorderValidationOptions = {}
): BorderValidation {
  const { borderLeafModel, spineCount, strictMode = false } = options

  // If no border model provided, use a default high-capacity one
  const borderModel = borderLeafModel || getDefaultBorderLeafModel()
  const isPostSpineSelection = spineCount !== undefined

  // Convert external links to endpoint profiles for WP-GFD3 validation
  const externalProfiles = externalLinksToEndpointProfiles(externalLinks)
  const totalUplinks = calculateRequiredUplinks(externalLinks, spineCount)

  // 1. Capacity Check using WP-GFD3
  const capacityCheck = checkLeafCapability(borderModel, externalProfiles, totalUplinks)

  // 2. Breakout Feasibility using WP-GFD3
  const breakoutFeasibility = calculateBorderBreakoutFeasibility(
    externalLinks, 
    borderModel
  )

  // 3. Divisibility Check
  const divisibilityCheck = validateExternalDivisibility(
    externalLinks,
    spineCount,
    isPostSpineSelection
  )

  // 4. Border Class Compatibility
  const borderClassCompatibility = validateBorderClassCompatibility(
    externalLinks,
    borderModel,
    totalUplinks
  )

  // 5. Overall Status Assessment
  const overallStatus = determineOverallValidationStatus(
    capacityCheck,
    breakoutFeasibility,
    divisibilityCheck,
    borderClassCompatibility,
    isPostSpineSelection,
    strictMode
  )

  return {
    capacityCheck,
    breakoutFeasibility,
    divisibilityCheck,
    borderClassCompatibility,
    overallStatus
  }
}

/**
 * Convert external links to endpoint profiles for WP-GFD3 validation
 */
function externalLinksToEndpointProfiles(externalLinks: ExternalLink[]) {
  // Convert external links to a format compatible with endpoint profiles
  // This is a bridge between external connectivity and the existing capability filter
  return externalLinks
    .filter(link => link.enabled !== false)
    .map(link => {
      // Calculate effective ports needed
      let totalPorts = 0
      let primarySpeed = '100G'

      if (link.mode === 'target-bandwidth' && link.targetGbps) {
        // Estimate ports needed for capacity validation
        const speedValue = parseSpeed(link.preferredSpeed || '100G')
        totalPorts = Math.ceil(link.targetGbps / speedValue)
        primarySpeed = link.preferredSpeed || '100G'
      } else if (link.explicitPorts) {
        totalPorts = link.explicitPorts.reduce((sum, port) => sum + port.count, 0)
        // Use the first/most common speed as primary
        primarySpeed = link.explicitPorts[0]?.speed || '100G'
      }

      return {
        name: link.name,
        serverCount: 1, // External links are like a single "server" endpoint
        nicCount: totalPorts,
        nicSpeed: primarySpeed,
        lagConfig: { enabled: false } // External links don't use LAG typically
      }
    })
}

/**
 * Calculate required uplinks for border leaf based on external connectivity
 */
function calculateRequiredUplinks(
  externalLinks: ExternalLink[], 
  spineCount?: number
): number {
  if (!spineCount) {
    // Pre-spine selection: assume reasonable default
    return 4
  }

  // Post-spine selection: at least one uplink per spine for redundancy
  return Math.max(spineCount, 4)
}

/**
 * Calculate breakout feasibility for all external links
 */
function calculateBorderBreakoutFeasibility(
  externalLinks: ExternalLink[],
  borderModel: LeafModel
): BreakoutFeasibility {
  let worstCase: BreakoutFeasibility = {
    feasible: true,
    parentPortsRequired: 0,
    childPortsGenerated: 0,
    efficiency: 100,
    constraints: [],
    alternatives: []
  }

  for (const link of externalLinks) {
    if (link.enabled === false) continue

    // Check each port speed requirement
    const portsToCheck = link.mode === 'explicit-ports' 
      ? link.explicitPorts || []
      : link.targetGbps 
        ? [{ speed: link.preferredSpeed || '100G', count: Math.ceil(link.targetGbps / parseSpeed(link.preferredSpeed || '100G')) }]
        : []

    for (const portSpec of portsToCheck) {
      const feasibility = calculateBreakoutFeasibility(
        borderModel,
        portSpec.speed,
        portSpec.count
      )

      // Accumulate constraints and track worst-case feasibility
      if (!feasibility.feasible) {
        worstCase.feasible = false
        worstCase.constraints.push(...feasibility.constraints)
      }

      if (feasibility.efficiency < worstCase.efficiency) {
        worstCase = { ...feasibility }
      }

      worstCase.parentPortsRequired += feasibility.parentPortsRequired
      worstCase.childPortsGenerated += feasibility.childPortsGenerated
    }
  }

  return worstCase
}

/**
 * Validate divisibility of external links across spines
 */
function validateExternalDivisibility(
  externalLinks: ExternalLink[],
  spineCount?: number,
  isPostSpineSelection: boolean = false
): DivisibilityResult {
  if (!spineCount) {
    return {
      valid: true,
      severity: 'ok',
      message: 'Divisibility will be validated after spine selection'
    }
  }

  let worstSeverity: 'error' | 'warning' | 'ok' = 'ok'
  const issues: string[] = []
  const recommendations: string[] = []

  for (const link of externalLinks) {
    if (link.enabled === false) continue

    const portsToCheck = link.mode === 'explicit-ports' 
      ? link.explicitPorts || []
      : link.targetGbps 
        ? [{ speed: link.preferredSpeed || '100G', count: Math.ceil(link.targetGbps / parseSpeed(link.preferredSpeed || '100G')) }]
        : []

    const totalPorts = portsToCheck.reduce((sum, port) => sum + port.count, 0)
    
    const divisibilityResult = checkDivisibility(
      totalPorts,
      spineCount,
      `External link "${link.name}"`
    )

    if (!divisibilityResult.valid && isPostSpineSelection) {
      worstSeverity = 'error'
      issues.push(divisibilityResult.message || `${link.name} cannot be evenly distributed`)
    } else if (divisibilityResult.severity === 'warning') {
      if (worstSeverity === 'ok') worstSeverity = 'warning'
      issues.push(divisibilityResult.message || `${link.name} has distribution inefficiencies`)
      
      // Add recommendations for fixing divisibility
      if (totalPorts % spineCount !== 0) {
        const nextDivisible = Math.ceil(totalPorts / spineCount) * spineCount
        recommendations.push(
          `Consider adjusting ${link.name} to ${nextDivisible} ports for even distribution`
        )
      }
    }
  }

  return {
    valid: worstSeverity !== 'error',
    severity: worstSeverity,
    spineCount,
    message: issues.length > 0 ? issues.join('; ') : 'External links distribute evenly across spines',
    recommendations
  }
}

/**
 * Validate border class compatibility
 */
function validateBorderClassCompatibility(
  externalLinks: ExternalLink[],
  borderModel: LeafModel,
  requiredUplinks: number
): BorderCompatibilityResult {
  const issues: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Calculate total external ports needed
  let totalExternalPorts = 0
  for (const link of externalLinks) {
    if (link.enabled === false) continue

    if (link.mode === 'explicit-ports' && link.explicitPorts) {
      totalExternalPorts += link.explicitPorts.reduce((sum, port) => sum + port.count, 0)
    } else if (link.mode === 'target-bandwidth' && link.targetGbps) {
      const speedValue = parseSpeed(link.preferredSpeed || '100G')
      totalExternalPorts += Math.ceil(link.targetGbps / speedValue)
    }
  }

  const totalPortsUsed = totalExternalPorts + requiredUplinks
  const capacityUtilization = Math.round((totalPortsUsed / borderModel.totalPorts) * 100)

  // Check capacity limits
  if (totalPortsUsed > borderModel.totalPorts) {
    issues.push(`Total ports required (${totalPortsUsed}) exceeds border leaf capacity (${borderModel.totalPorts})`)
  } else if (capacityUtilization > 90) {
    warnings.push(`High port utilization (${capacityUtilization}%) - consider larger border leaf model`)
  } else if (capacityUtilization > 75) {
    warnings.push(`Moderate port utilization (${capacityUtilization}%) - monitor for future growth`)
  }

  // Check speed compatibility
  const requiredSpeeds = new Set<string>()
  for (const link of externalLinks) {
    if (link.mode === 'explicit-ports' && link.explicitPorts) {
      link.explicitPorts.forEach(port => requiredSpeeds.add(port.speed))
    } else if (link.preferredSpeed) {
      requiredSpeeds.add(link.preferredSpeed)
    }
  }

  for (const speed of requiredSpeeds) {
    if (!borderModel.portTypes.includes(speed)) {
      // Check if breakout can provide this speed
      const hasBreakout = Object.values(borderModel.breakoutOptions || {})
        .some(options => options.some(opt => opt.includes(speed)))
      
      if (!hasBreakout) {
        issues.push(`Speed ${speed} not supported by border model ${borderModel.name}`)
      } else {
        warnings.push(`Speed ${speed} requires breakout on border model ${borderModel.name}`)
      }
    }
  }

  // Generate recommendations
  if (capacityUtilization > 85) {
    recommendations.push('Consider DS4000 or equivalent high-capacity border leaf model')
  }
  
  if (requiredSpeeds.has('400G') && !borderModel.portTypes.includes('400G')) {
    recommendations.push('Consider spine-class switch for 400G external connectivity')
  }

  return {
    compatible: issues.length === 0,
    issues,
    warnings,
    recommendations,
    capacityUtilization
  }
}

/**
 * Determine overall validation status
 */
function determineOverallValidationStatus(
  capacityCheck: CapabilityCheckResult,
  breakoutFeasibility: BreakoutFeasibility,
  divisibilityCheck: DivisibilityResult,
  borderCompatibility: BorderCompatibilityResult,
  isPostSpineSelection: boolean,
  strictMode: boolean
): ValidationStatus {
  const errors: string[] = []
  const warnings: string[] = []

  // Collect errors
  if (!capacityCheck.feasible) {
    errors.push(...capacityCheck.errors)
  }
  
  if (!breakoutFeasibility.feasible) {
    errors.push('Breakout requirements cannot be satisfied')
  }
  
  if (!divisibilityCheck.valid && isPostSpineSelection) {
    errors.push(divisibilityCheck.message || 'External links cannot be properly distributed')
  }
  
  if (!borderCompatibility.compatible) {
    errors.push(...borderCompatibility.issues)
  }

  // Collect warnings
  warnings.push(...capacityCheck.warnings)
  warnings.push(...breakoutFeasibility.constraints)
  
  if (divisibilityCheck.severity === 'warning') {
    warnings.push(divisibilityCheck.message || 'External link distribution has inefficiencies')
  }
  
  warnings.push(...borderCompatibility.warnings)

  // Determine level and save capability
  let level: 'valid' | 'warning' | 'error' = 'valid'
  let canSave = true

  if (errors.length > 0) {
    level = 'error'
    canSave = false
  } else if (warnings.length > 0) {
    level = 'warning'
    canSave = !strictMode // In strict mode, warnings prevent save
  }

  // Generate summary
  let summary = ''
  if (level === 'error') {
    summary = `External connectivity has ${errors.length} error(s) that must be resolved`
  } else if (level === 'warning') {
    summary = `External connectivity configured with ${warnings.length} warning(s)`
  } else {
    summary = 'External connectivity properly configured'
  }

  return {
    level,
    canSave,
    summary,
    details: [...errors, ...warnings]
  }
}

/**
 * Get default border leaf model for validation
 */
function getDefaultBorderLeafModel(): LeafModel {
  return {
    id: 'DS3000-Border',
    name: 'Dell DS3000 (Border Configuration)',
    description: '32x100G High-Density Switch optimized for border connectivity',
    totalPorts: 48,
    portTypes: ['100G', '25G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '100G': ['4x25G', '2x50G']
    }
  }
}

/**
 * Parse speed string to numeric value
 */
function parseSpeed(speed: string): number {
  return parseInt(speed.replace('G', ''))
}

/**
 * Validate a single external link allocation
 */
export function validateSingleExternalLink(
  externalLink: ExternalLink,
  options: BorderValidationOptions = {}
): ExternalLinkAllocation & { borderValidation: BorderValidation } {
  // First validate the link itself
  const allocation = validateExternalLink(externalLink, getDefaultBorderCapabilities())
  
  // Then run full border validation
  const borderValidation = validateBorderConfiguration([externalLink], options)

  return {
    ...allocation,
    borderValidation
  }
}

// Re-export for convenience
function validateExternalLink(externalLink: ExternalLink, capabilities?: any): ExternalLinkAllocation {
  // This would import from external-link.ts in real implementation
  // Placeholder for now since we can't circular import
  return {
    externalLink,
    allocatedPorts: [],
    totalBandwidthGbps: 0,
    efficiency: 0,
    portWaste: 0,
    warnings: [],
    errors: []
  }
}

function getDefaultBorderCapabilities() {
  return {
    maxPorts: 32,
    availableSpeeds: ['10G', '25G', '100G', '400G'] as const,
    breakoutCapability: {
      '100G': ['4x25G'],
      '400G': ['4x100G', '16x25G']
    },
    lagSupport: true,
    maxPortsPerLag: 8
  }
}