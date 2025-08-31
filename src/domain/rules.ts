/**
 * Fabric Validation Rules Engine - HNC v0.4.1
 * 
 * Implements structured validation rules that evaluate fabric specifications
 * against derived topology data and switch catalog information.
 */

import type { FabricSpec, DerivedTopology, LeafClass } from '../app.types'

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

// Structured rule violation result
export interface RuleViolation {
  code: RuleCode
  severity: RuleSeverity
  message: string
  details?: Record<string, any>
  leafClassId?: string // For per-class violations
  context?: Record<string, any>
}

// Rule evaluation result
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
 * Main rule evaluation function
 * 
 * @param spec - Fabric specification to validate
 * @param derived - Computed topology from the spec
 * @param catalog - Switch catalog for model lookups (optional, uses default)
 * @returns Structured validation results with errors, warnings, and info
 */
export function evaluate(
  spec: FabricSpec, 
  derived: DerivedTopology, 
  catalog: SwitchCatalog = new DefaultSwitchCatalog()
): RuleEvaluationResult {
  const result: RuleEvaluationResult = {
    errors: [],
    warnings: [],
    info: []
  }

  // Run all rule checks
  checkSpineCapacity(spec, derived, catalog, result)
  checkLeafCapacity(spec, derived, catalog, result)
  checkUplinksPerSpineDivisibility(spec, derived, result)
  checkMcLagOddLeafs(spec, derived, result)
  checkEsLagSingleNic(spec, derived, result)
  checkModelProfileMismatch(spec, derived, catalog, result)

  return result
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
function calculateLeavesForClass(leafClass: LeafClass, leafModel: { ports: number } | null): number {
  if (leafClass.count) return leafClass.count
  if (!leafModel) return 0

  const endpointDemand = leafClass.endpointProfiles.reduce((sum, profile) => {
    return sum + (profile.count || 0) * (profile.portsPerEndpoint || 1)
  }, 0)

  const availablePorts = leafModel.ports - leafClass.uplinksPerLeaf
  return availablePorts > 0 ? Math.ceil(endpointDemand / availablePorts) : 0
}