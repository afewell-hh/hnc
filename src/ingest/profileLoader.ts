/**
 * Switch Profile Loader - HNC v0.3
 * Loads switch profiles with fixture mode (default) and optional Go generation
 */

import { SwitchProfile, ProfileIngestMode, ProfileLoaderConfig, ProfileLoaderResult } from './types.js';

// Default fixture profiles - DS2000 and DS3000
const DEFAULT_FIXTURES = ['ds2000', 'ds3000'];

/**
 * Validates that a loaded object conforms to SwitchProfile schema
 */
function validateSwitchProfile(obj: any, modelId: string): obj is SwitchProfile {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`Invalid profile for ${modelId}: not an object`);
  }

  const required = ['modelId', 'roles', 'ports', 'profiles', 'meta'];
  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Invalid profile for ${modelId}: missing field '${field}'`);
    }
  }

  // Validate modelId matches
  if (obj.modelId !== modelId) {
    throw new Error(`Profile modelId mismatch: expected ${modelId}, got ${obj.modelId}`);
  }

  // Validate roles array
  if (!Array.isArray(obj.roles) || obj.roles.length === 0) {
    throw new Error(`Invalid profile for ${modelId}: roles must be non-empty array`);
  }

  // Validate ports structure
  const { ports } = obj;
  if (!ports || typeof ports !== 'object') {
    throw new Error(`Invalid profile for ${modelId}: ports must be object`);
  }
  if (!Array.isArray(ports.endpointAssignable) || !Array.isArray(ports.fabricAssignable)) {
    throw new Error(`Invalid profile for ${modelId}: port arrays must be arrays`);
  }

  // Validate profiles structure
  const { profiles } = obj;
  if (!profiles || typeof profiles !== 'object') {
    throw new Error(`Invalid profile for ${modelId}: profiles must be object`);
  }
  if (!profiles.endpoint || !profiles.uplink) {
    throw new Error(`Invalid profile for ${modelId}: missing endpoint or uplink profiles`);
  }
  
  // Validate breakout capability if present
  if (profiles.breakout) {
    const breakout = profiles.breakout;
    if (typeof breakout.supportsBreakout !== 'boolean') {
      throw new Error(`Invalid profile for ${modelId}: breakout.supportsBreakout must be boolean`);
    }
    if (breakout.supportsBreakout) {
      if (breakout.breakoutType && typeof breakout.breakoutType !== 'string') {
        throw new Error(`Invalid profile for ${modelId}: breakout.breakoutType must be string`);
      }
      if (breakout.capacityMultiplier && typeof breakout.capacityMultiplier !== 'number') {
        throw new Error(`Invalid profile for ${modelId}: breakout.capacityMultiplier must be number`);
      }
    }
  }

  // Validate individual profile properties
  ['endpoint', 'uplink'].forEach(profileType => {
    const profile = profiles[profileType];
    if (!profile || typeof profile !== 'object') {
      throw new Error(`Invalid profile for ${modelId}: profiles.${profileType} must be object`);
    }
    if (profile.portProfile !== null && typeof profile.portProfile !== 'string') {
      throw new Error(`Invalid profile for ${modelId}: profiles.${profileType}.portProfile must be string or null`);
    }
    if (typeof profile.speedGbps !== 'number') {
      throw new Error(`Invalid profile for ${modelId}: profiles.${profileType}.speedGbps must be a number`);
    }
  });

  // Validate meta structure
  const { meta } = obj;
  if (!meta || typeof meta !== 'object' || !meta.source || !meta.version) {
    throw new Error(`Invalid profile for ${modelId}: invalid meta object`);
  }

  return true;
}

/**
 * Loads a single fixture profile from JSON file
 */
async function loadFixtureProfile(modelId: string, fixturesPath: string): Promise<SwitchProfile> {
  const fixturePath = `${fixturesPath}/${modelId}.json`;
  
  try {
    // Use dynamic import for Node.js file system operations
    const fs = await import('fs/promises');
    const content = await fs.readFile(fixturePath, 'utf-8');
    const profile = JSON.parse(content);
    
    if (validateSwitchProfile(profile, `celestica-${modelId}`)) {
      return profile as SwitchProfile;
    }
    
    throw new Error('Profile validation failed');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load fixture ${modelId}: ${error.message}`);
    }
    throw new Error(`Failed to load fixture ${modelId}: unknown error`);
  }
}

/**
 * Loads all profiles in fixture mode
 */
async function loadFixtureProfiles(fixturesPath: string): Promise<{ profiles: Map<string, SwitchProfile>; errors: string[] }> {
  const profiles = new Map<string, SwitchProfile>();
  const errors: string[] = [];

  for (const modelId of DEFAULT_FIXTURES) {
    try {
      const profile = await loadFixtureProfile(modelId, fixturesPath);
      profiles.set(profile.modelId, profile);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
    }
  }

  return { profiles, errors };
}

/**
 * Attempts to regenerate fixtures using Go tool, then falls back to fixture mode
 */
async function loadWithGoGeneration(config: ProfileLoaderConfig): Promise<ProfileLoaderResult> {
  const errors: string[] = [];
  
  try {
    // Try to run Go generator
    const { runGoProfileGenerator } = await import('./goProfile.js');
    await runGoProfileGenerator(config.goToolPath);
    
    // After generation, load the fixtures
    const fixturesPath = config.fixturesPath || 'src/fixtures/switch-profiles';
    const { profiles, errors: fixtureErrors } = await loadFixtureProfiles(fixturesPath);
    errors.push(...fixtureErrors);
    
    return {
      profiles,
      mode: 'go',
      loadedAt: new Date(),
      errors
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown Go generation error';
    errors.push(`Go generation failed: ${errorMsg}`);
    
    // Fall back to fixture mode
    const fixturesPath = config.fixturesPath || 'src/fixtures/switch-profiles';
    const { profiles, errors: fixtureErrors } = await loadFixtureProfiles(fixturesPath);
    errors.push(...fixtureErrors);
    
    return {
      profiles,
      mode: 'fixture', // Note: fell back to fixture mode
      loadedAt: new Date(),
      errors
    };
  }
}

/**
 * Main profile loader function
 * Supports both fixture mode (default) and optional Go generation
 */
export async function loadSwitchProfiles(config: ProfileLoaderConfig = {}): Promise<ProfileLoaderResult> {
  const mode = config.mode || (process.env.PROFILE_INGEST_MODE as ProfileIngestMode) || 'fixture';
  const fixturesPath = config.fixturesPath || 'src/fixtures/switch-profiles';

  if (mode === 'go') {
    return loadWithGoGeneration(config);
  }

  // Default fixture mode
  const { profiles, errors } = await loadFixtureProfiles(fixturesPath);
  
  return {
    profiles,
    mode: 'fixture',
    loadedAt: new Date(),
    errors
  };
}

/**
 * Gets a specific switch profile by model ID
 */
export async function getSwitchProfile(modelId: string, config: ProfileLoaderConfig = {}): Promise<SwitchProfile | null> {
  const result = await loadSwitchProfiles(config);
  return result.profiles.get(modelId) || null;
}

/**
 * Lists all available switch profile model IDs
 */
export async function listSwitchProfileIds(config: ProfileLoaderConfig = {}): Promise<string[]> {
  const result = await loadSwitchProfiles(config);
  return Array.from(result.profiles.keys());
}