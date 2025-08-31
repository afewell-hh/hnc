#!/usr/bin/env node

/**
 * Profile Verification Tool - HNC v0.3
 * Validates switch profiles against schema and checks key ordering
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

// Expected schema structure with key ordering
const EXPECTED_SCHEMA = {
  modelId: 'string',
  roles: 'array',
  ports: {
    endpointAssignable: 'array',
    fabricAssignable: 'array'
  },
  profiles: {
    endpoint: {
      portProfile: 'string_or_null',
      speedGbps: 'number'
    },
    uplink: {
      portProfile: 'string_or_null', 
      speedGbps: 'number'
    }
  },
  meta: {
    source: 'string',
    version: 'string'
  }
};

// Expected key order for deterministic output
const EXPECTED_KEY_ORDER = ['modelId', 'roles', 'ports', 'profiles', 'meta'];
const EXPECTED_PORTS_ORDER = ['endpointAssignable', 'fabricAssignable'];
const EXPECTED_PROFILES_ORDER = ['endpoint', 'uplink'];
const EXPECTED_PROFILE_ORDER = ['portProfile', 'speedGbps'];
const EXPECTED_META_ORDER = ['source', 'version'];

/**
 * Validates the structure of a switch profile
 */
function validateProfileStructure(profile, filename) {
  const errors = [];

  // Check top-level keys
  if (!profile.modelId || typeof profile.modelId !== 'string') {
    errors.push(`${filename}: modelId must be a non-empty string`);
  }

  if (!Array.isArray(profile.roles) || profile.roles.length === 0) {
    errors.push(`${filename}: roles must be a non-empty array`);
  }

  // Validate ports
  if (!profile.ports || typeof profile.ports !== 'object') {
    errors.push(`${filename}: ports must be an object`);
  } else {
    if (!Array.isArray(profile.ports.endpointAssignable)) {
      errors.push(`${filename}: ports.endpointAssignable must be an array`);
    }
    if (!Array.isArray(profile.ports.fabricAssignable)) {
      errors.push(`${filename}: ports.fabricAssignable must be an array`);
    }
  }

  // Validate profiles
  if (!profile.profiles || typeof profile.profiles !== 'object') {
    errors.push(`${filename}: profiles must be an object`);
  } else {
    ['endpoint', 'uplink'].forEach(profileType => {
      const p = profile.profiles[profileType];
      if (!p || typeof p !== 'object') {
        errors.push(`${filename}: profiles.${profileType} must be an object`);
      } else {
        if (p.portProfile !== null && typeof p.portProfile !== 'string') {
          errors.push(`${filename}: profiles.${profileType}.portProfile must be string or null`);
        }
        if (typeof p.speedGbps !== 'number') {
          errors.push(`${filename}: profiles.${profileType}.speedGbps must be a number`);
        }
      }
    });
  }

  // Validate meta
  if (!profile.meta || typeof profile.meta !== 'object') {
    errors.push(`${filename}: meta must be an object`);
  } else {
    if (!profile.meta.source || typeof profile.meta.source !== 'string') {
      errors.push(`${filename}: meta.source must be a non-empty string`);
    }
    if (!profile.meta.version || typeof profile.meta.version !== 'string') {
      errors.push(`${filename}: meta.version must be a non-empty string`);
    }
  }

  return errors;
}

/**
 * Validates key ordering for deterministic output
 */
function validateKeyOrdering(profile, filename) {
  const errors = [];

  // Check top-level key order
  const topKeys = Object.keys(profile);
  const expectedKeys = EXPECTED_KEY_ORDER.filter(key => key in profile);
  if (JSON.stringify(topKeys) !== JSON.stringify(expectedKeys)) {
    errors.push(`${filename}: top-level keys not in expected order. Expected: ${expectedKeys.join(', ')}, Got: ${topKeys.join(', ')}`);
  }

  // Check ports key order
  if (profile.ports) {
    const portsKeys = Object.keys(profile.ports);
    const expectedPortsKeys = EXPECTED_PORTS_ORDER.filter(key => key in profile.ports);
    if (JSON.stringify(portsKeys) !== JSON.stringify(expectedPortsKeys)) {
      errors.push(`${filename}: ports keys not in expected order. Expected: ${expectedPortsKeys.join(', ')}, Got: ${portsKeys.join(', ')}`);
    }
  }

  // Check profiles key order
  if (profile.profiles) {
    const profilesKeys = Object.keys(profile.profiles);
    const expectedProfilesKeys = EXPECTED_PROFILES_ORDER.filter(key => key in profile.profiles);
    if (JSON.stringify(profilesKeys) !== JSON.stringify(expectedProfilesKeys)) {
      errors.push(`${filename}: profiles keys not in expected order. Expected: ${expectedProfilesKeys.join(', ')}, Got: ${profilesKeys.join(', ')}`);
    }

    // Check individual profile key order
    ['endpoint', 'uplink'].forEach(profileType => {
      if (profile.profiles[profileType]) {
        const profileKeys = Object.keys(profile.profiles[profileType]);
        const expectedProfileKeys = EXPECTED_PROFILE_ORDER.filter(key => key in profile.profiles[profileType]);
        if (JSON.stringify(profileKeys) !== JSON.stringify(expectedProfileKeys)) {
          errors.push(`${filename}: profiles.${profileType} keys not in expected order. Expected: ${expectedProfileKeys.join(', ')}, Got: ${profileKeys.join(', ')}`);
        }
      }
    });
  }

  // Check meta key order
  if (profile.meta) {
    const metaKeys = Object.keys(profile.meta);
    const expectedMetaKeys = EXPECTED_META_ORDER.filter(key => key in profile.meta);
    if (JSON.stringify(metaKeys) !== JSON.stringify(expectedMetaKeys)) {
      errors.push(`${filename}: meta keys not in expected order. Expected: ${expectedMetaKeys.join(', ')}, Got: ${metaKeys.join(', ')}`);
    }
  }

  return errors;
}

/**
 * Validates a single profile file
 */
async function validateProfileFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const profile = JSON.parse(content);
    const filename = filePath.split('/').pop();

    const structureErrors = validateProfileStructure(profile, filename);
    const orderingErrors = validateKeyOrdering(profile, filename);

    return [...structureErrors, ...orderingErrors];
  } catch (error) {
    return [`Failed to parse ${filePath}: ${error.message}`];
  }
}

/**
 * Main verification function
 */
async function verifyProfiles() {
  const fixturesDir = 'src/fixtures/switch-profiles';
  let allErrors = [];

  try {
    const files = await readdir(fixturesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`🔍 Verifying ${jsonFiles.length} profile files in ${fixturesDir}/`);

    for (const file of jsonFiles) {
      const filePath = join(fixturesDir, file);
      const errors = await validateProfileFile(filePath);
      
      if (errors.length === 0) {
        console.log(`✅ ${file}: Valid`);
      } else {
        console.log(`❌ ${file}: ${errors.length} error(s)`);
        errors.forEach(error => console.log(`   ${error}`));
        allErrors.push(...errors);
      }
    }

    if (allErrors.length === 0) {
      console.log('\n🎉 All profile files are valid!');
      process.exit(0);
    } else {
      console.log(`\n💥 Validation failed with ${allErrors.length} error(s)`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ Failed to verify profiles: ${error.message}`);
    process.exit(1);
  }
}

// Run verification
verifyProfiles();