/**
 * Profile Loader Tests - HNC v0.3
 * Comprehensive unit tests for switch profile ingestion
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadSwitchProfiles, getSwitchProfile, listSwitchProfileIds } from '../../src/ingest/profileLoader.js';
import type { SwitchProfile } from '../../src/ingest/types.js';

// Mock filesystem operations for testing
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock Go profile generator
vi.mock('../../src/ingest/goProfile.js', () => ({
  runGoProfileGenerator: vi.fn(),
}));

describe('ProfileLoader', () => {
  let mockReadFile: any;
  let mockRunGoProfileGenerator: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get mocked functions
    const fs = await import('fs/promises');
    mockReadFile = fs.readFile as any;
    
    const goProfile = await import('../../src/ingest/goProfile.js');
    mockRunGoProfileGenerator = goProfile.runGoProfileGenerator;
  });

  afterEach(() => {
    delete process.env.PROFILE_INGEST_MODE;
  });

  describe('Fixture Mode (Default)', () => {
    const validDS2000Profile: SwitchProfile = {
      modelId: "celestica-ds2000",
      roles: ["leaf"],
      ports: {
        endpointAssignable: ["E1/1-48"],
        fabricAssignable: ["E1/49-56"]
      },
      profiles: {
        endpoint: { portProfile: "SFP28-25G", speedGbps: 25 },
        uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
      },
      meta: { source: "switch_profile.go", version: "v0.3.0" }
    };

    const validDS3000Profile: SwitchProfile = {
      modelId: "celestica-ds3000",
      roles: ["spine"],
      ports: {
        endpointAssignable: [],
        fabricAssignable: ["E1/1-32"]
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 0 },
        uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
      },
      meta: { source: "switch_profile.go", version: "v0.3.0" }
    };

    beforeEach(() => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(validDS2000Profile));
        }
        if (path.includes('ds3000.json')) {
          return Promise.resolve(JSON.stringify(validDS3000Profile));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should load DS2000 and DS3000 profiles successfully', async () => {
      const result = await loadSwitchProfiles();

      expect(result.mode).toBe('fixture');
      expect(result.profiles.size).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.profiles.get('celestica-ds2000')).toEqual(validDS2000Profile);
      expect(result.profiles.get('celestica-ds3000')).toEqual(validDS3000Profile);
      expect(result.loadedAt).toBeInstanceOf(Date);
    });

    it('should respect custom fixtures path', async () => {
      const customPath = 'custom/fixtures/path';
      await loadSwitchProfiles({ fixturesPath: customPath });

      expect(mockReadFile).toHaveBeenCalledWith(`${customPath}/ds2000.json`, 'utf-8');
      expect(mockReadFile).toHaveBeenCalledWith(`${customPath}/ds3000.json`, 'utf-8');
    });

    it('should handle partial load failures gracefully', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(validDS2000Profile));
        }
        if (path.includes('ds3000.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await loadSwitchProfiles();

      expect(result.profiles.size).toBe(1);
      expect(result.profiles.has('celestica-ds2000')).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to load fixture ds3000');
    });

    it('should validate profile structure', async () => {
      const invalidProfile = { modelId: "invalid", roles: [] }; // Missing required fields
      
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(invalidProfile));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await loadSwitchProfiles();

      expect(result.profiles.size).toBe(0);
      expect(result.errors).toHaveLength(2); // ds2000 validation error + ds3000 file not found
      expect(result.errors[0]).toContain('Invalid profile for celestica-ds2000');
    });

    it('should validate modelId matches filename', async () => {
      const profileWithWrongId = { ...validDS2000Profile, modelId: "wrong-id" };
      
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(profileWithWrongId));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await loadSwitchProfiles();

      expect(result.profiles.size).toBe(0);
      expect(result.errors[0]).toContain('Profile modelId mismatch');
    });

    it('should handle malformed JSON', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve('invalid json {');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await loadSwitchProfiles();

      expect(result.profiles.size).toBe(0);
      expect(result.errors[0]).toContain('Failed to load fixture ds2000');
    });
  });

  describe('Go Generation Mode', () => {
    const validDS2000Profile: SwitchProfile = {
      modelId: "celestica-ds2000",
      roles: ["leaf"],
      ports: {
        endpointAssignable: ["E1/1-48"],
        fabricAssignable: ["E1/49-56"]
      },
      profiles: {
        endpoint: { portProfile: "SFP28-25G", speedGbps: 25 },
        uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
      },
      meta: { source: "switch_profile.go", version: "v0.3.0" }
    };

    beforeEach(() => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json') || path.includes('ds3000.json')) {
          return Promise.resolve(JSON.stringify(validDS2000Profile));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should use Go generation when mode is "go"', async () => {
      mockRunGoProfileGenerator.mockResolvedValue(undefined);

      const result = await loadSwitchProfiles({ mode: 'go' });

      expect(mockRunGoProfileGenerator).toHaveBeenCalledWith(undefined);
      expect(result.mode).toBe('go');
    });

    it('should respect PROFILE_INGEST_MODE environment variable', async () => {
      process.env.PROFILE_INGEST_MODE = 'go';
      mockRunGoProfileGenerator.mockResolvedValue(undefined);

      const result = await loadSwitchProfiles();

      expect(mockRunGoProfileGenerator).toHaveBeenCalled();
      expect(result.mode).toBe('go');
    });

    it('should fall back to fixture mode when Go generation fails', async () => {
      mockRunGoProfileGenerator.mockRejectedValue(new Error('Go toolchain not available'));

      const result = await loadSwitchProfiles({ mode: 'go' });

      expect(result.mode).toBe('fixture'); // Fell back to fixture mode
      expect(result.errors[0]).toContain('Go generation failed');
    });

    it('should pass custom tool path to Go generator', async () => {
      mockRunGoProfileGenerator.mockResolvedValue(undefined);
      const customToolPath = 'custom/tool/path';

      await loadSwitchProfiles({ mode: 'go', goToolPath: customToolPath });

      expect(mockRunGoProfileGenerator).toHaveBeenCalledWith(customToolPath);
    });
  });

  describe('Helper Functions', () => {
    const validDS2000Profile: SwitchProfile = {
      modelId: "celestica-ds2000",
      roles: ["leaf"],
      ports: {
        endpointAssignable: ["E1/1-48"],
        fabricAssignable: ["E1/49-56"]
      },
      profiles: {
        endpoint: { portProfile: "SFP28-25G", speedGbps: 25 },
        uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
      },
      meta: { source: "switch_profile.go", version: "v0.3.0" }
    };

    beforeEach(() => {
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(validDS2000Profile));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    describe('getSwitchProfile', () => {
      it('should return specific profile by modelId', async () => {
        const profile = await getSwitchProfile('celestica-ds2000');

        expect(profile).toEqual(validDS2000Profile);
      });

      it('should return null for non-existent profile', async () => {
        const profile = await getSwitchProfile('non-existent');

        expect(profile).toBeNull();
      });
    });

    describe('listSwitchProfileIds', () => {
      it('should return array of available profile IDs', async () => {
        const ids = await listSwitchProfileIds();

        expect(ids).toEqual(['celestica-ds2000']);
      });

      it('should return empty array when no profiles load', async () => {
        mockReadFile.mockRejectedValue(new Error('No files found'));

        const ids = await listSwitchProfileIds();

        expect(ids).toEqual([]);
      });
    });
  });

  describe('Profile Validation', () => {
    it('should reject profile without required fields', async () => {
      const incompleteProfile = {
        modelId: "celestica-ds2000",
        // Missing roles, ports, profiles, meta
      };

      mockReadFile.mockImplementation(() => 
        Promise.resolve(JSON.stringify(incompleteProfile))
      );

      const result = await loadSwitchProfiles();

      expect(result.profiles.size).toBe(0);
      expect(result.errors[0]).toContain('missing field');
    });

    it('should reject profile with invalid roles', async () => {
      const invalidRoles = {
        modelId: "celestica-ds2000",
        roles: "", // Should be array
        ports: { endpointAssignable: [], fabricAssignable: [] },
        profiles: {
          endpoint: { portProfile: "SFP28-25G", speedGbps: 25 },
          uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
        },
        meta: { source: "test", version: "v1.0.0" }
      };

      mockReadFile.mockImplementation(() => 
        Promise.resolve(JSON.stringify(invalidRoles))
      );

      const result = await loadSwitchProfiles();

      expect(result.errors[0]).toContain('roles must be non-empty array');
    });

    it('should reject profile with invalid port structure', async () => {
      const invalidPorts = {
        modelId: "celestica-ds2000",
        roles: ["leaf"],
        ports: "invalid", // Should be object
        profiles: {
          endpoint: { portProfile: "SFP28-25G", speedGbps: 25 },
          uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
        },
        meta: { source: "test", version: "v1.0.0" }
      };

      mockReadFile.mockImplementation(() => 
        Promise.resolve(JSON.stringify(invalidPorts))
      );

      const result = await loadSwitchProfiles();

      expect(result.errors[0]).toContain('ports must be object');
    });

    it('should validate profile structure fields', async () => {
      const invalidProfiles = {
        modelId: "celestica-ds2000",
        roles: ["leaf"],
        ports: { endpointAssignable: [], fabricAssignable: [] },
        profiles: {
          endpoint: { portProfile: "SFP28-25G", speedGbps: "25" }, // speedGbps should be number
          uplink: { portProfile: "QSFP28-100G", speedGbps: 100 }
        },
        meta: { source: "test", version: "v1.0.0" }
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('ds2000.json')) {
          return Promise.resolve(JSON.stringify(invalidProfiles));
        }
        if (path.includes('ds3000.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await loadSwitchProfiles();

      expect(result.errors.some(error => error.includes('speedGbps must be a number'))).toBe(true);
    });
  });
});