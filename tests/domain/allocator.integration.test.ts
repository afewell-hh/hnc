/**
 * Allocator Integration Tests - HNC v0.3
 * Integration tests with realistic switch profiles and scenarios
 */

import { describe, it, expect } from 'vitest';
import { allocateUplinks } from '../../src/domain/allocator';
import type { AllocationSpec, SwitchProfile } from '../../src/domain/types';

describe('Allocator Integration Tests', () => {
  // Realistic switch profiles based on actual hardware
  const realisticDS2000: SwitchProfile = {
    modelId: 'DS2000-48T4X',
    roles: ['leaf'],
    ports: {
      endpointAssignable: ['E1/1-48'],           // 48 x 25G endpoint ports
      fabricAssignable: ['E1/49-52']            // 4 x 100G uplink ports
    },
    profiles: {
      endpoint: { portProfile: '25GBASE-SR', speedGbps: 25 },
      uplink: { portProfile: '100GBASE-SR4', speedGbps: 100 }
    },
    meta: { source: 'integration-test', version: '1.0' }
  };

  const realisticDS3000: SwitchProfile = {
    modelId: 'DS3000-32X',
    roles: ['spine'],
    ports: {
      endpointAssignable: [],                   // No endpoint ports on spine
      fabricAssignable: ['E1/1-32']            // 32 x 100G fabric ports
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 0 },
      uplink: { portProfile: '100GBASE-SR4', speedGbps: 100 }
    },
    meta: { source: 'integration-test', version: '1.0' }
  };

  describe('Typical Fabric Configurations', () => {
    it('should handle small fabric (2 leaves, 2 spines)', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,    // Use all 4 uplink ports on DS2000
        leavesNeeded: 2,
        spinesNeeded: 2,
        endpointCount: 96     // 48 ports × 2 leaves
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(2);
      
      // Validate leaf 0 allocation
      expect(result.leafMaps[0]).toEqual({
        leafId: 0,
        uplinks: [
          { port: 'E1/49', toSpine: 0 },
          { port: 'E1/50', toSpine: 0 },
          { port: 'E1/51', toSpine: 1 },
          { port: 'E1/52', toSpine: 1 }
        ]
      });

      // Validate leaf 1 allocation
      expect(result.leafMaps[1]).toEqual({
        leafId: 1,
        uplinks: [
          { port: 'E1/49', toSpine: 0 },  // Each leaf uses same port names
          { port: 'E1/50', toSpine: 0 },
          { port: 'E1/51', toSpine: 1 },
          { port: 'E1/52', toSpine: 1 }
        ]
      });

      // Each spine should have 4 connections (2 per leaf)
      expect(result.spineUtilization).toEqual([4, 4]);
    });

    it('should handle medium fabric (8 leaves, 4 spines)', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 8,
        spinesNeeded: 4,
        endpointCount: 384    // 48 ports × 8 leaves
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(8);
      
      // Each spine should have 8 connections (1 per leaf)
      expect(result.spineUtilization).toEqual([8, 8, 8, 8]);
      
      // Validate even distribution - each leaf should have 1 uplink to each spine
      for (const leafMap of result.leafMaps) {
        const spineConnections = leafMap.uplinks.reduce((acc, uplink) => {
          acc[uplink.toSpine] = (acc[uplink.toSpine] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        expect(spineConnections).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 });
      }
    });

    it('should detect capacity limits with realistic constraints', () => {
      // Try to connect too many leaves for spine capacity
      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 20,     // 80 total uplinks
        spinesNeeded: 2,      // 40 uplinks per spine, exceeds DS3000's 32 ports
        endpointCount: 960
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toContain(
        'Spine capacity exceeded: need 40 ports, spine has 32 fabricAssignable'
      );
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle minimal uplinks (2 per leaf)', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 2,    // Only use half the available uplink ports
        leavesNeeded: 4,
        spinesNeeded: 2,
        endpointCount: 192
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(4);
      expect(result.spineUtilization).toEqual([4, 4]); // 2 per leaf × 4 leaves ÷ 2 spines

      // Each leaf should use only E1/49 and E1/50 ports
      for (const leafMap of result.leafMaps) {
        const usedPorts = leafMap.uplinks.map(u => u.port);
        expect(usedPorts).toEqual(['E1/49', 'E1/50']);
      }
    });

    it('should handle single spine configuration', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 4,
        spinesNeeded: 1,      // All uplinks go to single spine
        endpointCount: 192
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toEqual([]);
      expect(result.spineUtilization).toEqual([16]); // 4 uplinks × 4 leaves

      // All uplinks should go to spine 0
      for (const leafMap of result.leafMaps) {
        for (const uplink of leafMap.uplinks) {
          expect(uplink.toSpine).toBe(0);
        }
      }
    });

    it('should validate mathematical constraints in realistic scenarios', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 3,    // Odd number, not divisible by 2 spines
        leavesNeeded: 2,
        spinesNeeded: 2,
        endpointCount: 96
      };

      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);

      expect(result.issues).toContain(
        'Uplinks per leaf (3) must be divisible by number of spines (2)'
      );
    });
  });

  describe('Performance with Realistic Scale', () => {
    it('should handle maximum single-rack deployment', () => {
      // Maximum realistic single-rack: 32 leaves with 4 spines
      // Limited by DS2000 having only 4 uplink ports
      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 32,
        spinesNeeded: 4,
        endpointCount: 1536   // 48 ports × 32 leaves
      };

      const startTime = Date.now();
      const result = allocateUplinks(spec, realisticDS2000, realisticDS3000);
      const endTime = Date.now();

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(32);
      expect(result.spineUtilization).toEqual([32, 32, 32, 32]);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast

      // Validate that all spine capacity is fully utilized
      const totalSpineCapacity = 4 * 32; // 4 spines × 32 ports each = 128
      const usedSpineCapacity = result.spineUtilization.reduce((a, b) => a + b, 0);
      expect(usedSpineCapacity).toBe(128);
    });
  });

  describe('Real-World Fabric Patterns', () => {
    it('should support 3-tier leaf-spine-superspine pattern (simulated)', () => {
      // Simulate a superspine scenario by treating spines as "leaf" to superspine
      const spineAsLeafSpec: AllocationSpec = {
        uplinksPerLeaf: 8,    // Spines uplink to superspine
        leavesNeeded: 4,      // 4 spine switches
        spinesNeeded: 2,      // 2 superspine switches  
        endpointCount: 0      // No endpoints at this tier
      };

      // Use DS3000 as both "leaf" and "spine" for this tier
      const result = allocateUplinks(spineAsLeafSpec, realisticDS3000, realisticDS3000);

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(4);
      expect(result.spineUtilization).toEqual([16, 16]); // 8 × 4 ÷ 2 = 16 each
    });

    it('should handle high-radix spine configurations', () => {
      // Create a high-radix spine switch profile
      const highRadixSpine: SwitchProfile = {
        ...realisticDS3000,
        modelId: 'DS5000-64X',
        ports: {
          ...realisticDS3000.ports,
          fabricAssignable: ['E1/1-64']   // 64 ports instead of 32
        }
      };

      const spec: AllocationSpec = {
        uplinksPerLeaf: 4,
        leavesNeeded: 64,     // Much larger leaf count
        spinesNeeded: 4,
        endpointCount: 3072   // 48 × 64 leaves
      };

      const result = allocateUplinks(spec, realisticDS2000, highRadixSpine);

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(64);
      expect(result.spineUtilization).toEqual([64, 64, 64, 64]);
      
      // Full utilization of all spine ports
      expect(result.spineUtilization.every(util => util === 64)).toBe(true);
    });
  });
});