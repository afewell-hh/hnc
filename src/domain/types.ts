/**
 * Allocator Type Definitions - HNC v0.3
 * Types for the counts-first uplink allocator
 */

export interface AllocationSpec {
  uplinksPerLeaf: number;
  leavesNeeded: number;
  spinesNeeded: number;
  endpointCount: number;
}

export interface UplinkAssignment {
  port: string;
  toSpine: number;
}

export interface LeafAllocation {
  leafId: number;
  uplinks: UplinkAssignment[];
}

export interface AllocationResult {
  leafMaps: LeafAllocation[];
  spineUtilization: number[];  // ports used per spine
  issues: string[];  // validation errors
}

// Re-export SwitchProfile from ingest types for convenience
export { SwitchProfile, ProfilePorts, PortProfile } from '../ingest/types';