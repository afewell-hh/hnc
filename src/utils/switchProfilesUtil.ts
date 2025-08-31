/**
 * Switch Profile Utilities for Wiring Generation
 * Provides hardcoded switch profiles for DS2000/DS3000 models
 */

import type { SwitchProfile } from '../app.types'

/**
 * Hardcoded switch profiles for the stub implementation
 */
const switchProfilesMap = new Map<string, SwitchProfile>([
  [
    'DS2000',
    {
      modelId: 'DS2000',
      roles: ['leaf'],
      ports: {
        endpointAssignable: ['Et1/1', 'Et1/2', 'Et1/3', 'Et1/4', 'Et1/5', 'Et1/6', 'Et1/7', 'Et1/8', 
                           'Et1/9', 'Et1/10', 'Et1/11', 'Et1/12', 'Et1/13', 'Et1/14', 'Et1/15', 'Et1/16',
                           'Et1/17', 'Et1/18', 'Et1/19', 'Et1/20', 'Et1/21', 'Et1/22', 'Et1/23', 'Et1/24',
                           'Et1/25', 'Et1/26', 'Et1/27', 'Et1/28', 'Et1/29', 'Et1/30', 'Et1/31', 'Et1/32',
                           'Et1/33', 'Et1/34', 'Et1/35', 'Et1/36', 'Et1/37', 'Et1/38', 'Et1/39', 'Et1/40',
                           'Et1/41', 'Et1/42', 'Et1/43', 'Et1/44', 'Et1/45', 'Et1/46', 'Et1/47', 'Et1/48'],
        fabricAssignable: ['Et1/1', 'Et1/2', 'Et1/3', 'Et1/4', 'Et1/5', 'Et1/6', 'Et1/7', 'Et1/8']
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 25 },
        uplink: { portProfile: null, speedGbps: 25 }
      },
      meta: { source: 'hardcoded', version: '1.0.0' }
    }
  ],
  [
    'DS3000',
    {
      modelId: 'DS3000',
      roles: ['spine'],
      ports: {
        endpointAssignable: [], // Spines don't connect to endpoints
        fabricAssignable: ['Et1/1', 'Et1/2', 'Et1/3', 'Et1/4', 'Et1/5', 'Et1/6', 'Et1/7', 'Et1/8',
                          'Et1/9', 'Et1/10', 'Et1/11', 'Et1/12', 'Et1/13', 'Et1/14', 'Et1/15', 'Et1/16',
                          'Et1/17', 'Et1/18', 'Et1/19', 'Et1/20', 'Et1/21', 'Et1/22', 'Et1/23', 'Et1/24',
                          'Et1/25', 'Et1/26', 'Et1/27', 'Et1/28', 'Et1/29', 'Et1/30', 'Et1/31', 'Et1/32']
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 100 },
        uplink: { portProfile: null, speedGbps: 100 }
      },
      meta: { source: 'hardcoded', version: '1.0.0' }
    }
  ]
])

/**
 * Get all available switch profiles as a Map
 * @returns Map of model ID to SwitchProfile
 */
export function getSwitchProfiles(): Map<string, SwitchProfile> {
  return switchProfilesMap
}

/**
 * Get a specific switch profile by model ID
 * @param modelId - Switch model ID (e.g., 'DS2000', 'DS3000')
 * @returns SwitchProfile or undefined if not found
 */
export function getSwitchProfile(modelId: string): SwitchProfile | undefined {
  return switchProfilesMap.get(modelId)
}

/**
 * Check if a switch model is supported
 * @param modelId - Switch model ID to check
 * @returns True if the model is supported
 */
export function isSupportedSwitchModel(modelId: string): boolean {
  return switchProfilesMap.has(modelId)
}

/**
 * Get all supported switch model IDs
 * @returns Array of supported model IDs
 */
export function getSupportedModelIds(): string[] {
  return Array.from(switchProfilesMap.keys())
}