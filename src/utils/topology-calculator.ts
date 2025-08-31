import type { FabricSpec } from '../schemas/fabric-spec.schema';
import type { DerivedTopology, TopologyComputationResult } from '../types/derived-topology.types';
import { SWITCH_CAPACITY } from '../types/derived-topology.types';

/**
 * Core topology calculation utilities for HNC v0.1
 * Computes derived topology metrics from FabricSpec
 * Updated to support multi-class leafClasses and legacy mode
 */

// Calculate number of leaf switches needed (supports both leafClasses and legacy mode)
export function calculateLeavesNeeded(fabricSpec: FabricSpec): number {
  let totalEndpoints = 0;
  let redundantEndpoints = 0;
  let effectiveUplinksPerLeaf = 0;
  
  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode
    for (const leafClass of fabricSpec.leafClasses) {
      const classCount = leafClass.count || 1;
      for (const profile of leafClass.endpointProfiles) {
        const profileCount = profile.count || 1;
        const profilePorts = profile.portsPerEndpoint || 1;
        totalEndpoints += profileCount * profilePorts * classCount;
        
        if (profile.redundancy) {
          redundantEndpoints += profileCount * profilePorts * classCount;
        }
      }
      // Use the minimum uplinks per leaf for capacity calculation
      if (effectiveUplinksPerLeaf === 0 || leafClass.uplinksPerLeaf < effectiveUplinksPerLeaf) {
        effectiveUplinksPerLeaf = leafClass.uplinksPerLeaf;
      }
    }
  } else {
    // Legacy single-class mode
    if (fabricSpec.endpointProfile && fabricSpec.endpointCount) {
      totalEndpoints = fabricSpec.endpointCount * (fabricSpec.endpointProfile.portsPerEndpoint || 1);
      if (fabricSpec.endpointProfile.redundancy) {
        redundantEndpoints = totalEndpoints;
      }
    }
    effectiveUplinksPerLeaf = fabricSpec.uplinksPerLeaf || 2;
  }
  
  const totalPortsNeeded = totalEndpoints + redundantEndpoints;
  const availablePortsPerLeaf = SWITCH_CAPACITY.DS2000.ports - effectiveUplinksPerLeaf;
  
  return Math.ceil(totalPortsNeeded / availablePortsPerLeaf);
}

// Calculate number of spine switches needed (supports both leafClasses and legacy mode)
export function calculateSpinesNeeded(fabricSpec: FabricSpec, leavesNeeded: number): number {
  let maxUplinksPerLeaf = 0;
  
  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode: use the maximum uplinks per leaf for spine calculation
    maxUplinksPerLeaf = Math.max(...fabricSpec.leafClasses.map(lc => lc.uplinksPerLeaf));
  } else {
    // Legacy single-class mode
    maxUplinksPerLeaf = fabricSpec.uplinksPerLeaf || 2;
  }
  
  const totalUplinks = leavesNeeded * maxUplinksPerLeaf;
  const availableDownlinksPerSpine = SWITCH_CAPACITY.DS3000.downlinks;
  
  return Math.ceil(totalUplinks / availableDownlinksPerSpine);
}

// Calculate total fabric capacity
export function calculateTotalCapacity(leavesNeeded: number, uplinksPerLeaf: number): number {
  const endpointCapacity = leavesNeeded * (SWITCH_CAPACITY.DS2000.ports - uplinksPerLeaf);
  return endpointCapacity * SWITCH_CAPACITY.DS2000.bandwidth;
}

// Calculate oversubscription ratio (supports both leafClasses and legacy mode)
export function calculateOversubscriptionRatio(
  fabricSpec: FabricSpec,
  leavesNeeded: number
): number {
  let effectiveUplinksPerLeaf = 0;
  
  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode: use average uplinks per leaf
    const totalUplinks = fabricSpec.leafClasses.reduce((sum, lc) => sum + lc.uplinksPerLeaf * (lc.count || 1), 0);
    const totalLeaves = fabricSpec.leafClasses.reduce((sum, lc) => sum + (lc.count || 1), 0);
    effectiveUplinksPerLeaf = totalUplinks / totalLeaves;
  } else {
    // Legacy single-class mode
    effectiveUplinksPerLeaf = fabricSpec.uplinksPerLeaf || 2;
  }
  
  const endpointBandwidth = leavesNeeded * 
    (SWITCH_CAPACITY.DS2000.ports - effectiveUplinksPerLeaf) * 
    SWITCH_CAPACITY.DS2000.bandwidth;
  
  const uplinkBandwidth = leavesNeeded * 
    effectiveUplinksPerLeaf * 
    SWITCH_CAPACITY.DS3000.bandwidth;
  
  return endpointBandwidth / uplinkBandwidth;
}

