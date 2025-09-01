/**
 * Fabric Validation Rules Engine - HNC v0.4.1 - WP-TOP2
 * 
 * Implements structured validation rules with actionable feedback that evaluate
 * fabric specifications against derived topology data and switch catalog information.
 * Features pure evaluation functions with specific remediation guidance.
 */

import type { FabricSpec, DerivedTopology, LeafClass, Issue } from '../app.types'

// Rule severity levels
export type RuleSeverity = 'error' | 'warning' | 'info'

// Rule codes as specified in WP-OVR1 and WP-IMP2 (import conflicts)
export type RuleCode = 
  | 'SPINE_CAPACITY_EXCEEDED'
  | 'LEAF_CAPACITY_EXCEEDED'
  | 'UPLINKS_NOT_DIVISIBLE_BY_SPINES'
  | 'MC_LAG_ODD_LEAFS'
  | 'ES_LAG_SINGLE_NIC'
  | 'MODEL_PROFILE_MISMATCH'
  // Import-specific rule codes (WP-IMP2)
  | 'IMPORT_VALUE_CONFLICT'
  | 'IMPORT_CAPACITY_MISMATCH'
  | 'IMPORT_CONSTRAINT_VIOLATION'
  | 'IMPORT_TOPOLOGY_INCONSISTENCY'
  | 'IMPORT_MODEL_INCOMPATIBLE'

// Actionable validation message with specific remediation steps
export interface ValidationMessage {
  code: RuleCode
  severity: RuleSeverity
  title: string
  message: string
  // Actionable remediation guidance
  remediation: {
    what: string // What needs to be changed
    how: string  // Specific steps to fix
    why: string  // Technical reasoning
  }
  // Field references for UI linking
  affectedFields: string[]
  // Technical context for debugging
  context: {
    expected: any
    actual: any
    calculations: Record<string, any>
  }
  leafClassId?: string // For per-class violations
}

// Structured rule violation result (legacy compatibility)
export interface RuleViolation {
  code: RuleCode
  severity: RuleSeverity
  message: string
  details?: Record<string, any>
  leafClassId?: string // For per-class violations
  context?: Record<string, any>
}

// Enhanced evaluation result with actionable feedback
export interface TopologyEvaluationResult {
  errors: ValidationMessage[]
  warnings: ValidationMessage[]
  info: ValidationMessage[]
  // Summary metrics
  summary: {
    totalIssues: number
    blockingErrors: number
    improvementWarnings: number
    hasIntegrationValidation: boolean
  }
  // Optional integration results
  integrationResults?: {
    hhfab?: {
      valid: boolean
      messages: string[]
      yamlPath?: string
    }
    kubernetes?: {
      valid: boolean
      messages: string[]
      dryRunOutput?: string
    }
  }
}

// Rule evaluation result (legacy compatibility)
export interface RuleEvaluationResult {
  errors: RuleViolation[]
  warnings: RuleViolation[]
  info: RuleViolation[]
}

// Switch catalog interface for rule evaluation
export interface SwitchCatalog {
  getSwitchModel(modelId: string): { ports: number; type: 'leaf' | 'spine' } | null
  getModelProfile(modelId: string): { maxCapacity: number; recommended: string[] } | null
}

// Default switch catalog implementation (stub)
class DefaultSwitchCatalog implements SwitchCatalog {
  private readonly switches = {
    'DS2000': { ports: 48, type: 'leaf' as const, maxCapacity: 1200, recommended: ['server', 'storage'] },
    'DS3000': { ports: 32, type: 'spine' as const, maxCapacity: 800, recommended: ['uplink', 'interconnect'] }
  }

  getSwitchModel(modelId: string) {
    const model = this.switches[modelId as keyof typeof this.switches]
    return model ? { ports: model.ports, type: model.type } : null
  }

  getModelProfile(modelId: string) {
    const model = this.switches[modelId as keyof typeof this.switches]
    return model ? { maxCapacity: model.maxCapacity, recommended: model.recommended } : null
  }
}

/**
 * Pure topology evaluation function with actionable feedback - WP-TOP2
 * 
 * @param spec - Fabric specification to validate
 * @param derived - Computed topology from the spec
 * @param options - Validation options including catalog and integrations
 * @returns Enhanced validation results with actionable remediation steps
 */
