/**
 * Counts-First Uplink Allocator - HNC v0.3
 * Pure function implementation for computing legal uplink port maps
 */

import { expandPortRanges, getNextAvailablePort } from './portUtils';
import type { 
  AllocationSpec, 
  AllocationResult, 
  LeafAllocation, 
  UplinkAssignment, 
  SwitchProfile,
  ClassAllocationSpec,
  LeafClassAllocationResult,
  MultiClassAllocationResult
} from './types';
import type { FabricSpec, LeafClass } from '../app.types';

/**
 * Allocates uplink ports for leaves to spines using round-robin distribution
 * 
 * This is a pure function that computes legal uplink port maps given:
 * - uplinksPerLeaf and model profiles
 * - Mathematical constraints (even distribution, capacity limits)
 * - Deterministic port ordering (lowest ports first)
 * 
 * @param spec - Allocation specification with counts and requirements
 * @param leafProfile - Switch profile for leaf devices
 * @param spineProfile - Switch profile for spine devices  
 * @returns AllocationResult with port maps and validation issues
 */
export function allocateUplinks(
  spec: AllocationSpec,
  leafProfile: SwitchProfile,
  spineProfile: SwitchProfile
): AllocationResult {
  const issues: string[] = [];
  
  // Validate mathematical constraints
  const validationResult = validateAllocationConstraints(spec, leafProfile, spineProfile);
  if (validationResult.length > 0) {
    return {
      leafMaps: [],
      spineUtilization: new Array(Math.max(1, spec.spinesNeeded)).fill(0),
      issues: validationResult
    };
  }
  
  // Parse and expand fabric port ranges
  const leafFabricPorts = expandPortRanges(leafProfile.ports.fabricAssignable);
  const spineFabricPorts = expandPortRanges(spineProfile.ports.fabricAssignable);
  
  // Check if we have enough ports
  const totalUplinksNeeded = spec.leavesNeeded * spec.uplinksPerLeaf;
  const portsPerSpine = totalUplinksNeeded / spec.spinesNeeded;
  
  if (leafFabricPorts.length < spec.uplinksPerLeaf) {
    issues.push(`Leaf has only ${leafFabricPorts.length} fabric ports, need ${spec.uplinksPerLeaf}`);
  }
  
  if (spineFabricPorts.length < portsPerSpine) {
    issues.push(`Spine capacity exceeded: need ${portsPerSpine} ports, spine has ${spineFabricPorts.length} fabricAssignable`);
  }
  
  if (issues.length > 0) {
    return {
      leafMaps: [],
      spineUtilization: new Array(Math.max(1, spec.spinesNeeded)).fill(0),
      issues
    };
  }
  
  // Perform the allocation
  return performRoundRobinAllocation(spec, leafFabricPorts, spineFabricPorts);
}

/**
 * Validates mathematical and capacity constraints for allocation
 */
function validateAllocationConstraints(
  spec: AllocationSpec,
  leafProfile: SwitchProfile,
  spineProfile: SwitchProfile
): string[] {
  const issues: string[] = [];
  
  // Check even distribution constraint
  if (spec.uplinksPerLeaf % spec.spinesNeeded !== 0) {
    issues.push(`Uplinks per leaf (${spec.uplinksPerLeaf}) must be divisible by number of spines (${spec.spinesNeeded})`);
  }
  
  // Validate input ranges
  if (spec.uplinksPerLeaf <= 0) {
    issues.push('Uplinks per leaf must be positive');
  }
  
  if (spec.leavesNeeded <= 0) {
    issues.push('Leaves needed must be positive');
  }
  
  if (spec.spinesNeeded <= 0) {
    issues.push('Spines needed must be positive');
  }
  
  // Check if profiles have fabric ports
  if (!leafProfile.ports.fabricAssignable || leafProfile.ports.fabricAssignable.length === 0) {
    issues.push('Leaf profile has no fabric ports available');
  }
  
  if (!spineProfile.ports.fabricAssignable || spineProfile.ports.fabricAssignable.length === 0) {
    issues.push('Spine profile has no fabric ports available');
  }
  
  return issues;
}

/**
 * Performs round-robin uplink allocation across spines
 */
