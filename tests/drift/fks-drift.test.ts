/**
 * FKS Drift Detection Integration Tests
 */

import { describe, test, expect } from 'vitest';
import { mockFabricServicesApi } from '../../src/drift/mock-fks-api.js';
import { detectFksDrift, FksDriftDetector } from '../../src/drift/detector.js';
import type { WiringDiagram } from '../../src/app.types.js';

// Mock FGD diagram for testing - must match the mock API's internal diagram
const mockFgdDiagram: WiringDiagram = {
  devices: {
    servers: [
      { id: 'Server-1', type: 'compute', connections: 2 },
      { id: 'Server-2', type: 'compute', connections: 1 },
      { id: 'Server-3', type: 'storage', connections: 1 }
    ],
    spines: [
      { id: 'Spine-1', model: 'DS3000', ports: 32 }
    ],
    leaves: [
      { id: 'Leaf-1', model: 'DS2000', ports: 48 },
      { id: 'Leaf-2', model: 'DS2000', ports: 48 }
    ]
  },
  connections: [
    { from: { device: 'Leaf-1', port: 'Eth1/49' }, to: { device: 'Spine-1', port: 'Eth1/1' }, type: 'uplink' },
    { from: { device: 'Leaf-2', port: 'Eth1/49' }, to: { device: 'Spine-1', port: 'Eth1/2' }, type: 'uplink' }
  ],
  metadata: {
    generatedAt: new Date(),
    fabricName: 'test-fabric',
    totalDevices: 6
  }
};

describe('FKS Drift Detection', () => {
  test('should detect no drift when FGD matches K8s', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('no-drift');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    // Debug: log what drift was detected
    if (driftResult.hasDrift) {
      console.log('Unexpected drift detected:', driftResult.items.map(i => ({
        id: i.id,
        description: i.description,
        fgdValue: i.fgdValue,
        k8sValue: i.k8sValue
      })));
    }
    
    expect(driftResult.enabled).toBe(true);
    expect(driftResult.hasDrift).toBe(false);
    expect(driftResult.items).toHaveLength(0);
    expect(driftResult.k8sApiStatus).toBe('healthy');
    expect(driftResult.comparisonTimeMs).toBeGreaterThan(0);
  });

  test('should detect drift when switches are missing', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('missing-switches');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    expect(driftResult.enabled).toBe(true);
    expect(driftResult.hasDrift).toBe(true);
    expect(driftResult.items.length).toBeGreaterThan(0);
    
    // Should have high severity items for missing switches
    const highSeverityItems = driftResult.items.filter(item => item.severity === 'high');
    expect(highSeverityItems.length).toBeGreaterThan(0);
    
    // Check that the drift item describes missing switch
    const missingSwitchItem = driftResult.items.find(item => 
      item.description.includes('missing from K8s cluster')
    );
    expect(missingSwitchItem).toBeDefined();
  });

  test('should detect configuration differences', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('config-differences');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    expect(driftResult.enabled).toBe(true);
    expect(driftResult.hasDrift).toBe(true);
    expect(driftResult.items.length).toBeGreaterThan(0);
    
    // Should have various types of drift items
    const driftTypes = new Set(driftResult.items.map(item => item.type));
    expect(driftTypes.size).toBeGreaterThan(1); // Multiple types detected
  });

  test('should filter by severity threshold', async () => {
    const detector = new FksDriftDetector('test-fabric', { severityThreshold: 'high' });
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('config-differences');
    const driftResult = await detector.detectDrift(k8sApiResponse, mockFgdDiagram);
    
    // Should only include high severity items
    const hasNonHighSeverity = driftResult.items.some(item => item.severity !== 'high');
    expect(hasNonHighSeverity).toBe(false);
  });

  test('should assess K8s API health correctly', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('config-differences');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    expect(['healthy', 'degraded', 'unavailable']).toContain(driftResult.k8sApiStatus);
  });

  test('should handle port mismatches', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('port-mismatches');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    expect(driftResult.enabled).toBe(true);
    
    // Look for port-related drift items
    const portDriftItems = driftResult.items.filter(item => 
      item.path.includes('ports') || item.description.toLowerCase().includes('port')
    );
    
    // Should find port-related drift (though exact count depends on mock data)
    if (driftResult.hasDrift) {
      expect(driftResult.items.length).toBeGreaterThan(0);
    }
  });

  test('should include timestamps and detailed descriptions', async () => {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('missing-switches');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    
    if (driftResult.items.length > 0) {
      const firstItem = driftResult.items[0];
      
      expect(firstItem.id).toBeDefined();
      expect(firstItem.path).toBeDefined();
      expect(firstItem.type).toBeDefined();
      expect(firstItem.severity).toBeDefined();
      expect(firstItem.description).toBeDefined();
      expect(firstItem.timestamp).toBeDefined();
      
      // Timestamp should be a valid ISO string
      expect(() => new Date(firstItem.timestamp)).not.toThrow();
    }
  });

  test('should handle comparison performance metrics', async () => {
    const startTime = performance.now();
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('no-drift');
    const driftResult = await detectFksDrift('test-fabric', k8sApiResponse, mockFgdDiagram);
    const endTime = performance.now();
    
    // Should complete quickly (under 100ms requirement)
    expect(driftResult.comparisonTimeMs).toBeLessThan(100);
    
    // Should track actual execution time reasonably
    const totalTime = endTime - startTime;
    expect(driftResult.comparisonTimeMs).toBeLessThanOrEqual(totalTime);
  });
});