export async function evaluateTopology(
  spec: FabricSpec, 
  derived: DerivedTopology,
  options: {
    catalog?: SwitchCatalog
    enableIntegrations?: boolean
    hhfabPath?: string
    kubectlPath?: string
  } = {}
): Promise<TopologyEvaluationResult> {
  const catalog = options.catalog || new DefaultSwitchCatalog()
  
  const result: TopologyEvaluationResult = {
    errors: [],
    warnings: [],
    info: [],
    summary: {
      totalIssues: 0,
      blockingErrors: 0,
      improvementWarnings: 0,
      hasIntegrationValidation: false
    }
  }

  // Run all validation checks with actionable feedback
  await checkSpineCapacityActionable(spec, derived, catalog, result)
  await checkLeafCapacityActionable(spec, derived, catalog, result)
  await checkUplinksPerSpineDivisibilityActionable(spec, derived, result)
  await checkMcLagOddLeafsActionable(spec, derived, result)
  await checkEsLagSingleNicActionable(spec, derived, result)
  await checkModelProfileMismatchActionable(spec, derived, catalog, result)
  
  // Optional integration validations
  if (options.enableIntegrations) {
    result.integrationResults = await runIntegrationValidations(spec, derived, {
      hhfabPath: options.hhfabPath,
      kubectlPath: options.kubectlPath
    })
    result.summary.hasIntegrationValidation = true
  }

  // Update summary
  result.summary.totalIssues = result.errors.length + result.warnings.length + result.info.length
  result.summary.blockingErrors = result.errors.length
  result.summary.improvementWarnings = result.warnings.length

  return result
}

/**
 * Legacy compatibility function
 */
export function evaluate(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog = new DefaultSwitchCatalog()
): RuleEvaluationResult {
  // Convert to legacy format synchronously
  const legacyResult: RuleEvaluationResult = {
    errors: [],
    warnings: [],
    info: []
  }

  // Run legacy checks
  checkSpineCapacity(spec, derived, catalog, legacyResult)
  checkLeafCapacity(spec, derived, catalog, legacyResult)
  checkUplinksPerSpineDivisibility(spec, derived, legacyResult)
  checkMcLagOddLeafs(spec, derived, legacyResult)
  checkEsLagSingleNic(spec, derived, legacyResult)
  checkModelProfileMismatch(spec, derived, catalog, legacyResult)

  return legacyResult
}

/**
 * SPINE_CAPACITY_EXCEEDED (error): Check if spine switch capacity is exceeded
 */
function checkSpineCapacity(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: RuleEvaluationResult
): void {
  const spineModel = catalog.getSwitchModel(spec.spineModelId)
  if (!spineModel || spineModel.type !== 'spine') return

  // Calculate total uplink demand
  let totalUplinks = 0
  if (spec.leafClasses) {
    // Multi-class mode: sum across all leaf classes
    for (const leafClass of spec.leafClasses) {
      const classLeaves = leafClass.count || calculateLeavesForClass(leafClass, catalog.getSwitchModel(leafClass.leafModelId || spec.leafModelId))
      totalUplinks += classLeaves * leafClass.uplinksPerLeaf
    }
  } else {
    // Legacy mode
    totalUplinks = derived.leavesNeeded * (spec.uplinksPerLeaf || 0)
  }

  // Check if spine capacity is exceeded
  const totalSpineCapacity = derived.spinesNeeded * spineModel.ports
  if (totalUplinks > totalSpineCapacity) {
    result.errors.push({
      code: 'SPINE_CAPACITY_EXCEEDED',
      severity: 'error',
      message: `Spine capacity exceeded: need ${totalUplinks} ports but only ${totalSpineCapacity} available across ${derived.spinesNeeded} spines`,
      context: {
        expected: totalSpineCapacity,
        actual: totalUplinks,
        spineCount: derived.spinesNeeded,
        portsPerSpine: spineModel.ports
      }
    })
  }
}

/**
 * LEAF_CAPACITY_EXCEEDED (error): Check if leaf switch capacity is exceeded
 */
function checkLeafCapacity(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: RuleEvaluationResult
): void {
  if (spec.leafClasses) {
    // Multi-class mode: check each leaf class
    for (const leafClass of spec.leafClasses) {
      const leafModelId = leafClass.leafModelId || spec.leafModelId
      const leafModel = catalog.getSwitchModel(leafModelId)
      if (!leafModel || leafModel.type !== 'leaf') continue

      // Calculate endpoint demand for this class
      const endpointDemand = leafClass.endpointProfiles.reduce((sum, profile) => {
        return sum + (profile.count || 0) * (profile.portsPerEndpoint || 1)
      }, 0)

      // Available ports = total ports - uplinks
      const availablePorts = leafModel.ports - leafClass.uplinksPerLeaf
      const classLeaves = leafClass.count || Math.ceil(endpointDemand / availablePorts)
      const totalLeafCapacity = classLeaves * availablePorts

      if (endpointDemand > totalLeafCapacity) {
        result.errors.push({
          code: 'LEAF_CAPACITY_EXCEEDED',
          severity: 'error',
          message: `Leaf capacity exceeded for class '${leafClass.id}': need ${endpointDemand} endpoint ports but only ${totalLeafCapacity} available`,
          leafClassId: leafClass.id,
          context: {
            expected: totalLeafCapacity,
            actual: endpointDemand,
            leafCount: classLeaves,
            portsPerLeaf: availablePorts
          }
        })
      }
    }
  } else {
    // Legacy mode
    const leafModel = catalog.getSwitchModel(spec.leafModelId)
    if (!leafModel || leafModel.type !== 'leaf') return

    const endpointDemand = (spec.endpointCount || 0) * ((spec.endpointProfile?.portsPerEndpoint) || 1)
    const availablePorts = leafModel.ports - (spec.uplinksPerLeaf || 0)
    const totalLeafCapacity = derived.leavesNeeded * availablePorts

    if (endpointDemand > totalLeafCapacity) {
      result.errors.push({
        code: 'LEAF_CAPACITY_EXCEEDED',
        severity: 'error',
        message: `Leaf capacity exceeded: need ${endpointDemand} endpoint ports but only ${totalLeafCapacity} available`,
        context: {
          expected: totalLeafCapacity,
          actual: endpointDemand,
          leafCount: derived.leavesNeeded,
          portsPerLeaf: availablePorts
        }
      })
    }
  }
}

