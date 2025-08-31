/**
 * Kubernetes Provider - Read-only integration for validation
 * Provides safe, read-only access to Kubernetes resources
 * with namespace isolation and exponential backoff
 */

import * as k8s from '@kubernetes/client-node';
import { isK8sEnabled } from '../features/feature-flags.js';

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: any;
  status?: any;
}

export interface K8sDiffResult {
  missing: K8sResource[];
  extra: K8sResource[];
  different: Array<{
    expected: K8sResource;
    actual: K8sResource;
    differences: string[];
  }>;
}

export interface WaitOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Read-only Kubernetes provider for resource validation
 */
export class K8sProvider {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sCustomApi: k8s.CustomObjectsApi;
  private isInitialized = false;

  constructor() {
    this.kc = new k8s.KubeConfig();
  }

  /**
   * Initialize the Kubernetes client
   * Safe initialization that doesn't throw on missing config
   */
  async initialize(): Promise<boolean> {
    if (!isK8sEnabled()) {
      console.log('K8s integration disabled via feature flag');
      return false;
    }

    try {
      // Try to load default kubeconfig
      this.kc.loadFromDefault();
      
      this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.k8sCustomApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
      
      // Test connection with a lightweight call
      await this.k8sApi.listNamespace();
      
      this.isInitialized = true;
      console.log('K8s provider initialized successfully');
      return true;
    } catch (error) {
      console.warn('K8s provider initialization failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check if provider is ready for operations
   */
  isReady(): boolean {
    return this.isInitialized && isK8sEnabled();
  }

  /**
   * Generate namespace name with isolation pattern
   */
  generateNamespace(runId: string): string {
    return `hnc-it-${runId}`;
  }

  /**
   * Wait for resources to be created/updated with exponential backoff
   */
  async waitForResources(
    namespace: string,
    expectedResources: K8sResource[],
    hncRunId: string,
    options: WaitOptions = {}
  ): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('K8s provider not initialized or disabled');
    }

    const {
      maxRetries = 10,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2
    } = options;

    let currentDelay = initialDelayMs;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Waiting for resources (attempt ${attempt + 1}/${maxRetries})...`);
        
        const actualResources = await this.listResourcesInNamespace(namespace, hncRunId);
        const diff = this.compareResources(expectedResources, actualResources);
        
        // Check if all expected resources are present
        if (diff.missing.length === 0) {
          console.log('All expected resources found');
          return true;
        }
        
        console.log(`Still waiting for ${diff.missing.length} resources:`, 
          diff.missing.map(r => `${r.kind}/${r.metadata.name}`));
        
        // Wait before next attempt
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
        
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : String(error));
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
      }
    }
    
    console.warn(`Timeout waiting for resources after ${maxRetries} attempts`);
    return false;
  }

  /**
   * List all resources in a namespace with specific label filter
   */
  async listResourcesInNamespace(namespace: string, hncRunId: string): Promise<K8sResource[]> {
    if (!this.isReady()) {
      throw new Error('K8s provider not initialized or disabled');
    }

    const labelSelector = `hncRunId=${hncRunId}`;
    const resources: K8sResource[] = [];

    try {
      // List core resources (ConfigMaps, Services, etc.)
      const configMaps = await this.k8sApi.listNamespacedConfigMap({ namespace });
      const filteredConfigMaps = (configMaps.items || []).filter(item => 
        this.matchesLabelSelector(item, labelSelector)
      );
      resources.push(...filteredConfigMaps.map(this.toK8sResource));

      const services = await this.k8sApi.listNamespacedService({ namespace });
      const filteredServices = (services.items || []).filter(item => 
        this.matchesLabelSelector(item, labelSelector)
      );
      resources.push(...filteredServices.map(this.toK8sResource));

      // List apps resources (Deployments, etc.)
      const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
      const filteredDeployments = (deployments.items || []).filter(item => 
        this.matchesLabelSelector(item, labelSelector)
      );
      resources.push(...filteredDeployments.map(this.toK8sResource));

      console.log(`Found ${resources.length} resources in namespace ${namespace} with label ${labelSelector}`);
      return resources;
      
    } catch (error) {
      if (this.isNamespaceNotFoundError(error)) {
        console.log(`Namespace ${namespace} not found, returning empty resource list`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Compare expected resources against actual resources
   */
  compareResources(expected: K8sResource[], actual: K8sResource[]): K8sDiffResult {
    const missing: K8sResource[] = [];
    const extra: K8sResource[] = [];
    const different: Array<{ expected: K8sResource; actual: K8sResource; differences: string[] }> = [];

    // Find missing resources
    for (const expectedResource of expected) {
      const actualResource = actual.find(r => 
        r.kind === expectedResource.kind && 
        r.metadata.name === expectedResource.metadata.name
      );
      
      if (!actualResource) {
        missing.push(expectedResource);
      } else {
        // Compare resources for differences
        const differences = this.findResourceDifferences(expectedResource, actualResource);
        if (differences.length > 0) {
          different.push({ expected: expectedResource, actual: actualResource, differences });
        }
      }
    }

    // Find extra resources
    for (const actualResource of actual) {
      const expectedResource = expected.find(r => 
        r.kind === actualResource.kind && 
        r.metadata.name === actualResource.metadata.name
      );
      
      if (!expectedResource) {
        extra.push(actualResource);
      }
    }

    return { missing, extra, different };
  }

  /**
   * Parse YAML content and extract K8s resources
   */
  parseYamlToResources(yamlContent: string): K8sResource[] {
    // This would typically use js-yaml to parse YAML
    // For now, return a simple structure
    try {
      // Split by '---' to handle multi-document YAML
      const documents = yamlContent.split(/^---\s*$/m).filter(doc => doc.trim());
      const resources: K8sResource[] = [];
      
      // Simple YAML parsing would go here
      // This is a placeholder - actual implementation would use js-yaml
      console.log(`Parsed ${documents.length} YAML documents`);
      
      return resources;
    } catch (error) {
      console.error('Failed to parse YAML:', error);
      throw new Error(`YAML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert Kubernetes API object to our K8sResource format
   */
  private toK8sResource(obj: any): K8sResource {
    return {
      apiVersion: obj.apiVersion || 'v1',
      kind: obj.kind,
      metadata: {
        name: obj.metadata.name,
        namespace: obj.metadata.namespace,
        labels: obj.metadata.labels || {}
      },
      spec: obj.spec,
      status: obj.status
    };
  }

  /**
   * Find differences between two resources
   */
  private findResourceDifferences(expected: K8sResource, actual: K8sResource): string[] {
    const differences: string[] = [];
    
    // Compare API version
    if (expected.apiVersion !== actual.apiVersion) {
      differences.push(`apiVersion: expected ${expected.apiVersion}, got ${actual.apiVersion}`);
    }
    
    // Compare labels
    if (expected.metadata.labels) {
      for (const [key, value] of Object.entries(expected.metadata.labels)) {
        if (actual.metadata.labels?.[key] !== value) {
          differences.push(`label ${key}: expected ${value}, got ${actual.metadata.labels?.[key] || 'undefined'}`);
        }
      }
    }
    
    // Note: Spec comparison would be more complex in practice
    // This is a simplified version
    
    return differences;
  }

  /**
   * Check if item matches label selector
   */
  private matchesLabelSelector(item: any, labelSelector: string): boolean {
    if (!labelSelector) return true;
    
    const labels = item.metadata?.labels;
    if (!labels) return false;
    
    // Parse labelSelector (format: "key=value")
    const [key, value] = labelSelector.split('=');
    return labels[key] === value;
  }

  /**
   * Check if error is a namespace not found error
   */
  private isNamespaceNotFoundError(error: any): boolean {
    return error?.response?.statusCode === 404 ||
           error?.statusCode === 404 ||
           (typeof error === 'object' && error !== null && 'code' in error && error.code === 404);
  }
}

/**
 * Singleton instance for the application
 */
export const k8sProvider = new K8sProvider();

/**
 * Initialize K8s provider if enabled
 * Safe to call multiple times
 */
export async function initializeK8sProvider(): Promise<boolean> {
  return k8sProvider.initialize();
}