function performRoundRobinAllocation(
  spec: AllocationSpec,
  leafFabricPorts: string[],
  spineFabricPorts: string[]
): AllocationResult {
  const leafMaps: LeafAllocation[] = [];
  const spineUtilization: number[] = new Array(spec.spinesNeeded).fill(0);
  const spineUsedPorts: Set<string>[] = Array.from(
    { length: spec.spinesNeeded }, 
    () => new Set<string>()
  );
  
  const uplinksPerSpine = spec.uplinksPerLeaf / spec.spinesNeeded;
  
  // Allocate ports for each leaf - each leaf reuses the same port names
  for (let leafId = 0; leafId < spec.leavesNeeded; leafId++) {
    const leafUplinks: UplinkAssignment[] = [];
    let leafPortIndex = 0;
    
    // Check if leaf profile has enough fabric ports
    if (leafFabricPorts.length < spec.uplinksPerLeaf) {
      return {
        leafMaps: [],
        spineUtilization: new Array(spec.spinesNeeded).fill(0),
        issues: [`Leaf has only ${leafFabricPorts.length} fabric ports, need ${spec.uplinksPerLeaf}`]
      };
    }
    
    // Assign uplinks in round-robin fashion across spines
    for (let spineId = 0; spineId < spec.spinesNeeded; spineId++) {
      for (let i = 0; i < uplinksPerSpine; i++) {
        // Get next leaf port (each leaf reuses the same port names)
        const leafPort = leafFabricPorts[leafPortIndex];
        leafPortIndex++;
        
        // Get next available spine port
        const spinePort = getNextAvailablePort(spineUsedPorts[spineId], spineFabricPorts);
        if (!spinePort) {
          return {
            leafMaps: [],
            spineUtilization: new Array(spec.spinesNeeded).fill(0),
            issues: [`Ran out of spine fabric ports for spine ${spineId}`]
          };
        }
        
        // Mark spine port as used
        spineUsedPorts[spineId].add(spinePort);
        
        // Create uplink assignment
        leafUplinks.push({
          port: leafPort,
          toSpine: spineId
        });
        
        spineUtilization[spineId]++;
      }
    }
    
    leafMaps.push({
      leafId,
      uplinks: leafUplinks
    });
  }
  
  return {
    leafMaps,
    spineUtilization,
    issues: []
  };
}

/**
 * Validates an allocation result for correctness
 * Used primarily for testing and debugging
 */
export function validateAllocationResult(
  result: AllocationResult,
  spec: AllocationSpec
): string[] {
  const issues: string[] = [];
  
  if (result.issues.length > 0) {
    // If there are issues, validation depends on whether allocation succeeded
    return issues;
  }
  
  // Check correct number of leaves
  if (result.leafMaps.length !== spec.leavesNeeded) {
    issues.push(`Expected ${spec.leavesNeeded} leaves, got ${result.leafMaps.length}`);
  }
  
  // Check correct number of uplinks per leaf
  for (const leafMap of result.leafMaps) {
    if (leafMap.uplinks.length !== spec.uplinksPerLeaf) {
      issues.push(`Leaf ${leafMap.leafId} has ${leafMap.uplinks.length} uplinks, expected ${spec.uplinksPerLeaf}`);
    }
  }
  
  // Check spine utilization array length
  if (result.spineUtilization.length !== spec.spinesNeeded) {
    issues.push(`Expected ${spec.spinesNeeded} spine utilization entries, got ${result.spineUtilization.length}`);
  }
  
  // Check even distribution across spines
  const expectedPerSpine = (spec.leavesNeeded * spec.uplinksPerLeaf) / spec.spinesNeeded;
  for (let i = 0; i < result.spineUtilization.length; i++) {
    if (result.spineUtilization[i] !== expectedPerSpine) {
      issues.push(`Spine ${i} utilization is ${result.spineUtilization[i]}, expected ${expectedPerSpine}`);
    }
  }
  
  return issues;
}

/**
 * Allocates uplinks for multi-class fabric supporting different leaf classes
 * Each class operates independently with cross-class spine sharing
 * 
 * @param fabricSpec - The fabric specification with leaf classes
 * @param switchProfiles - Map of model ID to switch profile
 * @param spineProfile - Spine switch profile (shared across all classes)
 * @returns MultiClassAllocationResult with per-class allocations
 */
