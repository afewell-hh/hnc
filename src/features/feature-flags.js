// JavaScript version of feature-flags.ts for compatibility

/**
 * Get feature flag value from environment variables
 * @param {string} flag Feature flag name
 * @param {boolean} defaultValue Default value if not set
 * @returns {boolean} Feature flag value
 */
function getFeatureFlag(flag, defaultValue = false) {
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[flag]
    if (value === 'true') return true
    if (value === 'false') return false
  }
  
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search)
    const value = params.get(flag.toLowerCase())
    if (value === 'true') return true
    if (value === 'false') return false
  }
  
  return defaultValue
}

/**
 * Check if Git features are enabled
 * @returns {boolean} True if Git features are enabled
 */
function isGitEnabled() {
  return getFeatureFlag('FEATURE_GIT', false)
}

/**
 * Override a feature flag programmatically (for testing)
 * @param {string} flag Feature flag name
 * @param {boolean} value Value to set
 */
let flagOverrides = {}

function setFeatureFlagOverride(flag, value) {
  flagOverrides[flag] = value
}

function clearFeatureFlagOverrides() {
  flagOverrides = {}
}

// Check overrides first
function getFeatureFlagWithOverride(flag, defaultValue) {
  if (flagOverrides[flag] !== undefined) {
    return flagOverrides[flag]
  }
  return getFeatureFlag(flag, defaultValue)
}

// Export functions with proper named exports for ES modules
export {
  getFeatureFlag,
  setFeatureFlagOverride,
  clearFeatureFlagOverrides
}

export function isGitEnabled() {
  return getFeatureFlagWithOverride('FEATURE_GIT', false)
}

// For testing - allow programmatic override
export function overrideFeatureFlag(flag, value) {
  setFeatureFlagOverride(`FEATURE_${flag.toUpperCase()}`, value)
}

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFeatureFlag,
    isGitEnabled,
    setFeatureFlagOverride,
    clearFeatureFlagOverrides,
    overrideFeatureFlag
  }
}