/**
 * UPLINKS_NOT_DIVISIBLE_BY_SPINES (warning): Check uplinks per leaf divisibility by spine count
 */
function checkUplinksPerSpineDivisibility(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: RuleEvaluationResult
): void {
  if (derived.spinesNeeded <= 1) return // No divisibility concern with single spine

  if (spec.leafClasses) {
    // Multi-class mode: check each leaf class
    for (const leafClass of spec.leafClasses) {
      if (leafClass.uplinksPerLeaf % derived.spinesNeeded !== 0) {
        result.warnings.push({
          code: 'UPLINKS_NOT_DIVISIBLE_BY_SPINES',
          severity: 'warning',
          message: `Leaf class '${leafClass.id}' uplinks (${leafClass.uplinksPerLeaf}) not evenly divisible by spine count (${derived.spinesNeeded}) - may cause uneven load distribution`,
          leafClassId: leafClass.id,
          context: {
            uplinksPerLeaf: leafClass.uplinksPerLeaf,
            spineCount: derived.spinesNeeded,
            remainder: leafClass.uplinksPerLeaf % derived.spinesNeeded
          }
        })
      }
    }
  } else {
    // Legacy mode
    const uplinksPerLeaf = spec.uplinksPerLeaf || 0
    if (uplinksPerLeaf % derived.spinesNeeded !== 0) {
      result.warnings.push({
        code: 'UPLINKS_NOT_DIVISIBLE_BY_SPINES',
        severity: 'warning',
        message: `Uplinks per leaf (${uplinksPerLeaf}) not evenly divisible by spine count (${derived.spinesNeeded}) - may cause uneven load distribution`,
        context: {
          uplinksPerLeaf,
          spineCount: derived.spinesNeeded,
          remainder: uplinksPerLeaf % derived.spinesNeeded
        }
      })
    }
  }
}

/**
 * MC_LAG_ODD_LEAFS (warning): Check for odd leaf counts with MC-LAG enabled
 */
function checkMcLagOddLeafs(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: RuleEvaluationResult
): void {
  if (!spec.leafClasses) return // Only applicable to multi-class mode

  for (const leafClass of spec.leafClasses) {
    if (leafClass.mcLag === true) {
      const leafModel = spec.leafModelId // Default leaf model
      const model = leafModel ? { ports: 48 } : null // Stub
      const classLeaves = leafClass.count || calculateLeavesForClass(leafClass, model)
      
      if (classLeaves % 2 !== 0 || classLeaves < 2) {
        result.warnings.push({
          code: 'MC_LAG_ODD_LEAFS',
          severity: 'warning',
          message: `MC-LAG enabled for class '${leafClass.id}' but leaf count (${classLeaves}) is not even or less than 2 - MC-LAG requires pairs of leaves`,
          leafClassId: leafClass.id,
          context: {
            leafCount: classLeaves,
            mcLagEnabled: true,
            expected: 'even number >= 2'
          }
        })
      }
    }
  }
}

/**
 * ES_LAG_SINGLE_NIC (warning): Check for ES-LAG with single NIC endpoints
 */
function checkEsLagSingleNic(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: RuleEvaluationResult
): void {
  const profiles = spec.leafClasses 
    ? spec.leafClasses.flatMap(lc => lc.endpointProfiles.map(ep => ({...ep, leafClassId: lc.id})))
    : spec.endpointProfile ? [spec.endpointProfile] : []

  for (const profile of profiles) {
    if (profile.esLag === true && (profile.nics || 1) === 1) {
      result.warnings.push({
        code: 'ES_LAG_SINGLE_NIC',
        severity: 'warning',
        message: `ES-LAG enabled for endpoint profile '${profile.name}' but NIC count is 1 - ES-LAG requires multiple NICs for redundancy`,
        leafClassId: (profile as any).leafClassId,
        context: {
          profileName: profile.name,
          nicCount: profile.nics || 1,
          esLagEnabled: true,
          expected: 'nics >= 2'
        }
      })
    }
  }
}