export function allocateMultiClassUplinks(
  fabricSpec: FabricSpec,
  switchProfiles: Map<string, SwitchProfile>,
  spineProfile: SwitchProfile
): MultiClassAllocationResult {
  if (!fabricSpec.leafClasses || fabricSpec.leafClasses.length === 0) {
    // Fallback to legacy single-class mode for backwards compatibility
    if (fabricSpec.uplinksPerLeaf !== undefined && fabricSpec.endpointCount !== undefined) {
      const leafProfile = switchProfiles.get(fabricSpec.leafModelId);
      if (!leafProfile) {
        return {
          classAllocations: [],
          spineUtilization: [],
          totalLeavesAllocated: 0,
          overallIssues: [`Leaf profile not found for model: ${fabricSpec.leafModelId}`]
        };
      }
      
      const legacySpec: AllocationSpec = {
        uplinksPerLeaf: fabricSpec.uplinksPerLeaf,
        leavesNeeded: Math.ceil(fabricSpec.endpointCount / (48 - fabricSpec.uplinksPerLeaf)),
        spinesNeeded: Math.max(1, Math.ceil((Math.ceil(fabricSpec.endpointCount / (48 - fabricSpec.uplinksPerLeaf)) * fabricSpec.uplinksPerLeaf) / 32)),
        endpointCount: fabricSpec.endpointCount
      };
      
      const legacyResult = allocateUplinks(legacySpec, leafProfile, spineProfile);
      return {
        classAllocations: [],
        spineUtilization: legacyResult.spineUtilization,
        totalLeavesAllocated: legacyResult.leafMaps.length,
        overallIssues: legacyResult.issues,
        legacy: legacyResult
      };
    }
    
    return {
      classAllocations: [],
      spineUtilization: [],
      totalLeavesAllocated: 0,
      overallIssues: ['No leaf classes defined']
    };
  }

  const leafClasses = fabricSpec.leafClasses;
  const sortedClasses = [...leafClasses].sort((a, b) => a.id.localeCompare(b.id));
  
  // Calculate total spines needed across all classes
  let totalUplinks = 0;
  const classSpecs: ClassAllocationSpec[] = [];
  const overallIssues: string[] = [];
  
  for (const leafClass of sortedClasses) {
    const classEndpoints = leafClass.endpointProfiles.reduce((sum, profile) => sum + (profile.count || 0), 0);
    const leafModelId = leafClass.leafModelId || fabricSpec.leafModelId;
    const leafProfile = switchProfiles.get(leafModelId);
    
    if (!leafProfile) {
      overallIssues.push(`Leaf profile not found for class ${leafClass.id} model: ${leafModelId}`);
      continue;
    }
    
    const downlinkPorts = 48 - leafClass.uplinksPerLeaf; // DS2000 stub
    const classLeavesNeeded = Math.ceil(classEndpoints / Math.max(1, downlinkPorts));
    
    totalUplinks += classLeavesNeeded * leafClass.uplinksPerLeaf;
    
    const classSpec: ClassAllocationSpec = {
      classId: leafClass.id,
      leafModelId,
      uplinksPerLeaf: leafClass.uplinksPerLeaf,
      leavesNeeded: classLeavesNeeded,
      spinesNeeded: 0, // Will be calculated globally
      endpointCount: classEndpoints
    };
    
    classSpecs.push(classSpec);
  }
  
  const totalSpines = Math.max(1, Math.ceil(totalUplinks / 32)); // DS3000 stub
  
  // Validate per-class spine divisibility constraint
  for (const classSpec of classSpecs) {
    if (classSpec.uplinksPerLeaf % totalSpines !== 0) {
      overallIssues.push(`Class ${classSpec.classId}: uplinksPerLeaf (${classSpec.uplinksPerLeaf}) must be divisible by spines (${totalSpines})`);
    }
  }
  
  if (overallIssues.length > 0) {
    return {
      classAllocations: [],
      spineUtilization: new Array(totalSpines).fill(0),
      totalLeavesAllocated: 0,
      overallIssues
    };
  }
  
  // Perform per-class allocation with shared spine tracking
  const classAllocations: LeafClassAllocationResult[] = [];
  const sharedSpineUtilization: number[] = new Array(totalSpines).fill(0);
  const spineUsedPorts: Set<string>[] = Array.from(
    { length: totalSpines }, 
    () => new Set<string>()
  );
  
  let globalLeafId = 0;
  
  for (const classSpec of classSpecs) {
    const leafModelId = classSpec.leafModelId || fabricSpec.leafModelId;
    const leafProfile = switchProfiles.get(leafModelId)!;
    
    // Update spec with global spine count
    const updatedSpec: AllocationSpec = {
      ...classSpec,
      spinesNeeded: totalSpines
    };
    
    const classResult = performMultiClassAllocation(
      updatedSpec,
      leafProfile,
      spineProfile,
      globalLeafId,
      sharedSpineUtilization,
      spineUsedPorts
    );
    
    if (classResult.issues.length > 0) {
      return {
        classAllocations: [],
        spineUtilization: sharedSpineUtilization,
        totalLeavesAllocated: globalLeafId,
        overallIssues: classResult.issues
      };
    }
    
    classAllocations.push({
      classId: classSpec.classId,
      leafMaps: classResult.leafMaps,
      totalEndpoints: classSpec.endpointCount,
      leavesAllocated: classResult.leafMaps.length,
      issues: classResult.issues
    });
    
    globalLeafId += classResult.leafMaps.length;
  }
  
  return {
    classAllocations,
    spineUtilization: sharedSpineUtilization,
    totalLeavesAllocated: globalLeafId,
    overallIssues: []
  };
}

