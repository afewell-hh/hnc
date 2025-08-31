/**
 * Counts-First Uplink Allocator - HNC v0.3
 * Pure function implementation for computing legal uplink port maps
 */

import { expandPortRanges, getNextAvailablePort } from './portUtils.js';

/**
 * Allocates uplink ports for leaves to spines using round-robin distribution
 * 
 * This is a pure function that computes legal uplink port maps given:
 * - uplinksPerLeaf and model profiles
 * - Mathematical constraints (even distribution, capacity limits)
 * - Deterministic port ordering (lowest ports first)
 * 
 * @param {Object} spec - Allocation specification with counts and requirements
 * @param {Object} leafProfile - Switch profile for leaf devices
 * @param {Object} spineProfile - Switch profile for spine devices  
 * @returns {Object} AllocationResult with port maps and validation issues
 */
export function allocateUplinks(spec, leafProfile, spineProfile) {
  const issues = [];
  
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
function validateAllocationConstraints(spec, leafProfile, spineProfile) {
  const issues = [];
  
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
function performRoundRobinAllocation(spec, leafFabricPorts, spineFabricPorts) {
  const leafMaps = [];
  const spineUtilization = new Array(spec.spinesNeeded).fill(0);
  const spineUsedPorts = Array.from(
    { length: spec.spinesNeeded }, 
    () => new Set()
  );
  
  const uplinksPerSpine = spec.uplinksPerLeaf / spec.spinesNeeded;
  
  // Allocate ports for each leaf - each leaf reuses the same port names
  for (let leafId = 0; leafId < spec.leavesNeeded; leafId++) {
    const leafUplinks = [];
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
export function validateAllocationResult(result, spec) {
  const issues = [];
  
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