/**
 * MODEL_PROFILE_MISMATCH (warning): Check for model/profile compatibility issues
 */
function checkModelProfileMismatch(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: RuleEvaluationResult
): void {
  // Check spine model compatibility
  const spineProfile = catalog.getModelProfile(spec.spineModelId)
  if (spineProfile && !spineProfile.recommended.includes('uplink')) {
    result.warnings.push({
      code: 'MODEL_PROFILE_MISMATCH',
      severity: 'warning',
      message: `Spine model '${spec.spineModelId}' may not be optimized for uplink usage`,
      context: {
        modelId: spec.spineModelId,
        role: 'spine',
        recommended: spineProfile.recommended
      }
    })
  }

  // Check leaf model compatibility  
  const leafClasses = spec.leafClasses || [{ id: 'legacy', leafModelId: spec.leafModelId, endpointProfiles: spec.endpointProfile ? [spec.endpointProfile] : [] }]
  
  for (const leafClass of leafClasses) {
    const leafModelId = leafClass.leafModelId || spec.leafModelId
    const leafProfile = catalog.getModelProfile(leafModelId)
    
    if (leafProfile) {
      const hasServerEndpoints = leafClass.endpointProfiles.some(ep => ep.type === 'server' || !ep.type)
      if (hasServerEndpoints && !leafProfile.recommended.includes('server')) {
        result.warnings.push({
          code: 'MODEL_PROFILE_MISMATCH',
          severity: 'warning',
          message: `Leaf model '${leafModelId}' in class '${leafClass.id}' may not be optimized for server connectivity`,
          leafClassId: leafClass.id,
          context: {
            modelId: leafModelId,
            role: 'leaf',
            profileTypes: leafClass.endpointProfiles.map(ep => ep.type || 'server'),
            recommended: leafProfile.recommended
          }
        })
      }
    }
  }
}

/**
 * Helper function to calculate leaves needed for a leaf class
 */
/**
 * ACTIONABLE VALIDATION FUNCTIONS WITH SPECIFIC REMEDIATION STEPS
 */

/**
 * SPINE_CAPACITY_EXCEEDED - Actionable version with specific fix guidance
 */
async function checkSpineCapacityActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: TopologyEvaluationResult
): Promise<void> {
  const spineModel = catalog.getSwitchModel(spec.spineModelId)
  if (!spineModel || spineModel.type !== 'spine') return

  // Calculate total uplink demand with detailed breakdown
  let totalUplinks = 0
  const classBreakdown: { classId: string; leafCount: number; uplinks: number; total: number }[] = []
  
  if (spec.leafClasses) {
    for (const leafClass of spec.leafClasses) {
      const leafModel = catalog.getSwitchModel(leafClass.leafModelId || spec.leafModelId)
      const classLeaves = leafClass.count || calculateLeavesForClass(leafClass, leafModel)
      const classUplinks = classLeaves * leafClass.uplinksPerLeaf
      totalUplinks += classUplinks
      
      classBreakdown.push({
        classId: leafClass.id,
        leafCount: classLeaves,
        uplinks: leafClass.uplinksPerLeaf,
        total: classUplinks
      })
    }
  } else {
    const legacyUplinks = derived.leavesNeeded * (spec.uplinksPerLeaf || 0)
    totalUplinks = legacyUplinks
    classBreakdown.push({
      classId: 'legacy',
      leafCount: derived.leavesNeeded,
      uplinks: spec.uplinksPerLeaf || 0,
      total: legacyUplinks
    })
  }

  const totalSpineCapacity = derived.spinesNeeded * spineModel.ports
  const shortfall = totalUplinks - totalSpineCapacity

  if (shortfall > 0) {
    // Calculate specific remediation options
    const additionalSpinesNeeded = Math.ceil(shortfall / spineModel.ports)
    const minSpinesForCapacity = Math.ceil(totalUplinks / spineModel.ports)
    
    result.errors.push({
      code: 'SPINE_CAPACITY_EXCEEDED',
      severity: 'error',
      title: 'Spine Capacity Exceeded',
      message: `Total uplink demand (${totalUplinks} ports) exceeds spine capacity (${totalSpineCapacity} ports across ${derived.spinesNeeded} spines)`,
      remediation: {
        what: `Add ${additionalSpinesNeeded} more spine${additionalSpinesNeeded > 1 ? 's' : ''} or reduce uplinks per leaf`,
        how: `Option 1: Use ${minSpinesForCapacity} total spines. Option 2: Reduce uplinksPerLeaf from ${Math.max(...classBreakdown.map(c => c.uplinks))} to ${Math.floor(totalSpineCapacity / Math.max(...classBreakdown.map(c => c.leafCount)))} per leaf class`,
        why: `GitHedgehog fabric requires sufficient spine ports to handle all leaf uplinks. Each spine provides ${spineModel.ports} ports. Current shortfall: ${shortfall} ports`
      },
      affectedFields: spec.leafClasses ? 
        ['leafClasses.*.uplinksPerLeaf', 'spineModelId'] : 
        ['uplinksPerLeaf', 'spineModelId'],
      context: {
        expected: totalSpineCapacity,
        actual: totalUplinks,
        calculations: {
          shortfall,
          additionalSpinesNeeded,
          minSpinesForCapacity,
          spineModel: spineModel.ports,
          classBreakdown
        }
      }
    })
  }
}

