import type { FabricSpec, DerivedTopology, FabricGuard, ESLAGGuard, MCLAGGuard } from '../app.types'

/**
 * Pure computation domain for topology calculations
 * Extracted from app.machine.ts to enable clean unit testing
 */

export function computeDerived(spec: FabricSpec): DerivedTopology {
  const [leafPorts, spinePorts] = [48, 32] // DS2000/DS3000 stub
  
  
  // Handle multi-class or legacy single-class mode
  if (spec.leafClasses && spec.leafClasses.length > 0) {
    return computeMultiClassTopology(spec, leafPorts, spinePorts)
  } else {
    return computeLegacyTopology(spec, leafPorts, spinePorts)
  }
}

/**
 * Compute topology for multi-class fabric with leafClasses[]
 */
function computeMultiClassTopology(spec: FabricSpec, leafPorts: number, spinePorts: number): DerivedTopology {
  const leafClasses = spec.leafClasses || []
  
  
  // Quick sanity check - if no leaf classes, return error state
  if (leafClasses.length === 0) {
    return {
      leavesNeeded: 0,
      spinesNeeded: 0,
      totalPorts: 0,
      usedPorts: 0,
      oversubscriptionRatio: 0,
      isValid: false,
      validationErrors: ['No leaf classes defined'],
      guards: []
    }
  }
  
  // Calculate total leaves needed across all classes
  let totalLeavesNeeded = 0
  let totalEndpoints = 0
  let totalUplinkPorts = 0
  const perClassErrors: string[] = []
  const guards: FabricGuard[] = []
  
  // Sort classes by ID for deterministic ordering
  const sortedClasses = [...leafClasses].sort((a, b) => a.id.localeCompare(b.id))
  
  for (const leafClass of sortedClasses) {
    // Calculate endpoints for this class
    const classEndpoints = leafClass.endpointProfiles.reduce((sum, profile) => {
      return sum + (profile.count || 0)
    }, 0)
    
    // Calculate downlink ports available
    const downlinkPorts = leafPorts - leafClass.uplinksPerLeaf
    
    // Calculate leaves needed for this class
    // Use explicit count if provided, otherwise calculate from endpoints
    const classLeavesNeeded = leafClass.count || 
      ((downlinkPorts <= 0 || classEndpoints <= 0) ? 0 : Math.ceil(classEndpoints / downlinkPorts))
    
    // Accumulate totals
    totalLeavesNeeded += classLeavesNeeded
    totalEndpoints += classEndpoints
    totalUplinkPorts += classLeavesNeeded * leafClass.uplinksPerLeaf
    
    
    // Per-class validation
    if (leafClass.uplinksPerLeaf > leafPorts / 2) {
      perClassErrors.push(`Class ${leafClass.id}: Too many uplinks per leaf (${leafClass.uplinksPerLeaf})`)
    }
    if (classLeavesNeeded === 0 && classEndpoints > 0) {
      perClassErrors.push(`Class ${leafClass.id}: No leaves computed`)
    }
    
    // ES-LAG constraint validation
    for (const profile of leafClass.endpointProfiles) {
      if (profile.esLag) {
        const actualNics = profile.nics || 1
        if (actualNics < 2) {
          guards.push({
            guardType: 'ES_LAG_INVALID' as const,
            message: `ES-LAG requires at least 2 NICs but profile '${profile.name}' in class '${leafClass.id}' has ${actualNics}`,
            details: {
              leafClassId: leafClass.id,
              profileName: profile.name,
              requiredNics: 2,
              actualNics: actualNics
            }
          } as ESLAGGuard)
        }
      }
    }
    
    // MC-LAG constraint validation
    if (leafClass.mcLag === true) {
      if (classLeavesNeeded % 2 !== 0 || classLeavesNeeded < 2) {
        const guard: MCLAGGuard = {
          guardType: 'MC_LAG_ODD_LEAF_COUNT',
          message: `MC-LAG requires even leaf count >= 2, but class '${leafClass.id}' has ${classLeavesNeeded} leaves`,
          details: {
            classId: leafClass.id,
            leafCount: classLeavesNeeded,
            mcLagEnabled: true
          }
        }
        guards.push(guard)
      }
    }
  }
  
  // Calculate spines needed (use direct calculation instead of helper for clarity)
  const spinesNeeded = (totalLeavesNeeded <= 0 || totalUplinkPorts <= 0) ? 0 : Math.max(1, Math.ceil(totalUplinkPorts / spinePorts))
  
  // Calculate other metrics
  const totalPorts = (totalLeavesNeeded * leafPorts) + (spinesNeeded * spinePorts)
  const usedPorts = totalEndpoints + (totalUplinkPorts * 2)
  const oversubscriptionRatio = totalUplinkPorts <= 0 ? 0 : totalEndpoints / totalUplinkPorts

  const validationErrors: string[] = [...perClassErrors]
  if (totalLeavesNeeded === 0) validationErrors.push('No leaves computed')
  if (spinesNeeded === 0) validationErrors.push('No spines computed')
  if (oversubscriptionRatio > 15.0) validationErrors.push(`Oversubscription too high: ${oversubscriptionRatio.toFixed(2)}:1`)
  
  // Per-class spine divisibility validation
  for (const leafClass of sortedClasses) {
    if (spinesNeeded > 1 && leafClass.uplinksPerLeaf % spinesNeeded !== 0) {
      validationErrors.push(`Class ${leafClass.id}: uplinksPerLeaf (${leafClass.uplinksPerLeaf}) must be divisible by spines (${spinesNeeded})`)
    }
  }

  return { 
    leavesNeeded: totalLeavesNeeded, 
    spinesNeeded, 
    totalPorts, 
    usedPorts, 
    oversubscriptionRatio, 
    isValid: validationErrors.length === 0 && guards.length === 0, 
    validationErrors,
    guards
  }
}

