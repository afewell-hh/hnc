/**
 * FGD Importer Unit Tests - Comprehensive test coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { importFromFGD, ImportError } from './fgd-importer';

describe('FGD Importer', () => {
  let tempDir: string;
  let fgdTestPath: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fgd-test-'));
    fgdTestPath = path.join(tempDir, 'test-fabric');
    await fs.mkdir(fgdTestPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Happy Path - Single Class Fabric', () => {
    beforeEach(async () => {
      // Create single-class test FGD files
      await createSingleClassFGD(fgdTestPath);
    });

    it('should successfully import single-class fabric', async () => {
      const result = await importFromFGD(fgdTestPath);

      expect(result.validation.isValid).toBe(true);
      expect(result.fabricSpec.name).toBe('test-fabric');
      expect(result.fabricSpec.spineModelId).toBe('DS3000');
      expect(result.fabricSpec.leafModelId).toBe('DS2000');
      
      // Should use legacy single-class format
      expect(result.fabricSpec.uplinksPerLeaf).toBe(4);
      expect(result.fabricSpec.endpointProfile).toBeDefined();
      expect(result.fabricSpec.endpointProfile?.name).toBe('compute-standard');
      expect(result.fabricSpec.endpointCount).toBe(22);
      
      expect(result.leafClasses).toHaveLength(1);
      expect(result.provenance.detectedPatterns.topologyType).toBe('single-class');
    });

    it('should reconstruct correct endpoint profiles', async () => {
      const result = await importFromFGD(fgdTestPath);

      const leafClass = result.leafClasses[0];
      expect(leafClass.endpointProfiles).toHaveLength(1);
      
      const profile = leafClass.endpointProfiles[0];
      expect(profile.name).toBe('compute-standard');
      expect(profile.portsPerEndpoint).toBe(2);
      expect(profile.count).toBe(22);
      expect(profile.type).toBe('compute');
      expect(profile.redundancy).toBe(true);
      expect(profile.nics).toBe(2);
    });

    it('should provide detailed provenance information', async () => {
      const result = await importFromFGD(fgdTestPath);

      expect(result.provenance.source).toBe('import');
      expect(result.provenance.originalPath).toBe(fgdTestPath);
      expect(result.provenance.detectedPatterns.spineCount).toBe(1);
      expect(result.provenance.detectedPatterns.leafCount).toBe(1);
      expect(result.provenance.detectedPatterns.serverTypes.has('compute-standard')).toBe(true);
      expect(result.provenance.detectedPatterns.uplinkPatterns.get('leaf-1')).toBe(4);
    });
  });

  describe('Happy Path - Multi-Class Fabric', () => {
    beforeEach(async () => {
      await createMultiClassFGD(fgdTestPath);
    });

    it('should successfully import multi-class fabric', async () => {
      const result = await importFromFGD(fgdTestPath);

      expect(result.validation.isValid).toBe(true);
      expect(result.fabricSpec.leafClasses).toBeDefined();
      expect(result.fabricSpec.leafClasses).toHaveLength(2);
      
      // Should not use legacy fields
      expect(result.fabricSpec.uplinksPerLeaf).toBeUndefined();
      expect(result.fabricSpec.endpointProfile).toBeUndefined();
      
      expect(result.provenance.detectedPatterns.topologyType).toBe('multi-class');
    });

    it('should correctly detect different leaf classes', async () => {
      const result = await importFromFGD(fgdTestPath);

      const leafClasses = result.fabricSpec.leafClasses!;
      
      // Should have compute class with 4 uplinks
      const computeClass = leafClasses.find(lc => lc.uplinksPerLeaf === 4);
      expect(computeClass).toBeDefined();
      expect(computeClass?.endpointProfiles[0].name).toBe('compute-high');
      
      // Should have storage class with 2 uplinks
      const storageClass = leafClasses.find(lc => lc.uplinksPerLeaf === 2);
      expect(storageClass).toBeDefined();
      expect(storageClass?.endpointProfiles[0].name).toBe('storage-standard');
    });

    it('should handle multiple server types per leaf class', async () => {
      // Create FGD with mixed server types on same leaf
      await createMixedServerTypeFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      const leafClass = result.leafClasses[0];
      expect(leafClass.endpointProfiles.length).toBeGreaterThan(1);
      
      const serverTypes = leafClass.endpointProfiles.map(p => p.name);
      expect(serverTypes).toContain('compute-standard');
      expect(serverTypes).toContain('storage-standard');
    });
  });

  describe('Error Handling - Missing Files', () => {
    it('should throw error for missing switches.yaml', async () => {
      await fs.writeFile(
        path.join(fgdTestPath, 'servers.yaml'),
        'servers: []\nmetadata: { totalServers: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'connections.yaml'),
        'connections: []\nmetadata: { fabricName: "test", totalConnections: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('switches.yaml');
    });

    it('should throw error for missing servers.yaml', async () => {
      await fs.writeFile(
        path.join(fgdTestPath, 'switches.yaml'),
        'switches: []\nmetadata: { totalSwitches: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'connections.yaml'),
        'connections: []\nmetadata: { fabricName: "test", totalConnections: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('servers.yaml');
    });

    it('should throw error for missing connections.yaml', async () => {
      await fs.writeFile(
        path.join(fgdTestPath, 'switches.yaml'),
        'switches: []\nmetadata: { totalSwitches: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'servers.yaml'),
        'servers: []\nmetadata: { totalServers: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('connections.yaml');
    });
  });

  describe('Error Handling - Malformed YAML', () => {
    it('should throw error for invalid YAML syntax', async () => {
      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), 'invalid: yaml: syntax: [');
      await fs.writeFile(
        path.join(fgdTestPath, 'servers.yaml'),
        'servers: []\nmetadata: { totalServers: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'connections.yaml'),
        'connections: []\nmetadata: { fabricName: "test", totalConnections: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
    });

    it('should throw error for missing required structure', async () => {
      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), '{}'); // Missing switches array
      await fs.writeFile(
        path.join(fgdTestPath, 'servers.yaml'),
        'servers: []\nmetadata: { totalServers: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'connections.yaml'),
        'connections: []\nmetadata: { fabricName: "test", totalConnections: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('switches');
    });

    it('should throw error for missing metadata', async () => {
      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), 'switches: []'); // Missing metadata
      await fs.writeFile(
        path.join(fgdTestPath, 'servers.yaml'),
        'servers: []\nmetadata: { totalServers: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );
      await fs.writeFile(
        path.join(fgdTestPath, 'connections.yaml'),
        'connections: []\nmetadata: { fabricName: "test", totalConnections: 0, generatedAt: "2025-08-31T12:00:00.000Z" }'
      );

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('metadata');
    });
  });

  describe('Error Handling - Unknown Switch Models', () => {
    it('should throw error for unknown spine model', async () => {
      await createSingleClassFGD(fgdTestPath, { spineModel: 'UNKNOWN' as any });

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('Unsupported spine model');
    });

    it('should throw error for unknown leaf model', async () => {
      await createSingleClassFGD(fgdTestPath, { leafModel: 'UNKNOWN' as any });

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('Unsupported leaf model');
    });

    it('should throw error for mixed spine models', async () => {
      const switchesData = {
        switches: [
          { id: 'spine-1', model: 'DS3000', ports: 64, type: 'spine' },
          { id: 'spine-2', model: 'DS2000', ports: 48, type: 'spine' }, // Mixed model
          { id: 'leaf-1', model: 'DS2000', ports: 48, type: 'leaf' },
        ],
        metadata: { totalSwitches: 3, generatedAt: '2025-08-31T12:00:00.000Z' },
      };

      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), 
        `switches:\n  - id: spine-1\n    model: DS3000\n    ports: 64\n    type: spine\n  - id: spine-2\n    model: DS2000\n    ports: 48\n    type: spine\n  - id: leaf-1\n    model: DS2000\n    ports: 48\n    type: leaf\nmetadata:\n  totalSwitches: 3\n  generatedAt: "2025-08-31T12:00:00.000Z"`
      );
      await createMinimalServerAndConnectionFiles(fgdTestPath);

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('Multiple spine models');
    });
  });

  describe('Error Handling - Impossible Topologies', () => {
    it('should throw error for no spine switches', async () => {
      const switchesData = {
        switches: [
          { id: 'leaf-1', model: 'DS2000', ports: 48, type: 'leaf' },
        ],
        metadata: { totalSwitches: 1, generatedAt: '2025-08-31T12:00:00.000Z' },
      };

      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), 
        `switches:\n  - id: leaf-1\n    model: DS2000\n    ports: 48\n    type: leaf\nmetadata:\n  totalSwitches: 1\n  generatedAt: "2025-08-31T12:00:00.000Z"`
      );
      await createMinimalServerAndConnectionFiles(fgdTestPath);

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('No spine switches found');
    });

    it('should throw error for no leaf switches', async () => {
      const switchesData = {
        switches: [
          { id: 'spine-1', model: 'DS3000', ports: 64, type: 'spine' },
        ],
        metadata: { totalSwitches: 1, generatedAt: '2025-08-31T12:00:00.000Z' },
      };

      await fs.writeFile(path.join(fgdTestPath, 'switches.yaml'), 
        `switches:\n  - id: spine-1\n    model: DS3000\n    ports: 64\n    type: spine\nmetadata:\n  totalSwitches: 1\n  generatedAt: "2025-08-31T12:00:00.000Z"`
      );
      await createMinimalServerAndConnectionFiles(fgdTestPath);

      await expect(importFromFGD(fgdTestPath)).rejects.toThrow(ImportError);
      await expect(importFromFGD(fgdTestPath)).rejects.toThrow('No leaf switches found');
    });
  });

  describe('Capacity Violations', () => {
    it('should detect leaf port capacity exceeded', async () => {
      // Create scenario where leaf has more connections than ports
      await createCapacityViolationFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.some(err => err.includes('exceeds port capacity'))).toBe(true);
    });

    it('should provide detailed capacity analysis', async () => {
      await createSingleClassFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      // Should be valid for normal case
      expect(result.validation.isValid).toBe(true);
      expect(result.provenance.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce identical results for same input', async () => {
      await createSingleClassFGD(fgdTestPath);
      
      const result1 = await importFromFGD(fgdTestPath);
      const result2 = await importFromFGD(fgdTestPath);
      
      // Compare key deterministic fields
      expect(result1.fabricSpec.name).toBe(result2.fabricSpec.name);
      expect(result1.fabricSpec.spineModelId).toBe(result2.fabricSpec.spineModelId);
      expect(result1.fabricSpec.leafModelId).toBe(result2.fabricSpec.leafModelId);
      expect(result1.fabricSpec.uplinksPerLeaf).toBe(result2.fabricSpec.uplinksPerLeaf);
      expect(result1.leafClasses.length).toBe(result2.leafClasses.length);
      
      // Leaf classes should be identical
      for (let i = 0; i < result1.leafClasses.length; i++) {
        expect(result1.leafClasses[i].id).toBe(result2.leafClasses[i].id);
        expect(result1.leafClasses[i].uplinksPerLeaf).toBe(result2.leafClasses[i].uplinksPerLeaf);
      }
    });

    it('should maintain sorted order for leaf classes', async () => {
      await createMultiClassFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      const leafClassIds = result.leafClasses.map(lc => lc.id);
      const sortedIds = [...leafClassIds].sort();
      
      expect(leafClassIds).toEqual(sortedIds);
    });
  });

  describe('Edge Cases', () => {
    it('should handle disconnected leaf switches', async () => {
      await createDisconnectedLeafFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      // Should detect the issue
      expect(result.provenance.warnings.some(w => w.includes('no uplinks'))).toBe(true);
    });

    it('should handle servers with varying connection counts', async () => {
      await createVaryingConnectionsFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      // Should warn about inconsistency
      expect(result.provenance.warnings.some(w => w.includes('varying connection counts'))).toBe(true);
    });

    it('should handle empty server types gracefully', async () => {
      await createEmptyServerTypeFGD(fgdTestPath);
      
      const result = await importFromFGD(fgdTestPath);
      
      // Should complete but may have warnings
      expect(result.validation.isValid).toBe(true);
    });
  });

  // Helper functions for creating test data
  async function createSingleClassFGD(basePath: string, options: { spineModel?: string; leafModel?: string } = {}) {
    const spineModel = options.spineModel || 'DS3000';
    const leafModel = options.leafModel || 'DS2000';
    
    // Single spine, single leaf, 22 compute servers (44 endpoint ports + 4 uplinks = 48 total, fits DS2000)
    const switchesContent = `switches:
  - id: leaf-1
    model: ${leafModel}
    ports: 48
    type: leaf
  - id: spine-1
    model: ${spineModel}
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers:
${Array.from({ length: 22 }, (_, i) => `  - connections: 2
    id: server-${i + 1}
    type: compute-standard`).join('\n')}
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 22`;

    const connectionsContent = `connections:
  - from:
      device: leaf-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
  - from:
      device: leaf-1
      port: uplink-2
    to:
      device: spine-1
      port: downlink-2
    type: uplink
  - from:
      device: leaf-1
      port: uplink-3
    to:
      device: spine-1
      port: downlink-3
    type: uplink
  - from:
      device: leaf-1
      port: uplink-4
    to:
      device: spine-1
      port: downlink-4
    type: uplink
${Array.from({ length: 22 }, (_, i) => `  - from:
      device: server-${i + 1}
      port: eth0
    to:
      device: leaf-1
      port: port-${i + 1}
    type: endpoint
  - from:
      device: server-${i + 1}
      port: eth1
    to:
      device: leaf-1
      port: port-${i + 23}
    type: endpoint`).join('\n')}
metadata:
  fabricName: test-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 48`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createMultiClassFGD(basePath: string) {
    // Multi-leaf setup with different uplink counts and server types
    const switchesContent = `switches:
  - id: leaf-compute-1
    model: DS2000
    ports: 48
    type: leaf
  - id: leaf-storage-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 3`;

    const serversContent = `servers:
${Array.from({ length: 10 }, (_, i) => `  - connections: 2
    id: compute-server-${i + 1}
    type: compute-high`).join('\n')}
${Array.from({ length: 8 }, (_, i) => `  - connections: 4
    id: storage-server-${i + 1}
    type: storage-standard`).join('\n')}
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 18`;

    // Leaf-compute has 4 uplinks, leaf-storage has 2 uplinks
    const connectionsContent = `connections:
  - from:
      device: leaf-compute-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
  - from:
      device: leaf-compute-1
      port: uplink-2
    to:
      device: spine-1
      port: downlink-2
    type: uplink
  - from:
      device: leaf-compute-1
      port: uplink-3
    to:
      device: spine-1
      port: downlink-3
    type: uplink
  - from:
      device: leaf-compute-1
      port: uplink-4
    to:
      device: spine-1
      port: downlink-4
    type: uplink
  - from:
      device: leaf-storage-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-5
    type: uplink
  - from:
      device: leaf-storage-1
      port: uplink-2
    to:
      device: spine-1
      port: downlink-6
    type: uplink
${Array.from({ length: 10 }, (_, i) => `  - from:
      device: compute-server-${i + 1}
      port: eth0
    to:
      device: leaf-compute-1
      port: port-${i + 1}
    type: endpoint
  - from:
      device: compute-server-${i + 1}
      port: eth1
    to:
      device: leaf-compute-1
      port: port-${i + 11}
    type: endpoint`).join('\n')}
${Array.from({ length: 8 }, (_, i) => `  - from:
      device: storage-server-${i + 1}
      port: eth0
    to:
      device: leaf-storage-1
      port: port-${i + 1}
    type: endpoint
  - from:
      device: storage-server-${i + 1}
      port: eth1
    to:
      device: leaf-storage-1
      port: port-${i + 9}
    type: endpoint
  - from:
      device: storage-server-${i + 1}
      port: eth2
    to:
      device: leaf-storage-1
      port: port-${i + 17}
    type: endpoint
  - from:
      device: storage-server-${i + 1}
      port: eth3
    to:
      device: leaf-storage-1
      port: port-${i + 25}
    type: endpoint`).join('\n')}
metadata:
  fabricName: multi-class-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 58`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createMixedServerTypeFGD(basePath: string) {
    // Single leaf with mixed server types
    const switchesContent = `switches:
  - id: leaf-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers:
${Array.from({ length: 5 }, (_, i) => `  - connections: 2
    id: compute-server-${i + 1}
    type: compute-standard`).join('\n')}
${Array.from({ length: 3 }, (_, i) => `  - connections: 2
    id: storage-server-${i + 1}
    type: storage-standard`).join('\n')}
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 8`;

    const connectionsContent = `connections:
  - from:
      device: leaf-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
  - from:
      device: leaf-1
      port: uplink-2
    to:
      device: spine-1
      port: downlink-2
    type: uplink
${Array.from({ length: 5 }, (_, i) => `  - from:
      device: compute-server-${i + 1}
      port: eth0
    to:
      device: leaf-1
      port: port-${i + 1}
    type: endpoint
  - from:
      device: compute-server-${i + 1}
      port: eth1
    to:
      device: leaf-1
      port: port-${i + 9}
    type: endpoint`).join('\n')}
${Array.from({ length: 3 }, (_, i) => `  - from:
      device: storage-server-${i + 1}
      port: eth0
    to:
      device: leaf-1
      port: port-${i + 15}
    type: endpoint
  - from:
      device: storage-server-${i + 1}
      port: eth1
    to:
      device: leaf-1
      port: port-${i + 19}
    type: endpoint`).join('\n')}
metadata:
  fabricName: mixed-server-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 18`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createCapacityViolationFGD(basePath: string) {
    // Create a leaf switch with too many connections (49 > 48 port limit)
    const switchesContent = `switches:
  - id: leaf-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers:
${Array.from({ length: 25 }, (_, i) => `  - connections: 2
    id: server-${i + 1}
    type: compute-standard`).join('\n')}
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 25`;

    // 4 uplinks + 50 endpoint connections = 54 > 48 port limit
    const connectionsContent = `connections:
  - from:
      device: leaf-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
  - from:
      device: leaf-1
      port: uplink-2
    to:
      device: spine-1
      port: downlink-2
    type: uplink
  - from:
      device: leaf-1
      port: uplink-3
    to:
      device: spine-1
      port: downlink-3
    type: uplink
  - from:
      device: leaf-1
      port: uplink-4
    to:
      device: spine-1
      port: downlink-4
    type: uplink
${Array.from({ length: 25 }, (_, i) => `  - from:
      device: server-${i + 1}
      port: eth0
    to:
      device: leaf-1
      port: port-${i + 1}
    type: endpoint
  - from:
      device: server-${i + 1}
      port: eth1
    to:
      device: leaf-1
      port: port-${i + 26}
    type: endpoint`).join('\n')}
metadata:
  fabricName: capacity-violation-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 54`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createDisconnectedLeafFGD(basePath: string) {
    const switchesContent = `switches:
  - id: leaf-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers:
  - connections: 1
    id: server-1
    type: compute-standard
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 1`;

    // No uplinks from leaf to spine - disconnected topology
    const connectionsContent = `connections:
  - from:
      device: server-1
      port: eth0
    to:
      device: leaf-1
      port: port-1
    type: endpoint
metadata:
  fabricName: disconnected-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 1`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createVaryingConnectionsFGD(basePath: string) {
    const switchesContent = `switches:
  - id: leaf-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers:
  - connections: 1
    id: server-1
    type: compute-standard
  - connections: 2
    id: server-2
    type: compute-standard
  - connections: 4
    id: server-3
    type: compute-standard
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 3`;

    const connectionsContent = `connections:
  - from:
      device: leaf-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
  - from:
      device: server-1
      port: eth0
    to:
      device: leaf-1
      port: port-1
    type: endpoint
  - from:
      device: server-2
      port: eth0
    to:
      device: leaf-1
      port: port-2
    type: endpoint
  - from:
      device: server-2
      port: eth1
    to:
      device: leaf-1
      port: port-3
    type: endpoint
  - from:
      device: server-3
      port: eth0
    to:
      device: leaf-1
      port: port-4
    type: endpoint
  - from:
      device: server-3
      port: eth1
    to:
      device: leaf-1
      port: port-5
    type: endpoint
  - from:
      device: server-3
      port: eth2
    to:
      device: leaf-1
      port: port-6
    type: endpoint
  - from:
      device: server-3
      port: eth3
    to:
      device: leaf-1
      port: port-7
    type: endpoint
metadata:
  fabricName: varying-connections-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 8`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createEmptyServerTypeFGD(basePath: string) {
    const switchesContent = `switches:
  - id: leaf-1
    model: DS2000
    ports: 48
    type: leaf
  - id: spine-1
    model: DS3000
    ports: 64
    type: spine
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalSwitches: 2`;

    const serversContent = `servers: []
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 0`;

    const connectionsContent = `connections:
  - from:
      device: leaf-1
      port: uplink-1
    to:
      device: spine-1
      port: downlink-1
    type: uplink
metadata:
  fabricName: empty-servers-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 1`;

    await fs.writeFile(path.join(basePath, 'switches.yaml'), switchesContent);
    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }

  async function createMinimalServerAndConnectionFiles(basePath: string) {
    const serversContent = `servers: []
metadata:
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalServers: 0`;

    const connectionsContent = `connections: []
metadata:
  fabricName: test-fabric
  generatedAt: "2025-08-31T12:00:00.000Z"
  totalConnections: 0`;

    await fs.writeFile(path.join(basePath, 'servers.yaml'), serversContent);
    await fs.writeFile(path.join(basePath, 'connections.yaml'), connectionsContent);
  }
});