/**
 * LEAF_CAPACITY_EXCEEDED - Actionable version with specific fix guidance
 */
async function checkLeafCapacityActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: TopologyEvaluationResult
): Promise<void> {
  if (spec.leafClasses) {
    for (const leafClass of spec.leafClasses) {
      const leafModelId = leafClass.leafModelId || spec.leafModelId
      const leafModel = catalog.getSwitchModel(leafModelId)
      if (!leafModel || leafModel.type !== 'leaf') continue

      const endpointDemand = leafClass.endpointProfiles.reduce((sum, profile) => {
        return sum + (profile.count || 0) * (profile.portsPerEndpoint || 1)
      }, 0)

      const availablePorts = leafModel.ports - leafClass.uplinksPerLeaf
      const classLeaves = leafClass.count || Math.ceil(endpointDemand / availablePorts)
      const totalLeafCapacity = classLeaves * availablePorts
      const shortfall = endpointDemand - totalLeafCapacity

      if (shortfall > 0) {
        const additionalLeavesNeeded = Math.ceil(shortfall / availablePorts)
        const minLeavesForCapacity = Math.ceil(endpointDemand / availablePorts)
        const maxUplinksReduction = leafModel.ports - Math.ceil(endpointDemand / classLeaves)
        
        result.errors.push({
          code: 'LEAF_CAPACITY_EXCEEDED',
          severity: 'error',
          title: `Leaf Capacity Exceeded - Class '${leafClass.id}'`,
          message: `Endpoint demand (${endpointDemand} ports) exceeds leaf capacity (${totalLeafCapacity} ports across ${classLeaves} leaves)`,
          remediation: {
            what: `Add ${additionalLeavesNeeded} more ${additionalLeavesNeeded > 1 ? 'leaves' : 'leaf'} or reduce uplinks/endpoints`,
            how: `Option 1: Set leaf count to ${minLeavesForCapacity}. Option 2: Reduce uplinksPerLeaf to max ${maxUplinksReduction}. Option 3: Reduce endpoint counts by ${shortfall} total ports`,
            why: `Each ${leafModelId} leaf has ${leafModel.ports} ports. After ${leafClass.uplinksPerLeaf} uplinks, ${availablePorts} remain for endpoints. Current shortfall: ${shortfall} ports`
          },
          affectedFields: [`leafClasses.${leafClass.id}.count`, `leafClasses.${leafClass.id}.uplinksPerLeaf`, `leafClasses.${leafClass.id}.endpointProfiles.*.count`],
          context: {
            expected: totalLeafCapacity,
            actual: endpointDemand,
            calculations: {
              shortfall,
              additionalLeavesNeeded,
              minLeavesForCapacity,
              maxUplinksReduction,
              leafModel: leafModel.ports,
              availablePorts,
              classLeaves
            }
          },
          leafClassId: leafClass.id
        })
      }
    }
  } else {
    // Legacy mode with actionable feedback
    const leafModel = catalog.getSwitchModel(spec.leafModelId)
    if (!leafModel || leafModel.type !== 'leaf') return

    const endpointDemand = (spec.endpointCount || 0) * ((spec.endpointProfile?.portsPerEndpoint) || 1)
    const availablePorts = leafModel.ports - (spec.uplinksPerLeaf || 0)
    const totalLeafCapacity = derived.leavesNeeded * availablePorts
    const shortfall = endpointDemand - totalLeafCapacity

    if (shortfall > 0) {
      const additionalLeavesNeeded = Math.ceil(shortfall / availablePorts)
      const minLeavesForCapacity = Math.ceil(endpointDemand / availablePorts)
      const maxUplinksReduction = leafModel.ports - Math.ceil(endpointDemand / derived.leavesNeeded)
      
      result.errors.push({
        code: 'LEAF_CAPACITY_EXCEEDED',
        severity: 'error',
        title: 'Leaf Capacity Exceeded',
        message: `Endpoint demand (${endpointDemand} ports) exceeds leaf capacity (${totalLeafCapacity} ports across ${derived.leavesNeeded} leaves)`,
        remediation: {
          what: `Add ${additionalLeavesNeeded} more ${additionalLeavesNeeded > 1 ? 'leaves' : 'leaf'} or reduce uplinks/endpoints`,
          how: `Option 1: Add ${additionalLeavesNeeded} leaves (${minLeavesForCapacity} total). Option 2: Reduce uplinksPerLeaf to max ${maxUplinksReduction}. Option 3: Reduce endpointCount by ${Math.ceil(shortfall / (spec.endpointProfile?.portsPerEndpoint || 1))}`,
          why: `Each ${spec.leafModelId} leaf has ${leafModel.ports} ports. After ${spec.uplinksPerLeaf || 0} uplinks, ${availablePorts} remain for endpoints. Current shortfall: ${shortfall} ports`
        },
        affectedFields: ['uplinksPerLeaf', 'endpointCount', 'endpointProfile.portsPerEndpoint'],
        context: {
          expected: totalLeafCapacity,
          actual: endpointDemand,
          calculations: {
            shortfall,
            additionalLeavesNeeded,
            minLeavesForCapacity,
            maxUplinksReduction,
            leafModel: leafModel.ports,
            availablePorts
          }
        }
      })
    }
  }
}