// Validate topology constraints
export function validateTopology(fabricSpec: FabricSpec, topology: Partial<DerivedTopology>) {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check port limits
  if (topology.leavesNeeded && topology.leavesNeeded > SWITCH_CAPACITY.DS3000.maxLeaves) {
    errors.push(`Topology requires ${topology.leavesNeeded} leaves, exceeding DS3000 maximum of ${SWITCH_CAPACITY.DS3000.maxLeaves}`);
  }
  
  // Check oversubscription ratio
  if (topology.oversubscriptionRatio && topology.oversubscriptionRatio > 3.0) {
    warnings.push(`High oversubscription ratio: ${topology.oversubscriptionRatio.toFixed(2)}:1`);
  }
  
  // Check redundancy requirements (supports both leafClasses and legacy mode)
  let hasRedundantProfiles = false;
  let minUplinksPerLeaf = Number.MAX_SAFE_INTEGER;
  
  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode
    hasRedundantProfiles = fabricSpec.leafClasses.some(lc => 
      lc.endpointProfiles.some(p => p.redundancy)
    );
    minUplinksPerLeaf = Math.min(...fabricSpec.leafClasses.map(lc => lc.uplinksPerLeaf));
  } else {
    // Legacy single-class mode
    hasRedundantProfiles = fabricSpec.endpointProfile?.redundancy || false;
    minUplinksPerLeaf = fabricSpec.uplinksPerLeaf || 2;
  }
  
  if (hasRedundantProfiles && minUplinksPerLeaf < 2) {
    warnings.push('Redundant endpoints require at least 2 uplinks per leaf for proper failover');
  }
  
  return {
    isValid: errors.length === 0,
    withinPortLimits: topology.leavesNeeded ? topology.leavesNeeded <= SWITCH_CAPACITY.DS3000.maxLeaves : true,
    withinBandwidthLimits: true, // Placeholder for future bandwidth validation
    meetsRedundancyRequirements: !hasRedundantProfiles || minUplinksPerLeaf >= 2,
    warnings,
    errors,
  };
}

