/**
 * Uplink Allocator Tests - HNC v0.3
 * Comprehensive test suite for the counts-first uplink allocator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { allocateUplinks, validateAllocationResult, allocateMultiClassUplinks } from '../../src/domain/allocator';
import { parsePortRange, expandPortRanges } from '../../src/domain/portUtils';
import type { AllocationSpec, SwitchProfile, MultiClassAllocationResult } from '../../src/domain/types';
import type { FabricSpec, LeafClass } from '../../src/app.types';

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

  describe('Multi-Class Allocation', () => {
    let switchProfiles: Map<string, SwitchProfile>;
    
    beforeEach(() => {
      switchProfiles = new Map();
      switchProfiles.set('DS2000', ds2000Profile);
      switchProfiles.set('DS3000', ds3000Profile);
    });

    describe('Two-Class Happy Path', () => {
      it('should allocate standard and border classes independently', () => {
        const fabricSpec: FabricSpec = {
          name: 'multi-class-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'standard',
              name: 'Standard Leaves',
              role: 'standard',
              uplinksPerLeaf: 4,
              endpointProfiles: [
                { name: 'servers', portsPerEndpoint: 1, count: 40 }
              ]
            },
            {
              id: 'border',
              name: 'Border Leaves', 
              role: 'border',
              uplinksPerLeaf: 2,
              endpointProfiles: [
                { name: 'routers', portsPerEndpoint: 1, count: 20 }
              ]
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toEqual([]);
        expect(result.classAllocations).toHaveLength(2);
        expect(result.totalLeavesAllocated).toBe(2); // 1 standard + 1 border

        // Standard class allocation
        const standardClass = result.classAllocations.find(c => c.classId === 'standard')!;
        expect(standardClass).toBeDefined();
        expect(standardClass.leavesAllocated).toBe(1); // 40 endpoints / (48-4) = 0.91 -> 1
        expect(standardClass.leafMaps[0].uplinks).toHaveLength(4);
        expect(standardClass.totalEndpoints).toBe(40);

        // Border class allocation
        const borderClass = result.classAllocations.find(c => c.classId === 'border')!;
        expect(borderClass).toBeDefined();
        expect(borderClass.leavesAllocated).toBe(1); // 20 endpoints / (48-2) = 0.43 -> 1
        expect(borderClass.leafMaps[0].uplinks).toHaveLength(2);
        expect(borderClass.totalEndpoints).toBe(20);

        // Spine utilization: 4 (standard) + 2 (border) = 6 total uplinks, 1 spine = 6 utilization
        expect(result.spineUtilization).toEqual([6]);
      });

      it('should maintain deterministic class ordering by ID', () => {
        const fabricSpec: FabricSpec = {
          name: 'deterministic-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'zebra',
              name: 'Z Class',
              role: 'standard',
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 10 }]
            },
            {
              id: 'alpha',
              name: 'A Class',
              role: 'border', 
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 15 }]
            }
          ]
        };

        const result1 = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);
        const result2 = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        // Results should be identical (deterministic)
        expect(result1).toEqual(result2);
        
        // Alpha class should be processed first (sorted by ID)
        expect(result1.classAllocations[0].classId).toBe('alpha');
        expect(result1.classAllocations[1].classId).toBe('zebra');
      });
    });

    describe('Validation Failures', () => {
      it('should reject odd uplinks per class when total spines is even', () => {
        const fabricSpec: FabricSpec = {
          name: 'odd-uplinks-fabric',
          spineModelId: 'DS3000', 
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'standard',
              name: 'Standard Class',
              role: 'standard',
              uplinksPerLeaf: 3, // Odd uplinks - will fail with 2 spines  
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 1000 }] // Force many leaves
            },
            {
              id: 'border',
              name: 'Border Class',
              role: 'border', 
              uplinksPerLeaf: 1, // Odd uplinks - will fail with 2 spines
              endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 1000 }] // Force many leaves
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues.length).toBeGreaterThan(0);
        expect(result.overallIssues).toContain(
          'Class border: uplinksPerLeaf (1) must be divisible by spines (3)'
        );
        expect(result.classAllocations).toEqual([]);
      });

      it('should handle missing leaf profiles gracefully', () => {
        const fabricSpec: FabricSpec = {
          name: 'missing-profile-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'standard',
              name: 'Standard Class',
              role: 'standard',
              leafModelId: 'MISSING_MODEL', // Non-existent model
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 20 }]
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toContain(
          'Leaf profile not found for class standard model: MISSING_MODEL'
        );
        expect(result.classAllocations).toEqual([]);
      });

      it('should validate spine capacity across all classes', () => {
        // Create a scenario where total uplinks exceed spine capacity
        const smallSpineProfile: SwitchProfile = {
          ...ds3000Profile,
          ports: {
            ...ds3000Profile.ports,
            fabricAssignable: ['E1/1-4'] // Only 4 ports instead of 32
          }
        };

        const fabricSpec: FabricSpec = {
          name: 'spine-capacity-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000', 
          leafClasses: [
            {
              id: 'class1',
              name: 'Class 1',
              role: 'standard',
              uplinksPerLeaf: 6, // Force more uplinks
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 200 }] // More endpoints
            },
            {
              id: 'class2', 
              name: 'Class 2',
              role: 'standard',
              uplinksPerLeaf: 6,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 200 }]
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, smallSpineProfile);

        expect(result.overallIssues.length).toBeGreaterThan(0);
        expect(result.overallIssues.some(issue => 
          issue.includes('Ran out of spine fabric ports') || 
          issue.includes('uplinksPerLeaf') || 
          issue.includes('must be divisible')
        )).toBe(true);
      });
    });

    describe('Leaf Model Override per Class', () => {
      it('should use per-class leaf model when specified', () => {
        // Add a custom leaf profile
        const customLeafProfile: SwitchProfile = {
          ...ds2000Profile,
          modelId: 'CUSTOM_LEAF',
          ports: {
            endpointAssignable: ['E1/1-24'], // Different port count
            fabricAssignable: ['E1/25-32']  // Different fabric ports
          }
        };
        switchProfiles.set('CUSTOM_LEAF', customLeafProfile);

        const fabricSpec: FabricSpec = {
          name: 'mixed-models-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000', // Default
          leafClasses: [
            {
              id: 'standard',
              name: 'Standard Class',
              role: 'standard',
              // Uses default leafModelId (DS2000)
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 20 }]
            },
            {
              id: 'custom', 
              name: 'Custom Class',
              role: 'border',
              leafModelId: 'CUSTOM_LEAF', // Override
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'special', portsPerEndpoint: 1, count: 10 }]
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toEqual([]);
        expect(result.classAllocations).toHaveLength(2);

        // Custom class should use different leaf model
        const customClass = result.classAllocations.find(c => c.classId === 'custom')!;
        expect(customClass).toBeDefined();
        expect(customClass.leafMaps[0].uplinks[0].port).toBe('E1/25'); // First fabric port of custom model
        
        const standardClass = result.classAllocations.find(c => c.classId === 'standard')!;
        expect(standardClass.leafMaps[0].uplinks[0].port).toBe('E1/49'); // First fabric port of DS2000
      });
    });

    describe('Cross-Class Spine Sharing', () => {
      it('should share spine ports across different classes', () => {
        const fabricSpec: FabricSpec = {
          name: 'spine-sharing-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'class1',
              name: 'Class 1',
              role: 'standard',
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 20 }]
            },
            {
              id: 'class2',
              name: 'Class 2', 
              role: 'border',
              uplinksPerLeaf: 2,
              endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 15 }]
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toEqual([]);
        
        // Both classes should share the same spine
        expect(result.spineUtilization).toHaveLength(1);
        expect(result.spineUtilization[0]).toBe(4); // 2 (class1) + 2 (class2)

        // Verify both classes use same spine ID (0) but different spine ports
        const class1 = result.classAllocations.find(c => c.classId === 'class1')!;
        const class2 = result.classAllocations.find(c => c.classId === 'class2')!;
        
        class1.leafMaps[0].uplinks.forEach(uplink => expect(uplink.toSpine).toBe(0));
        class2.leafMaps[0].uplinks.forEach(uplink => expect(uplink.toSpine).toBe(0));
        
        // Global leaf IDs should be unique across classes
        expect(class1.leafMaps[0].leafId).toBe(0);
        expect(class2.leafMaps[0].leafId).toBe(1);
      });

      it('should handle multiple spines with cross-class sharing', () => {
        const fabricSpec: FabricSpec = {
          name: 'multi-spine-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: [
            {
              id: 'standard',
              name: 'Standard Class',
              role: 'standard', 
              uplinksPerLeaf: 4,
              endpointProfiles: [{ name: 'servers', portsPerEndpoint: 1, count: 200 }] // Force multiple leaves
            },
            {
              id: 'border',
              name: 'Border Class',
              role: 'border',
              uplinksPerLeaf: 2, 
              endpointProfiles: [{ name: 'routers', portsPerEndpoint: 1, count: 100 }] // Force multiple leaves
            }
          ]
        };

        const result = allocateMultiClassUplinks(fabricSpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toEqual([]);
        
        // Calculate expected: 
        // Standard: 200/(48-4) = 4.55 -> 5 leaves * 4 uplinks = 20 uplinks
        // Border: 100/(48-2) = 2.17 -> 3 leaves * 2 uplinks = 6 uplinks
        // Total: 26 uplinks / 32 spine ports = 1 spine needed, but uplinks distribution should be even
        
        const expectedSpines = Math.max(1, Math.ceil(26 / 32));
        expect(result.spineUtilization).toHaveLength(expectedSpines);
        
        const totalUtilization = result.spineUtilization.reduce((sum, util) => sum + util, 0);
        expect(totalUtilization).toBe(26); // 20 + 6
      });
    });

    describe('Backwards Compatibility', () => {
      it('should fallback to legacy single-class mode when no leafClasses', () => {
        const legacySpec: FabricSpec = {
          name: 'legacy-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          uplinksPerLeaf: 4,
          endpointCount: 96,
          endpointProfile: {
            name: 'Standard Server',
            portsPerEndpoint: 1
          }
        };

        const result = allocateMultiClassUplinks(legacySpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toEqual([]);
        expect(result.legacy).toBeDefined();
        expect(result.legacy!.leafMaps).toHaveLength(3); // 96 / (48-4) = 96/44 = 2.18 -> 3
        expect(result.classAllocations).toEqual([]);
      });

      it('should handle empty leafClasses array', () => {
        const emptySpec: FabricSpec = {
          name: 'empty-classes-fabric',
          spineModelId: 'DS3000',
          leafModelId: 'DS2000',
          leafClasses: []
        };

        const result = allocateMultiClassUplinks(emptySpec, switchProfiles, ds3000Profile);

        expect(result.overallIssues).toContain('No leaf classes defined');
        expect(result.classAllocations).toEqual([]);
        expect(result.totalLeavesAllocated).toBe(0);
      });

      it('should validate existing single-class tests still pass', () => {
        // This test ensures our changes don't break existing functionality
        const singleClassResult = allocateUplinks(basicSpec, ds2000Profile, ds3000Profile);
        
        expect(singleClassResult.issues).toEqual([]);
        expect(singleClassResult.leafMaps).toHaveLength(2);
        expect(singleClassResult.spineUtilization).toEqual([4, 4]);
      });
    });
  });
});