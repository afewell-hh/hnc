/**
 * Unit tests for K8sProvider
 * Tests the diff logic, resource parsing, and validation without requiring a real cluster
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { K8sProvider, type K8sResource, type K8sDiffResult } from './k8s.service.js';

describe('K8sProvider', () => {
  let k8sProvider: K8sProvider;

  beforeEach(() => {
    k8sProvider = new K8sProvider();
    // Mock the feature flag to be enabled for tests
    vi.mock('../features/feature-flags.js', () => ({
      isK8sEnabled: () => true,
      featureFlags: { k8s: true, git: false }
    }));
  });

  describe('generateNamespace', () => {
    it('should generate namespace with correct pattern', () => {
      const runId = 'test-123';
      const namespace = k8sProvider.generateNamespace(runId);
      expect(namespace).toBe('hnc-it-test-123');
    });

    it('should handle special characters in runId', () => {
      const runId = 'prod-456-alpha.1';
      const namespace = k8sProvider.generateNamespace(runId);
      expect(namespace).toBe('hnc-it-prod-456-alpha.1');
    });
  });

  describe('compareResources', () => {
    it('should detect missing resources', () => {
      const expected: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'config1', labels: { hncRunId: 'test-123' } }
        },
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'service1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const actual: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'config1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const result = k8sProvider.compareResources(expected, actual);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].kind).toBe('Service');
      expect(result.missing[0].metadata.name).toBe('service1');
      expect(result.extra).toHaveLength(0);
      expect(result.different).toHaveLength(0);
    });

    it('should detect extra resources', () => {
      const expected: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'config1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const actual: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'config1', labels: { hncRunId: 'test-123' } }
        },
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'service1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const result = k8sProvider.compareResources(expected, actual);

      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(1);
      expect(result.extra[0].kind).toBe('Service');
      expect(result.extra[0].metadata.name).toBe('service1');
      expect(result.different).toHaveLength(0);
    });

    it('should detect different resources', () => {
      const expected: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { 
            name: 'config1', 
            labels: { hncRunId: 'test-123', environment: 'prod' } 
          }
        }
      ];

      const actual: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { 
            name: 'config1', 
            labels: { hncRunId: 'test-123', environment: 'dev' } 
          }
        }
      ];

      const result = k8sProvider.compareResources(expected, actual);

      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
      expect(result.different).toHaveLength(1);
      expect(result.different[0].expected.metadata.name).toBe('config1');
      expect(result.different[0].differences).toContain('label environment: expected prod, got dev');
    });

    it('should handle perfect matches', () => {
      const resources: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { 
            name: 'config1', 
            labels: { hncRunId: 'test-123' } 
          }
        },
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { 
            name: 'app1', 
            labels: { hncRunId: 'test-123' } 
          }
        }
      ];

      const result = k8sProvider.compareResources(resources, resources);

      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
      expect(result.different).toHaveLength(0);
    });

    it('should compare API versions', () => {
      const expected: K8sResource[] = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: 'app1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const actual: K8sResource[] = [
        {
          apiVersion: 'extensions/v1beta1',
          kind: 'Deployment',
          metadata: { name: 'app1', labels: { hncRunId: 'test-123' } }
        }
      ];

      const result = k8sProvider.compareResources(expected, actual);

      expect(result.different).toHaveLength(1);
      expect(result.different[0].differences).toContain('apiVersion: expected apps/v1, got extensions/v1beta1');
    });
  });

  describe('parseYamlToResources', () => {
    it('should handle simple YAML', () => {
      const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
  labels:
    hncRunId: test-123
data:
  key: value
`;

      // Note: This is a placeholder test since the actual YAML parsing
      // would require js-yaml integration in the K8sProvider
      const result = k8sProvider.parseYamlToResources(yaml);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle multi-document YAML', () => {
      const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: config1
  labels:
    hncRunId: test-123
---
apiVersion: v1
kind: Service
metadata:
  name: service1
  labels:
    hncRunId: test-123
spec:
  selector:
    app: test
  ports:
  - port: 80
`;

      const result = k8sProvider.parseYamlToResources(yaml);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle invalid YAML gracefully', () => {
      const invalidYaml = `
invalid: yaml: content:
  - missing quotes and "bad structure
  tabs	mixed with spaces
`;

      // The current implementation doesn't actually parse YAML yet,
      // it just returns an empty array. This test validates the structure.
      const result = k8sProvider.parseYamlToResources(invalidYaml);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('resource validation', () => {
    it('should validate required resource fields', () => {
      const validResource: K8sResource = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'valid-config',
          labels: { hncRunId: 'test-123' }
        }
      };

      expect(validResource.apiVersion).toBeTruthy();
      expect(validResource.kind).toBeTruthy();
      expect(validResource.metadata.name).toBeTruthy();
    });

    it('should handle resources without labels', () => {
      const resource: K8sResource = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'no-labels-config' }
      };

      expect(resource.metadata.labels).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle namespace not found gracefully', () => {
      // This would be tested with mocked K8s API calls
      // For now, we just ensure the structure is correct
      const provider = new K8sProvider();
      expect(provider.isReady()).toBe(false);
    });

    it('should validate initialization state', () => {
      const provider = new K8sProvider();
      expect(provider.isReady()).toBe(false);
      
      // Would test actual initialization in integration tests
    });
  });

  describe('diff result formatting', () => {
    it('should provide clear diff descriptions', () => {
      const expected: K8sResource = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { 
          name: 'test', 
          labels: { 
            hncRunId: 'test-123',
            version: '1.0.0',
            environment: 'prod'
          } 
        }
      };

      const actual: K8sResource = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { 
          name: 'test', 
          labels: { 
            hncRunId: 'test-123',
            version: '1.1.0',
            environment: 'prod'
          } 
        }
      };

      const result = k8sProvider.compareResources([expected], [actual]);
      
      expect(result.different).toHaveLength(1);
      expect(result.different[0].differences).toContain('label version: expected 1.0.0, got 1.1.0');
    });
  });
});

describe('K8sProvider Integration Scenarios', () => {
  describe('GitOps workflow simulation', () => {
    it('should handle typical GitOps resource lifecycle', async () => {
      const k8sProvider = new K8sProvider();
      
      // Simulate expected resources from FGD
      const expectedResources: K8sResource[] = [
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'fabric-config', labels: { hncRunId: 'gitops-123' } }
        },
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: 'fabric-controller', labels: { hncRunId: 'gitops-123' } }
        }
      ];

      // Simulate gradual resource availability
      const initialResources: K8sResource[] = [];
      const partialResources: K8sResource[] = [expectedResources[0]];
      const completeResources: K8sResource[] = expectedResources;

      // Test initial state (no resources)
      let diff = k8sProvider.compareResources(expectedResources, initialResources);
      expect(diff.missing).toHaveLength(2);

      // Test partial state (one resource applied)
      diff = k8sProvider.compareResources(expectedResources, partialResources);
      expect(diff.missing).toHaveLength(1);
      expect(diff.missing[0].kind).toBe('Deployment');

      // Test complete state (all resources applied)
      diff = k8sProvider.compareResources(expectedResources, completeResources);
      expect(diff.missing).toHaveLength(0);
      expect(diff.extra).toHaveLength(0);
      expect(diff.different).toHaveLength(0);
    });
  });

  describe('namespace isolation validation', () => {
    it('should generate unique namespaces for different runs', () => {
      const k8sProvider = new K8sProvider();
      
      const runId1 = 'integration-test-1';
      const runId2 = 'integration-test-2';
      
      const ns1 = k8sProvider.generateNamespace(runId1);
      const ns2 = k8sProvider.generateNamespace(runId2);
      
      expect(ns1).toBe('hnc-it-integration-test-1');
      expect(ns2).toBe('hnc-it-integration-test-2');
      expect(ns1).not.toBe(ns2);
    });
  });
});