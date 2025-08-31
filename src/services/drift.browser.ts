import { mockFabricServicesApi } from '../drift/mock-fks-api.js';
import { detectFksDrift } from '../drift/detector.js';
import type { DriftResult } from '../drift/types.js';

export type { DriftResult } from '../drift/types.js';

let currentScenario: 'no-drift' | 'missing-switches' | 'port-mismatches' | 'config-differences' = 'no-drift';

// Function to set drift scenario for testing/demo purposes
export function setDriftScenario(scenario: 'no-drift' | 'missing-switches' | 'port-mismatches' | 'config-differences') {
  currentScenario = scenario;
}

export async function checkDrift(): Promise<DriftResult> {
  // Check if we're in an environment that supports FKS drift detection
  const supportsFks = typeof window !== 'undefined' && 
                      (window.location.hostname === 'localhost' || 
                       process.env.NODE_ENV === 'development' || 
                       process.env.STORYBOOK === 'true');
  
  if (!supportsFks) {
    // Legacy behavior for production/non-dev environments
    return { enabled: false, items: [] };
  }

  try {
    // Simulate FKS drift detection in browser environment
    const k8sApiResponse = await mockFabricServicesApi.fetchFabricStatus(currentScenario);
    const fksDriftResult = await detectFksDrift('browser-test-fabric', k8sApiResponse);
    
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
    console.warn('FKS drift detection failed:', error);
    return { enabled: false, items: [] };
  }
}