// Main topology computation function
export function computeTopology(fabricSpec: FabricSpec): TopologyComputationResult {
  const startTime = Date.now();
  
  try {
    const leavesNeeded = calculateLeavesNeeded(fabricSpec);
    const spinesNeeded = calculateSpinesNeeded(fabricSpec, leavesNeeded);
    
    // Get effective uplinks per leaf for capacity calculation
    let effectiveUplinksPerLeaf = 0;
    if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
      const totalUplinks = fabricSpec.leafClasses.reduce((sum, lc) => sum + lc.uplinksPerLeaf * (lc.count || 1), 0);
      const totalLeaves = fabricSpec.leafClasses.reduce((sum, lc) => sum + (lc.count || 1), 0);
      effectiveUplinksPerLeaf = totalUplinks / totalLeaves;
    } else {
      effectiveUplinksPerLeaf = fabricSpec.uplinksPerLeaf || 2;
    }
    
    const totalCapacity = calculateTotalCapacity(leavesNeeded, effectiveUplinksPerLeaf);
    const oversubscriptionRatio = calculateOversubscriptionRatio(fabricSpec, leavesNeeded);
    
    // Calculate detailed capacity breakdown (supports both modes)
    let totalEndpoints = 0;
    let redundantEndpoints = 0;
    
    if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
      // Multi-class mode
      for (const leafClass of fabricSpec.leafClasses) {
        const classCount = leafClass.count || 1;
        for (const profile of leafClass.endpointProfiles) {
          const profileCount = profile.count || 1;
          const profilePorts = profile.portsPerEndpoint || 1;
          totalEndpoints += profileCount * profilePorts * classCount;
          if (profile.redundancy) {
            redundantEndpoints += profileCount * profilePorts * classCount;
          }
        }
      }
    } else {
      // Legacy single-class mode
      if (fabricSpec.endpointProfile && fabricSpec.endpointCount) {
        totalEndpoints = fabricSpec.endpointCount * (fabricSpec.endpointProfile.portsPerEndpoint || 1);
        if (fabricSpec.endpointProfile.redundancy) {
          redundantEndpoints = totalEndpoints;
        }
      }
    }
    
    const endpointPorts = leavesNeeded * (SWITCH_CAPACITY.DS2000.ports - effectiveUplinksPerLeaf);
    const uplinkPorts = leavesNeeded * effectiveUplinksPerLeaf;
    const availableEndpointPorts = endpointPorts - totalEndpoints - redundantEndpoints;
    const totalBandwidth = totalCapacity / 1000; // Convert to Gbps
    
    // Calculate utilization metrics
    const leafPortUtilization = ((totalEndpoints + redundantEndpoints) / endpointPorts) * 100;
    const spinePortUtilization = (uplinkPorts / (spinesNeeded * SWITCH_CAPACITY.DS3000.downlinks)) * 100;
    const bandwidthUtilization = 50; // Placeholder - would need traffic patterns
    
    // Determine redundancy level
    const hasRedundantSpines = spinesNeeded > 1;
    const hasRedundantUplinks = effectiveUplinksPerLeaf > 1;
    const redundancyLevel = hasRedundantSpines && hasRedundantUplinks ? 'full' : 
                           hasRedundantSpines || hasRedundantUplinks ? 'partial' : 'none';
    
    const derivedTopology: DerivedTopology = {
      leavesNeeded,
      spinesNeeded,
      totalCapacity,
      oversubscriptionRatio,
      capacityBreakdown: {
        endpointPorts,
        uplinkPorts,
        availableEndpointPorts,
        totalBandwidth,
      },
      utilization: {
        leafPortUtilization,
        spinePortUtilization,
        bandwidthUtilization,
      },
      redundancy: {
        hasRedundantSpines,
        hasRedundantUplinks,
        redundancyLevel,
      },
      validation: validateTopology(fabricSpec, { leavesNeeded, spinesNeeded, totalCapacity, oversubscriptionRatio }),
      computedAt: new Date(),
    };
    
    const computationTimeMs = Date.now() - startTime;
    
    return {
      fabricSpec,
      derivedTopology,
      computationMeta: {
        algorithmVersion: '1.0.0',
        computationTimeMs,
        cacheHit: false,
        warnings: derivedTopology.validation.warnings,
        errors: derivedTopology.validation.errors,
      },
    };
  } catch (error) {
    const computationTimeMs = Date.now() - startTime;
    throw new Error(`Topology computation failed after ${computationTimeMs}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Utility function for quick validation (supports both leafClasses and legacy mode)
export function validateFabricSpecQuick(fabricSpec: FabricSpec): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  let totalEndpoints = 0;
  let hasValidUplinks = true;
  
  if (fabricSpec.leafClasses && fabricSpec.leafClasses.length > 0) {
    // Multi-class mode validation
    for (const leafClass of fabricSpec.leafClasses) {
      const classCount = leafClass.count || 1;
      for (const profile of leafClass.endpointProfiles) {
        const profileCount = profile.count || 1;
        totalEndpoints += profileCount * classCount;
      }
      
      if (leafClass.uplinksPerLeaf < 1 || leafClass.uplinksPerLeaf > 4) {
        hasValidUplinks = false;
        issues.push(`Invalid uplinks per leaf for class '${leafClass.name}' (must be 1-4)`);
      }
    }
  } else {
    // Legacy single-class mode validation
    if (fabricSpec.endpointCount) {
      totalEndpoints = fabricSpec.endpointCount;
    }
    
    const uplinksPerLeaf = fabricSpec.uplinksPerLeaf || 0;
    if (uplinksPerLeaf < 1 || uplinksPerLeaf > 4) {
      hasValidUplinks = false;
      issues.push('Invalid uplinks per leaf (must be 1-4)');
    }
  }
  
  if (totalEndpoints === 0) {
    issues.push('No endpoints specified');
  }
  
  if (totalEndpoints > 10000) {
    issues.push('Too many endpoints for single fabric');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}