/**
 * Uplink Allocator Tests - HNC v0.3
 * Comprehensive test suite for the counts-first uplink allocator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { allocateUplinks, validateAllocationResult } from '../../src/domain/allocator';
import { parsePortRange, expandPortRanges } from '../../src/domain/portUtils';
import type { AllocationSpec, SwitchProfile } from '../../src/domain/types';

describe('Port Range Parsing', () => {
  it('should parse range format E1/49-56', () => {
    const result = parsePortRange('E1/49-56');
    expect(result).toEqual([
      'E1/49', 'E1/50', 'E1/51', 'E1/52',
      'E1/53', 'E1/54', 'E1/55', 'E1/56'
    ]);
  });

  it('should handle discrete port arrays', () => {
    const input = ['E1/1', 'E1/3', 'E1/5'];
    const result = parsePortRange(input);
    expect(result).toEqual(['E1/1', 'E1/3', 'E1/5']);
  });

  it('should handle single port strings', () => {
    const result = parsePortRange('E1/10');
    expect(result).toEqual(['E1/10']);
  });

  it('should handle invalid ranges gracefully', () => {
    const result = parsePortRange('E1/56-49'); // backwards
    expect(result).toEqual([]);
  });

  it('should expand multiple port ranges', () => {
    const result = expandPortRanges(['E1/1-3', 'E1/10', 'E1/20-21']);
    expect(result).toEqual([
      'E1/1', 'E1/2', 'E1/3', 'E1/10', 'E1/20', 'E1/21'
    ]);
  });

  it('should remove duplicates and sort', () => {
    const result = expandPortRanges(['E1/3', 'E1/1', 'E1/2', 'E1/1']);
    expect(result).toEqual(['E1/1', 'E1/2', 'E1/3']);
  });
});

describe('Uplink Allocator', () => {
  let ds2000Profile: SwitchProfile;
  let ds3000Profile: SwitchProfile;
  let basicSpec: AllocationSpec;

  beforeEach(() => {
    // DS2000 Leaf Profile (48 endpoint + 8 uplink ports)
    ds2000Profile = {
      modelId: 'DS2000',
      roles: ['leaf'],
      ports: {
        endpointAssignable: ['E1/1-48'],
        fabricAssignable: ['E1/49-56']
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 25 },
        uplink: { portProfile: 'uplink', speedGbps: 100 }
      },
      meta: { source: 'fixture', version: '1.0' }
    };

    // DS3000 Spine Profile (32 fabric ports)
    ds3000Profile = {
      modelId: 'DS3000',
      roles: ['spine'],
      ports: {
        endpointAssignable: [],
        fabricAssignable: ['E1/1-32']
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 0 },
        uplink: { portProfile: 'fabric', speedGbps: 100 }
      },
      meta: { source: 'fixture', version: '1.0' }
    };

    basicSpec = {
      uplinksPerLeaf: 4,
      leavesNeeded: 2,
      spinesNeeded: 2,
      endpointCount: 96
    };
  });

  describe('Happy Path Scenarios', () => {
    it('should allocate uplinks with even distribution', () => {
      const result = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(2);
      expect(result.spineUtilization).toEqual([4, 4]);
      
      // Validate leaf 0 uplinks
      const leaf0 = result.leafMaps[0];
      expect(leaf0.leafId).toBe(0);
      expect(leaf0.uplinks).toHaveLength(4);
      expect(leaf0.uplinks[0]).toEqual({ port: 'E1/49', toSpine: 0 });
      expect(leaf0.uplinks[1]).toEqual({ port: 'E1/50', toSpine: 0 });
      expect(leaf0.uplinks[2]).toEqual({ port: 'E1/51', toSpine: 1 });
      expect(leaf0.uplinks[3]).toEqual({ port: 'E1/52', toSpine: 1 });
      
      // Validate leaf 1 uplinks (each leaf reuses the same port names)
      const leaf1 = result.leafMaps[1];
      expect(leaf1.leafId).toBe(1);
      expect(leaf1.uplinks).toHaveLength(4);
      expect(leaf1.uplinks[0]).toEqual({ port: 'E1/49', toSpine: 0 });
      expect(leaf1.uplinks[1]).toEqual({ port: 'E1/50', toSpine: 0 });
      expect(leaf1.uplinks[2]).toEqual({ port: 'E1/51', toSpine: 1 });
      expect(leaf1.uplinks[3]).toEqual({ port: 'E1/52', toSpine: 1 });
    });

    it('should be deterministic (same input → same output)', () => {
      const result1 = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      const result2 = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      
      expect(result1).toEqual(result2);
    });

    it('should handle single spine configuration', () => {
      const singleSpineSpec = { ...basicSpec, spinesNeeded: 1 };
      const result = allocateUplinks(singleSpineSpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toEqual([]);
      expect(result.spineUtilization).toEqual([8]); // 2 leaves × 4 uplinks
      
      // All uplinks should go to spine 0
      for (const leafMap of result.leafMaps) {
        for (const uplink of leafMap.uplinks) {
          expect(uplink.toSpine).toBe(0);
        }
      }
    });

    it('should handle large fabric allocations', () => {
      // Create a larger leaf profile for this test
      const largeLeafProfile: SwitchProfile = {
        ...ds2000Profile,
        ports: {
          endpointAssignable: ['E1/1-48'],
          fabricAssignable: ['E1/49-80'] // 32 fabric ports instead of 8
        }
      };
      
      const largeSpec: AllocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: 3,
        spinesNeeded: 4,
        endpointCount: 144
      };
      
      const result = allocateUplinks(largeSpec, largeLeafProfile, ds3000Profile);
      
      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(3);
      expect(result.spineUtilization).toEqual([6, 6, 6, 6]); // 24 total uplinks ÷ 4 spines
    });
  });

  describe('Error Cases', () => {
    it('should reject odd uplinks per leaf', () => {
      const oddSpec = { ...basicSpec, uplinksPerLeaf: 3 };
      const result = allocateUplinks(oddSpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toContain(
        'Uplinks per leaf (3) must be divisible by number of spines (2)'
      );
      expect(result.leafMaps).toEqual([]);
      expect(result.spineUtilization).toEqual([0, 0]);
    });

    it('should detect spine capacity exceeded', () => {
      const highCapacitySpec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 20, // 80 total uplinks
        spinesNeeded: 2,  // 40 uplinks per spine, but spine only has 32 ports
        endpointCount: 960
      };
      
      const result = allocateUplinks(highCapacitySpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toContain(
        'Spine capacity exceeded: need 40 ports, spine has 32 fabricAssignable'
      );
    });

    it('should detect insufficient leaf fabric ports', () => {
      const limitedLeafProfile = {
        ...ds2000Profile,
        ports: {
          ...ds2000Profile.ports,
          fabricAssignable: ['E1/49-50'] // Only 2 ports
        }
      };
      
      const result = allocateUplinks(basicSpec, limitedLeafProfile, ds3000Profile);
      
      expect(result.issues).toContain(
        'Leaf has only 2 fabric ports, need 4'
      );
    });

    it('should detect empty fabricAssignable arrays', () => {
      const emptySpineProfile = {
        ...ds3000Profile,
        ports: {
          ...ds3000Profile.ports,
          fabricAssignable: []
        }
      };
      
      const result = allocateUplinks(basicSpec, ds2000Profile, emptySpineProfile);
      
      expect(result.issues).toContain(
        'Spine profile has no fabric ports available'
      );
    });

    it('should validate negative inputs', () => {
      const invalidSpec = {
        uplinksPerLeaf: -1,
        leavesNeeded: 0,
        spinesNeeded: -2,
        endpointCount: 96
      };
      
      const result = allocateUplinks(invalidSpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toContain('Uplinks per leaf must be positive');
      expect(result.issues).toContain('Leaves needed must be positive');
      expect(result.issues).toContain('Spines needed must be positive');
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimal valid configuration', () => {
      const minimalSpec: AllocationSpec = {
        uplinksPerLeaf: 2,
        leavesNeeded: 1,
        spinesNeeded: 1,
        endpointCount: 48
      };
      
      const result = allocateUplinks(minimalSpec, ds2000Profile, ds3000Profile);
      
      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(1);
      expect(result.leafMaps[0].uplinks).toHaveLength(2);
      expect(result.spineUtilization).toEqual([2]);
    });

    it('should handle discrete port lists in profiles', () => {
      const discreteSpineProfile = {
        ...ds3000Profile,
        ports: {
          ...ds3000Profile.ports,
          fabricAssignable: ['E1/1', 'E1/3', 'E1/5', 'E1/7', 'E1/9', 'E1/11']
        }
      };
      
      const result = allocateUplinks(basicSpec, ds2000Profile, discreteSpineProfile);
      
      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(2);
    });

    it('should sort ports correctly for deterministic allocation', () => {
      const unsortedLeafProfile = {
        ...ds2000Profile,
        ports: {
          ...ds2000Profile.ports,
          fabricAssignable: ['E1/56', 'E1/49', 'E1/52', 'E1/50', 'E1/55', 'E1/51', 'E1/54', 'E1/53'] // Unsorted, but enough ports
        }
      };
      
      const result = allocateUplinks(basicSpec, unsortedLeafProfile, ds3000Profile);
      
      expect(result.issues).toEqual([]);
      // Should still use lowest ports first
      expect(result.leafMaps[0].uplinks[0].port).toBe('E1/49');
      expect(result.leafMaps[0].uplinks[1].port).toBe('E1/50');
      expect(result.leafMaps[0].uplinks[2].port).toBe('E1/51');
      expect(result.leafMaps[0].uplinks[3].port).toBe('E1/52');
    });
  });

  describe('Allocation Validation', () => {
    it('should validate correct allocations', () => {
      const result = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      const validationIssues = validateAllocationResult(result, basicSpec);
      
      expect(validationIssues).toEqual([]);
    });

    it('should detect incorrect leaf counts', () => {
      const result = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      const modifiedResult = { ...result, leafMaps: [] };
      
      const validationIssues = validateAllocationResult(modifiedResult, basicSpec);
      
      expect(validationIssues).toContain('Expected 2 leaves, got 0');
    });

    it('should detect uneven spine utilization', () => {
      const result = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
      const modifiedResult = { ...result, spineUtilization: [3, 5] };
      
      const validationIssues = validateAllocationResult(modifiedResult, basicSpec);
      
      expect(validationIssues).toContain('Spine 0 utilization is 3, expected 4');
      expect(validationIssues).toContain('Spine 1 utilization is 5, expected 4');
    });
  });

  describe('Performance Requirements', () => {
    it('should complete allocation within performance limits', () => {
      // Create profiles with enough capacity for this test
      const largeLeafProfile: SwitchProfile = {
        ...ds2000Profile,
        ports: {
          endpointAssignable: ['E1/1-48'],
          fabricAssignable: ['E1/49-208'] // 160 fabric ports
        }
      };
      
      const largeSpineProfile: SwitchProfile = {
        ...ds3000Profile,
        ports: {
          endpointAssignable: [],
          fabricAssignable: ['E1/1-64'] // 64 fabric ports per spine
        }
      };
      
      const largeSpec: AllocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: 20,
        spinesNeeded: 4,
        endpointCount: 960
      };
      
      const startTime = Date.now();
      const result = allocateUplinks(largeSpec, largeLeafProfile, largeSpineProfile);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // < 100ms requirement
      expect(result.issues).toEqual([]); // Should succeed
    });

    it('should handle reasonable scale without memory issues', () => {
      // Create profiles with enough capacity
      const scaleLeafProfile: SwitchProfile = {
        ...ds2000Profile,
        ports: {
          endpointAssignable: ['E1/1-48'],
          fabricAssignable: ['E1/49-304'] // 256 fabric ports
        }
      };
      
      const scaleSpineProfile: SwitchProfile = {
        ...ds3000Profile,
        ports: {
          endpointAssignable: [],
          fabricAssignable: ['E1/1-64'] // 64 fabric ports per spine
        }
      };
      
      const scaleSpec: AllocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: 32,
        spinesNeeded: 8,
        endpointCount: 1536
      };
      
      const result = allocateUplinks(scaleSpec, scaleLeafProfile, scaleSpineProfile);
      
      expect(result.leafMaps).toHaveLength(32);
      expect(result.spineUtilization.every(util => util === 32)).toBe(true);
    });
  });
});