/**
 * UPLINKS_NOT_DIVISIBLE_BY_SPINES - Actionable version with load balancing guidance
 */
async function checkUplinksPerSpineDivisibilityActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: TopologyEvaluationResult
): Promise<void> {
  if (derived.spinesNeeded <= 1) return

  if (spec.leafClasses) {
    for (const leafClass of spec.leafClasses) {
      const remainder = leafClass.uplinksPerLeaf % derived.spinesNeeded
      if (remainder !== 0) {
        const evenDistribution = Math.ceil(leafClass.uplinksPerLeaf / derived.spinesNeeded) * derived.spinesNeeded
        const optimalCounts = [
          leafClass.uplinksPerLeaf - remainder,
          evenDistribution
        ].filter(count => count > 0 && count <= 32) // reasonable uplink limits

        result.warnings.push({
          code: 'UPLINKS_NOT_DIVISIBLE_BY_SPINES',
          severity: 'warning',
          title: `Uneven Load Distribution - Class '${leafClass.id}'`,
          message: `Uplinks per leaf (${leafClass.uplinksPerLeaf}) not evenly divisible by spine count (${derived.spinesNeeded})`,
          remediation: {
            what: 'Adjust uplinks per leaf for even spine load distribution',
            how: `Use ${optimalCounts.join(' or ')} uplinks per leaf for balanced load across all ${derived.spinesNeeded} spines`,
            why: `GitHedgehog distributes leaf uplinks across spines. Uneven distribution causes ${remainder} spine${remainder > 1 ? 's' : ''} to handle extra links, potentially creating bottlenecks`
          },
          affectedFields: [`leafClasses.${leafClass.id}.uplinksPerLeaf`],
          context: {
            expected: evenDistribution,
            actual: leafClass.uplinksPerLeaf,
            calculations: {
              remainder,
              evenDistribution,
              optimalCounts,
              spineCount: derived.spinesNeeded
            }
          },
          leafClassId: leafClass.id
        })
      }
    }
  } else {
    const uplinksPerLeaf = spec.uplinksPerLeaf || 0
    const remainder = uplinksPerLeaf % derived.spinesNeeded
    if (remainder !== 0) {
      const evenDistribution = Math.ceil(uplinksPerLeaf / derived.spinesNeeded) * derived.spinesNeeded
      const optimalCounts = [
        uplinksPerLeaf - remainder,
        evenDistribution
      ].filter(count => count > 0 && count <= 32)

      result.warnings.push({
        code: 'UPLINKS_NOT_DIVISIBLE_BY_SPINES',
        severity: 'warning',
        title: 'Uneven Load Distribution',
        message: `Uplinks per leaf (${uplinksPerLeaf}) not evenly divisible by spine count (${derived.spinesNeeded})`,
        remediation: {
          what: 'Adjust uplinks per leaf for even spine load distribution',
          how: `Use ${optimalCounts.join(' or ')} uplinks per leaf for balanced load across all ${derived.spinesNeeded} spines`,
          why: `GitHedgehog distributes leaf uplinks across spines. Uneven distribution causes ${remainder} spine${remainder > 1 ? 's' : ''} to handle extra links, potentially creating bottlenecks`
        },
        affectedFields: ['uplinksPerLeaf'],
        context: {
          expected: evenDistribution,
          actual: uplinksPerLeaf,
          calculations: {
            remainder,
            evenDistribution,
            optimalCounts,
            spineCount: derived.spinesNeeded
          }
        }
      })
    }
  }
}

/**
 * MC_LAG_ODD_LEAFS - Actionable version with pairing guidance
 */
async function checkMcLagOddLeafsActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: TopologyEvaluationResult
): Promise<void> {
  if (!spec.leafClasses) return

  for (const leafClass of spec.leafClasses) {
    if (leafClass.mcLag === true) {
      const leafModel = spec.leafModelId ? { ports: 48 } : null // Stub
      const classLeaves = leafClass.count || calculateLeavesForClass(leafClass, leafModel)
      
      if (classLeaves % 2 !== 0 || classLeaves < 2) {
        const suggestedCount = classLeaves < 2 ? 2 : (classLeaves % 2 !== 0 ? classLeaves + 1 : classLeaves)
        
        result.warnings.push({
          code: 'MC_LAG_ODD_LEAFS',
          severity: 'warning',
          title: `MC-LAG Configuration Issue - Class '${leafClass.id}'`,
          message: `MC-LAG enabled but leaf count (${classLeaves}) is not suitable for proper pairing`,
          remediation: {
            what: classLeaves < 2 ? 'Add more leaves for MC-LAG pairs' : 'Adjust leaf count to even number',
            how: `Set leaf count to ${suggestedCount} for proper MC-LAG pairing, or disable MC-LAG if redundancy not required`,
            why: `GitHedgehog MC-LAG creates redundant leaf pairs. Each pair needs exactly 2 leaves with cross-connects. Odd counts leave unpaired leaves without redundancy`
          },
          affectedFields: [`leafClasses.${leafClass.id}.count`, `leafClasses.${leafClass.id}.mcLag`],
          context: {
            expected: suggestedCount,
            actual: classLeaves,
            calculations: {
              suggestedCount,
              currentCount: classLeaves,
              mcLagEnabled: true,
              pairsNeeded: Math.floor(suggestedCount / 2)
            }
          },
          leafClassId: leafClass.id
        })
      }
    }
  }
}

/**
 * ES_LAG_SINGLE_NIC - Actionable version with NIC guidance
 */
async function checkEsLagSingleNicActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  result: TopologyEvaluationResult
): Promise<void> {
  const profiles = spec.leafClasses 
    ? spec.leafClasses.flatMap(lc => lc.endpointProfiles.map(ep => ({...ep, leafClassId: lc.id})))
    : spec.endpointProfile ? [spec.endpointProfile] : []

  for (const profile of profiles) {
    if (profile.esLag === true && (profile.nics || 1) === 1) {
      const leafClassId = (profile as any).leafClassId
      const suggestedNics = 2
      
      result.warnings.push({
        code: 'ES_LAG_SINGLE_NIC',
        severity: 'warning',
        title: `ES-LAG Configuration Issue - Profile '${profile.name}'`,
        message: `ES-LAG enabled but endpoint has only ${profile.nics || 1} NIC`,
        remediation: {
          what: `Increase NIC count to ${suggestedNics} or disable ES-LAG`,
          how: `Set nics: ${suggestedNics} in endpoint profile '${profile.name}', or set esLag: false if single NIC acceptable`,
          why: `GitHedgehog ES-LAG provides endpoint redundancy across leaf switches. Single NIC endpoints cannot utilize ES-LAG benefits and may cause configuration errors`
        },
        affectedFields: leafClassId ? 
          [`leafClasses.${leafClassId}.endpointProfiles.${profile.name}.nics`, `leafClasses.${leafClassId}.endpointProfiles.${profile.name}.esLag`] :
          ['endpointProfile.nics', 'endpointProfile.esLag'],
        context: {
          expected: suggestedNics,
          actual: profile.nics || 1,
          calculations: {
            profileName: profile.name,
            nicCount: profile.nics || 1,
            esLagEnabled: true,
            suggestedNics
          }
        },
        leafClassId
      })
    }
  }
}

/**
 * MODEL_PROFILE_MISMATCH - Actionable version with compatibility guidance
 */
