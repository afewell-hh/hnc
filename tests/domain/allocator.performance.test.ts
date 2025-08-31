/**
 * Allocator Performance Tests - HNC v0.3
 * Validates performance requirements for the counts-first uplink allocator
 */

import { describe, it, expect } from 'vitest';
import { allocateUplinks } from '../../src/domain/allocator';
import type { AllocationSpec, SwitchProfile } from '../../src/domain/types';

describe('Allocator Performance Validation', () => {
  // Large-scale switch profiles for performance testing
  const highCapacityLeaf: SwitchProfile = {
    modelId: 'DS-PERF-LEAF',
    roles: ['leaf'],
    ports: {
      endpointAssignable: ['E1/1-128'],
      fabricAssignable: ['E1/129-192']  // 64 uplink ports
    },
    profiles: {
      endpoint: { portProfile: '25GBASE-SR', speedGbps: 25 },
      uplink: { portProfile: '100GBASE-SR4', speedGbps: 100 }
    },
    meta: { source: 'performance-test', version: '1.0' }
  };

  const highCapacitySpine: SwitchProfile = {
    modelId: 'DS-PERF-SPINE',
    roles: ['spine'],
    ports: {
      endpointAssignable: [],
      fabricAssignable: ['E1/1-256']   // 256 fabric ports
    },
    profiles: {
      endpoint: { portProfile: null, speedGbps: 0 },
      uplink: { portProfile: '100GBASE-SR4', speedGbps: 100 }
    },
    meta: { source: 'performance-test', version: '1.0' }
  };

  describe('Required Performance Benchmarks', () => {
    it('should complete allocation under 100ms for reasonable scale', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 16,
        leavesNeeded: 32,
        spinesNeeded: 8,
        endpointCount: 4096
      };

      const startTime = performance.now();
      const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(32);
      expect(duration).toBeLessThan(100); // Required: < 100ms

      console.log(`✅ Allocation completed in ${duration.toFixed(2)}ms for ${spec.leavesNeeded} leaves`);
    });

    it('should handle maximum realistic scale efficiently', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 32,
        leavesNeeded: 64,    // Very large fabric
        spinesNeeded: 16,
        endpointCount: 8192
      };

      const startTime = performance.now();
      const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(64);
      expect(duration).toBeLessThan(500); // Should be very fast even at scale

      // Validate correct utilization
      const totalUplinks = spec.leavesNeeded * spec.uplinksPerLeaf; // 64 * 32 = 2048
      const expectedPerSpine = totalUplinks / spec.spinesNeeded;    // 2048 / 16 = 128
      expect(result.spineUtilization.every(util => util === expectedPerSpine)).toBe(true);

      console.log(`✅ Large-scale allocation completed in ${duration.toFixed(2)}ms for ${totalUplinks} total uplinks`);
    });

    it('should maintain consistent performance across multiple runs', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: 16,
        spinesNeeded: 4,
        endpointCount: 2048
      };

      const durations: number[] = [];
      const runs = 10;

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
        const endTime = performance.now();

        expect(result.issues).toEqual([]);
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / runs;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      expect(avgDuration).toBeLessThan(50);  // Average should be very fast
      expect(maxDuration).toBeLessThan(100); // Even worst case under 100ms

      console.log(`✅ Consistent performance: avg=${avgDuration.toFixed(2)}ms, min=${minDuration.toFixed(2)}ms, max=${maxDuration.toFixed(2)}ms`);
    });

    it('should demonstrate O(n) linear complexity', () => {
      const baseSpec = {
        uplinksPerLeaf: 8,
        spinesNeeded: 4,
        endpointCount: 0
      };

      const results: Array<{ leaves: number; duration: number; ratio: number }> = [];

      // Test with increasing leaf counts
      for (const leavesNeeded of [4, 8, 16, 32]) {
        const spec: AllocationSpec = { ...baseSpec, leavesNeeded };

        const startTime = performance.now();
        const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
        const endTime = performance.now();

        expect(result.issues).toEqual([]);
        
        const duration = endTime - startTime;
        const ratio = duration / leavesNeeded; // Duration per leaf

        results.push({ leaves: leavesNeeded, duration, ratio });
      }

      // Print complexity analysis
      console.log('📊 Complexity Analysis:');
      results.forEach(r => {
        console.log(`  ${r.leaves} leaves: ${r.duration.toFixed(2)}ms (${r.ratio.toFixed(3)}ms per leaf)`);
      });

      // Verify roughly linear complexity (ratio shouldn't grow significantly)
      const ratios = results.map(r => r.ratio);
      const firstRatio = ratios[0];
      const lastRatio = ratios[ratios.length - 1];
      
      // Last ratio shouldn't be more than 3x the first ratio for linear complexity
      expect(lastRatio / firstRatio).toBeLessThan(3);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not consume excessive memory for large allocations', () => {
      const spec: AllocationSpec = {
        uplinksPerLeaf: 16,
        leavesNeeded: 100,   // Very large leaf count
        spinesNeeded: 8,
        endpointCount: 12800
      };

      // Monitor memory before allocation
      const memBefore = process.memoryUsage().heapUsed;
      
      const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
      
      // Monitor memory after allocation
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      expect(result.issues).toEqual([]);
      expect(result.leafMaps).toHaveLength(100);
      
      // Memory growth should be reasonable (< 10MB for 100 leaves)
      expect(memDelta).toBeLessThan(10 * 1024 * 1024);
      
      console.log(`✅ Memory usage for 100 leaves: ${(memDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should clean up properly and not leak memory', () => {
      // Run multiple large allocations to test for leaks
      const spec: AllocationSpec = {
        uplinksPerLeaf: 8,
        leavesNeeded: 50,
        spinesNeeded: 4,
        endpointCount: 6400
      };

      const memBefore = process.memoryUsage().heapUsed;

      // Run multiple allocations
      for (let i = 0; i < 10; i++) {
        const result = allocateUplinks(spec, highCapacityLeaf, highCapacitySpine);
        expect(result.issues).toEqual([]);
        expect(result.leafMaps).toHaveLength(50);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      // Memory growth should be minimal after multiple runs
      expect(memDelta).toBeLessThan(5 * 1024 * 1024);
      
      console.log(`✅ Memory after 10 large allocations: ${(memDelta / 1024 / 1024).toFixed(2)}MB delta`);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle error cases efficiently', () => {
      const invalidSpec: AllocationSpec = {
        uplinksPerLeaf: 3,  // Odd number - will fail
        leavesNeeded: 100,
        spinesNeeded: 2,
        endpointCount: 4800
      };

      const startTime = performance.now();
      const result = allocateUplinks(invalidSpec, highCapacityLeaf, highCapacitySpine);
      const endTime = performance.now();

      expect(result.issues.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10); // Error cases should be very fast

      console.log(`✅ Error case handled in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should handle capacity exceeded cases efficiently', () => {
      const overCapacitySpec: AllocationSpec = {
        uplinksPerLeaf: 32,
        leavesNeeded: 100,  // Way too many leaves
        spinesNeeded: 4,
        endpointCount: 12800
      };

      const startTime = performance.now();
      const result = allocateUplinks(overCapacitySpec, highCapacityLeaf, highCapacitySpine);
      const endTime = performance.now();

      expect(result.issues.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10); // Should fail fast

      console.log(`✅ Capacity exceeded detected in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });
});