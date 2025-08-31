/**
 * Feature flag management system for HNC
 * Supports environment variables and runtime detection
 */

export interface FeatureFlags {
  git: boolean;
  k8s: boolean;
  // Future features can be added here
  // analytics?: boolean;
  // cloudSync?: boolean;
}

/**
 * Gets feature flag value with fallback to default
 * Supports both Node.js and browser environments
 */
function getFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  // Check environment variables (Node.js)
  if (typeof process !== 'undefined' && process.env) {
    const envValue = process.env[`FEATURE_${key.toUpperCase()}`]
    if (envValue !== undefined) {
      return envValue.toLowerCase() === 'true'
    }
  }

  // Check query parameters or localStorage in browser
  if (typeof window !== 'undefined') {
    // Check URL query parameters (?FEATURE_GIT=true)
    try {
      const params = new URLSearchParams(window.location.search)
      const paramValue = params.get(`FEATURE_${key.toUpperCase()}`)
      if (paramValue !== null) {
        return paramValue.toLowerCase() === 'true'
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    // Check localStorage for development/testing
    try {
      const storageValue = window.localStorage.getItem(`FEATURE_${key.toUpperCase()}`)
      if (storageValue !== null) {
        return storageValue.toLowerCase() === 'true'
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  return defaultValue
}

/**
 * Central feature flags configuration
 * Default: All features disabled for safety
 */
export const featureFlags: FeatureFlags = {
  git: getFeatureFlag('git', false), // Default: Git integration disabled
  k8s: getFeatureFlag('k8s', false) // Default: K8s integration disabled
}

/**
 * Helper functions for specific features
 */
export const isGitEnabled = (): boolean => featureFlags.git
export const isK8sEnabled = (): boolean => featureFlags.k8s

/**
 * Development helper to override feature flags programmatically
 * Only works in development/test environments
 */
export function overrideFeatureFlag(key: keyof FeatureFlags, value: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`FEATURE_${key.toUpperCase()}`, value.toString())
      // Update the current flags object
      ;(featureFlags as any)[key] = value
    } catch (e) {
      console.warn('Failed to override feature flag:', e)
    }
  } else if (typeof process !== 'undefined' && process.env) {
    // In Node.js, only warn that it should be set via environment
    console.warn(`To enable ${key} feature, set FEATURE_${key.toUpperCase()}=true environment variable`)
  }
}

/**
 * Get all current feature flag values for debugging
 */
export function getFeatureFlagStatus(): Record<string, boolean> {
  return {
    git: featureFlags.git,
    k8s: featureFlags.k8s
  }
}

/**
 * Reset all feature flags to defaults (for testing)
 */
export function resetFeatureFlags(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('FEATURE_GIT')
      window.localStorage.removeItem('FEATURE_K8S')
      // Reload flags from environment/defaults
      ;(featureFlags as any).git = getFeatureFlag('git', false)
      ;(featureFlags as any).k8s = getFeatureFlag('k8s', false)
    } catch (e) {
      // Ignore localStorage errors
    }
  }
}