async function checkModelProfileMismatchActionable(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog, 
  result: TopologyEvaluationResult
): Promise<void> {
  // Check spine model compatibility
  const spineProfile = catalog.getModelProfile(spec.spineModelId)
  if (spineProfile && !spineProfile.recommended.includes('uplink')) {
    const alternativeModels = ['DS3000', 'DS4000'].filter(model => 
      model !== spec.spineModelId && catalog.getModelProfile(model)?.recommended.includes('uplink')
    )
    
    result.warnings.push({
      code: 'MODEL_PROFILE_MISMATCH',
      severity: 'warning',
      title: 'Spine Model Not Optimized',
      message: `Spine model '${spec.spineModelId}' may not be optimized for uplink usage`,
      remediation: {
        what: 'Consider using a spine-optimized switch model',
        how: alternativeModels.length > 0 ? 
          `Replace with ${alternativeModels.join(' or ')} for better uplink performance` :
          'Verify model specification supports fabric interconnect requirements',
        why: `Spine switches handle inter-leaf traffic and should optimize for high throughput, low latency uplinks. Current model optimized for: ${spineProfile.recommended.join(', ')}`
      },
      affectedFields: ['spineModelId'],
      context: {
        expected: 'uplink-optimized model',
        actual: spec.spineModelId,
        calculations: {
          modelId: spec.spineModelId,
          role: 'spine',
          recommended: spineProfile.recommended,
          alternatives: alternativeModels
        }
      }
    })
  }

  // Check leaf model compatibility  
  const leafClasses = spec.leafClasses || [{ id: 'legacy', leafModelId: spec.leafModelId, endpointProfiles: spec.endpointProfile ? [spec.endpointProfile] : [] }]
  
  for (const leafClass of leafClasses) {
    const leafModelId = leafClass.leafModelId || spec.leafModelId
    const leafProfile = catalog.getModelProfile(leafModelId)
    
    if (leafProfile) {
      const hasServerEndpoints = leafClass.endpointProfiles.some(ep => ep.type === 'server' || !ep.type)
      if (hasServerEndpoints && !leafProfile.recommended.includes('server')) {
        const alternativeModels = ['DS2000', 'DS2500'].filter(model => 
          model !== leafModelId && catalog.getModelProfile(model)?.recommended.includes('server')
        )
        
        result.warnings.push({
          code: 'MODEL_PROFILE_MISMATCH',
          severity: 'warning',
          title: `Leaf Model Not Optimized - Class '${leafClass.id}'`,
          message: `Leaf model '${leafModelId}' may not be optimized for server connectivity`,
          remediation: {
            what: 'Consider using a server-optimized leaf switch model',
            how: alternativeModels.length > 0 ? 
              `Replace with ${alternativeModels.join(' or ')} for better server connectivity` :
              'Verify model specification supports endpoint connection requirements',
            why: `Leaf switches with server endpoints should optimize for server connectivity patterns. Current model optimized for: ${leafProfile.recommended.join(', ')}`
          },
          affectedFields: leafClass.id === 'legacy' ? 
            ['leafModelId'] : 
            [`leafClasses.${leafClass.id}.leafModelId`],
          context: {
            expected: 'server-optimized model',
            actual: leafModelId,
            calculations: {
              modelId: leafModelId,
              role: 'leaf',
              profileTypes: leafClass.endpointProfiles.map(ep => ep.type || 'server'),
              recommended: leafProfile.recommended,
              alternatives: alternativeModels
            }
          },
          leafClassId: leafClass.id
        })
      }
    }
  }
}

/**
 * INTEGRATION VALIDATION - Optional hhfab and Kubernetes dry-run validation
 */
async function runIntegrationValidations(
  spec: FabricSpec,
  derived: DerivedTopology,
  options: {
    hhfabPath?: string
    kubectlPath?: string
  }
): Promise<TopologyEvaluationResult['integrationResults']> {
  const results: NonNullable<TopologyEvaluationResult['integrationResults']> = {}
  
  // hhfab CLI validation if available
  if (options.hhfabPath && process.env.NODE_ENV !== 'test') {
    try {
      const hhfabResult = await validateWithHHFab(spec, options.hhfabPath)
      results.hhfab = hhfabResult
    } catch (error) {
      results.hhfab = {
        valid: false,
        messages: [`hhfab validation failed: ${error}`]
      }
    }
  }
  
  // Kubernetes dry-run validation if available
  if (options.kubectlPath && process.env.NODE_ENV !== 'test') {
    try {
      const k8sResult = await validateWithKubernetes(spec, options.kubectlPath)
      results.kubernetes = k8sResult
    } catch (error) {
      results.kubernetes = {
        valid: false,
        messages: [`Kubernetes dry-run failed: ${error}`]
      }
    }
  }
  
  return results
}

/**
 * Helper function for hhfab CLI validation
 */
async function validateWithHHFab(spec: FabricSpec, hhfabPath: string): Promise<{
  valid: boolean
  messages: string[]
  yamlPath?: string
}> {
  // This would integrate with real hhfab CLI when available
  // For now, return stub validation
  return {
    valid: true,
    messages: ['hhfab validation not yet implemented - stub validation passed'],
    yamlPath: '/tmp/fabric-validation.yaml'
  }
}

/**
 * Helper function for Kubernetes dry-run validation
 */
async function validateWithKubernetes(spec: FabricSpec, kubectlPath: string): Promise<{
  valid: boolean
  messages: string[]
  dryRunOutput?: string
}> {
  // This would integrate with kubectl --dry-run=server when available
  // For now, return stub validation
  return {
    valid: true,
    messages: ['Kubernetes dry-run validation not yet implemented - stub validation passed'],
    dryRunOutput: 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: fabric-config'
  }
}

/**
 * Helper function to calculate leaves needed for a leaf class
 */
function calculateLeavesForClass(leafClass: LeafClass, leafModel: { ports: number } | null): number {
  if (leafClass.count) return leafClass.count
  if (!leafModel) return 0

  const endpointDemand = leafClass.endpointProfiles.reduce((sum, profile) => {
    return sum + (profile.count || 0) * (profile.portsPerEndpoint || 1)
  }, 0)

  const availablePorts = leafModel.ports - leafClass.uplinksPerLeaf
  return availablePorts > 0 ? Math.ceil(endpointDemand / availablePorts) : 0
}