/**
 * Compute topology for legacy single-class mode (backwards compatibility)
 */
function computeLegacyTopology(spec: FabricSpec, leafPorts: number, spinePorts: number): DerivedTopology {
  const downlinkPorts = leafPorts - (spec.uplinksPerLeaf || 0)
  const leavesNeeded = computeLeavesNeeded(spec.endpointCount || 0, downlinkPorts)
  const spinesNeeded = computeSpinesNeeded(leavesNeeded, spec.uplinksPerLeaf || 0)
  const totalPorts = (leavesNeeded * leafPorts) + (spinesNeeded * spinePorts)
  const usedPorts = (spec.endpointCount || 0) + (leavesNeeded * (spec.uplinksPerLeaf || 0) * 2)
  const oversubscriptionRatio = computeOversubscription(leavesNeeded * (spec.uplinksPerLeaf || 0), spec.endpointCount || 0)

  const validationErrors: string[] = []
  if (leavesNeeded === 0) validationErrors.push('No leaves computed')
  if (spinesNeeded === 0) validationErrors.push('No spines computed')
  if ((spec.uplinksPerLeaf || 0) > leafPorts / 2) validationErrors.push('Too many uplinks per leaf')
  if (oversubscriptionRatio > 15.0) validationErrors.push(`Oversubscription too high: ${oversubscriptionRatio.toFixed(2)}:1`)

  return { 
    leavesNeeded, 
    spinesNeeded, 
    totalPorts, 
    usedPorts, 
    oversubscriptionRatio, 
    isValid: validationErrors.length === 0, 
    validationErrors,
    guards: [] // Legacy mode doesn't support guards yet
  }
}

// Helper functions for computation
const computeLeavesNeeded = (endpointCount: number, portsPerLeaf: number): number => 
  (portsPerLeaf <= 0 || endpointCount <= 0) ? 0 : Math.ceil(endpointCount / portsPerLeaf)

const computeSpinesNeeded = (leaves: number, uplinksPerLeaf: number): number => 
  (leaves <= 0 || uplinksPerLeaf <= 0) ? 0 : Math.max(1, Math.ceil((leaves * uplinksPerLeaf) / 32))

const computeOversubscription = (uplinks: number, downlinks: number): number => 
  uplinks <= 0 ? 0 : downlinks / uplinks