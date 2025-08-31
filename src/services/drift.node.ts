import { mockFabricServicesApi } from '../drift/mock-fks-api.js';
import { detectFksDrift } from '../drift/detector.js';
import type { DriftResult } from '../drift/types.js';

export type { DriftResult } from '../drift/types.js';

export async function checkDrift(): Promise<DriftResult> {
  // Node environment: can support both legacy and FKS drift detection
  
  // For now, simulate FKS drift detection with mock data
  // In a real implementation, this would make actual HTTP requests to K8s Fabric Services API
  try {
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus('no-drift');
    const fksDriftResult = await detectFksDrift('node-test-fabric', k8sApiResponse);
    
    // Convert FKS result to compatible DriftResult format
    return {
      enabled: fksDriftResult.enabled,
      items: fksDriftResult.items,
      hasDrift: fksDriftResult.hasDrift,
      lastChecked: fksDriftResult.lastChecked,
      k8sApiStatus: fksDriftResult.k8sApiStatus,
      comparisonTimeMs: fksDriftResult.comparisonTimeMs
    };
  } catch (error) {
    console.warn('FKS drift detection failed, falling back to legacy mode:', error);
    // Legacy behavior - basic file-based drift detection would go here
    return { enabled: true, items: [] };
  }
}