/**
 * Performs allocation for a single class within multi-class fabric
 * with shared spine utilization tracking
 */
function performMultiClassAllocation(
  spec: AllocationSpec,
  leafProfile: SwitchProfile,
  spineProfile: SwitchProfile,
  startingLeafId: number,
  sharedSpineUtilization: number[],
  spineUsedPorts: Set<string>[]
): AllocationResult {
  // Validate constraints first
  const validationResult = validateAllocationConstraints(spec, leafProfile, spineProfile);
  if (validationResult.length > 0) {
    return {
      leafMaps: [],
      spineUtilization: [...sharedSpineUtilization],
      issues: validationResult
    };
  }
  
  const leafFabricPorts = expandPortRanges(leafProfile.ports.fabricAssignable);
  const spineFabricPorts = expandPortRanges(spineProfile.ports.fabricAssignable);
  
  // Check capacity
  if (leafFabricPorts.length < spec.uplinksPerLeaf) {
    return {
      leafMaps: [],
      spineUtilization: [...sharedSpineUtilization],
      issues: [`Leaf has only ${leafFabricPorts.length} fabric ports, need ${spec.uplinksPerLeaf}`]
    };
  }
  
  const leafMaps: LeafAllocation[] = [];
  const uplinksPerSpine = spec.uplinksPerLeaf / spec.spinesNeeded;
  
  for (let leafIdx = 0; leafIdx < spec.leavesNeeded; leafIdx++) {
    const leafUplinks: UplinkAssignment[] = [];
    let leafPortIndex = 0;
    
    // Assign uplinks in round-robin fashion across spines
    for (let spineId = 0; spineId < spec.spinesNeeded; spineId++) {
      for (let i = 0; i < uplinksPerSpine; i++) {
        const leafPort = leafFabricPorts[leafPortIndex];
        leafPortIndex++;
        
        // Get next available spine port
        const spinePort = getNextAvailablePort(spineUsedPorts[spineId], spineFabricPorts);
        if (!spinePort) {
          return {
            leafMaps: [],
            spineUtilization: [...sharedSpineUtilization],
            issues: [`Ran out of spine fabric ports for spine ${spineId}`]
          };
        }
        
        // Mark spine port as used and update utilization
        spineUsedPorts[spineId].add(spinePort);
        sharedSpineUtilization[spineId]++;
        
        leafUplinks.push({
          port: leafPort,
          toSpine: spineId
        });
      }
    }
    
    leafMaps.push({
      leafId: startingLeafId + leafIdx,
      uplinks: leafUplinks
    });
  }
  
  return {
    leafMaps,
    spineUtilization: [...sharedSpineUtilization],
    issues: []
  };
}