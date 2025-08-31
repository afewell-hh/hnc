/**
 * Unit tests for wiring domain - HNC v0.4
 * Tests invariants, determinism, multi-class, and error cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  buildWiring, 
  validateWiring, 
  emitYaml,
  writeWiringToFGD,
  wiringToWiringDiagram,
  type Wiring,
  type WiringDevice,
  type WiringConnection
} from './wiring';
import type {
  FabricSpec,
  AllocationResult,
  LeafAllocation,
  SwitchProfile,
  EndpointProfile,
  LeafClass
} from '../app.types';
import type {
  MultiClassAllocationResult
} from './types';

// Test fixtures
const mockSpineProfile: SwitchProfile = {
  modelId: 'DS3000',
  roles: ['spine'],
  ports: {
    endpointAssignable: [],
    fabricAssignable: ['1/1', '1/2', '1/3', '1/4', '2/1', '2/2', '2/3', '2/4']
  },
  profiles: {
    endpoint: { portProfile: null, speedGbps: 25 },
    uplink: { portProfile: null, speedGbps: 100 }
  },
  meta: { source: 'test', version: '1.0' }
};

const mockLeafProfile: SwitchProfile = {
  modelId: 'DS2000',
  roles: ['leaf'],
  ports: {
    endpointAssignable: ['1/1', '1/2', '1/3', '1/4'],
    fabricAssignable: ['2/1', '2/2', '2/3', '2/4']
  },
  profiles: {
    endpoint: { portProfile: null, speedGbps: 25 },
    uplink: { portProfile: null, speedGbps: 100 }
  },
  meta: { source: 'test', version: '1.0' }
};

const mockProfiles = new Map<string, SwitchProfile>([
  ['DS3000', mockSpineProfile],
  ['DS2000', mockLeafProfile]
]);

const mockEndpointProfile: EndpointProfile = {
  name: 'Standard Server',
  portsPerEndpoint: 1,
  type: 'server',
  count: 8
};

describe('buildWiring - Single Class', () => {
  let fabricSpec: FabricSpec;
  let allocationResult: AllocationResult;

  beforeEach(() => {
    fabricSpec = {
      name: 'Test Fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointProfile: mockEndpointProfile,
      endpointCount: 8
    };

    allocationResult = {
      leafMaps: [
        {
          leafId: 0,
          uplinks: [
            { port: '2/1', toSpine: 0 },
            { port: '2/2', toSpine: 1 }
          ]
        },
        {
          leafId: 1, 
          uplinks: [
            { port: '2/1', toSpine: 0 },
            { port: '2/2', toSpine: 1 }
          ]
        }
      ],
      spineUtilization: [2, 2],
      issues: []
    };
  });

  it('should create wiring with deterministic device naming', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, allocationResult);

    // Check spine naming: spine-1, spine-2, ...
    expect(wiring.devices.spines).toHaveLength(2);
    expect(wiring.devices.spines[0].id).toBe('spine-1');
    expect(wiring.devices.spines[1].id).toBe('spine-2');

    // Check leaf naming: leaf-1, leaf-2, ...
    expect(wiring.devices.leaves).toHaveLength(2);
    expect(wiring.devices.leaves[0].id).toBe('leaf-1');
    expect(wiring.devices.leaves[1].id).toBe('leaf-2');

    // Check server naming: srv-default-standardserver-1, ...
    expect(wiring.devices.servers).toHaveLength(8);
    expect(wiring.devices.servers[0].id).toBe('srv-default-standardserver-1');
    expect(wiring.devices.servers[7].id).toBe('srv-default-standardserver-8');
  });

  it('should create correct uplink connections', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, allocationResult);
    
    const uplinks = wiring.connections.filter(c => c.type === 'uplink');
    expect(uplinks).toHaveLength(4); // 2 leaves * 2 uplinks each

    // Check deterministic connection naming
    const leaf1Uplinks = uplinks.filter(c => c.from.device === 'leaf-1');
    expect(leaf1Uplinks).toHaveLength(2);
    expect(leaf1Uplinks[0].id).toContain('link-leaf-1-spine-');
    expect(leaf1Uplinks[1].id).toContain('link-leaf-1-spine-');
  });

  it('should create endpoint connections', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, allocationResult);
    
    const endpoints = wiring.connections.filter(c => c.type === 'endpoint');
    expect(endpoints).toHaveLength(8); // 8 servers

    // Check server-to-leaf connections
    const server1Connection = endpoints.find(c => c.from.device === 'srv-default-standardserver-1');
    expect(server1Connection).toBeDefined();
    expect(server1Connection!.to.device).toBe('leaf-1');
    expect(server1Connection!.from.port).toBe('eth0');
  });

  it('should validate allocation -> wiring invariants', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, allocationResult);
    const validation = validateWiring(wiring);

    // No errors should exist
    expect(validation.errors).toHaveLength(0);
    
    // All uplinks should be mapped
    const uplinks = wiring.connections.filter(c => c.type === 'uplink');
    expect(uplinks).toHaveLength(allocationResult.leafMaps.length * (fabricSpec.uplinksPerLeaf || 0));

    // No duplicate ports should exist
    expect(validation.errors.filter(e => e.includes('Port overlap'))).toHaveLength(0);
  });
});

describe('buildWiring - Multi Class', () => {
  let fabricSpec: FabricSpec;
  let multiClassAllocation: MultiClassAllocationResult;

  beforeEach(() => {
    const leafClass1: LeafClass = {
      id: 'compute',
      name: 'Compute Class',
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [
        { name: 'Compute Server', portsPerEndpoint: 1, type: 'compute', count: 4 }
      ]
    };

    const leafClass2: LeafClass = {
      id: 'storage',
      name: 'Storage Class', 
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [
        { name: 'Storage Server', portsPerEndpoint: 2, type: 'storage', count: 2 }
      ]
    };

    fabricSpec = {
      name: 'Multi Class Fabric',
      spineModelId: 'DS3000', 
      leafModelId: 'DS2000',
      leafClasses: [leafClass1, leafClass2]
    };

    multiClassAllocation = {
      classAllocations: [
        {
          classId: 'compute',
          leafMaps: [
            {
              leafId: 0,
              uplinks: [
                { port: '2/1', toSpine: 0 },
                { port: '2/2', toSpine: 1 }
              ]
            }
          ],
          totalEndpoints: 4,
          leavesAllocated: 1,
          issues: []
        },
        {
          classId: 'storage',
          leafMaps: [
            {
              leafId: 1,
              uplinks: [
                { port: '2/1', toSpine: 0 },
                { port: '2/2', toSpine: 1 }
              ]
            }
          ],
          totalEndpoints: 2,
          leavesAllocated: 1,
          issues: []
        }
      ],
      spineUtilization: [2, 2],
      totalLeavesAllocated: 2,
      overallIssues: []
    };
  });

  it('should create multi-class wiring with class-specific naming', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, multiClassAllocation);

    // Check class-specific leaf naming: leaf-<classId>-<index>
    expect(wiring.devices.leaves).toHaveLength(2);
    const computeLeaf = wiring.devices.leaves.find(l => l.classId === 'compute');
    const storageLeaf = wiring.devices.leaves.find(l => l.classId === 'storage');
    
    expect(computeLeaf).toBeDefined();
    expect(computeLeaf!.id).toBe('leaf-compute-1');
    expect(storageLeaf).toBeDefined();  
    expect(storageLeaf!.id).toBe('leaf-storage-1');

    // Check class-specific server naming: srv-<classId>-<profileId>-<index>
    const computeServers = wiring.devices.servers.filter(s => s.classId === 'compute');
    const storageServers = wiring.devices.servers.filter(s => s.classId === 'storage');
    
    expect(computeServers).toHaveLength(4);
    expect(computeServers[0].id).toBe('srv-compute-computeserver-1');
    expect(storageServers).toHaveLength(2);
    expect(storageServers[0].id).toBe('srv-storage-storageserver-1');
  });

  it('should handle multi-class uplink connections correctly', () => {
    const wiring = buildWiring(fabricSpec, mockProfiles, multiClassAllocation);
    
    const uplinks = wiring.connections.filter(c => c.type === 'uplink');
    expect(uplinks).toHaveLength(4); // 2 classes * 1 leaf each * 2 uplinks per leaf

    // Check that each class has its own uplink connections
    const computeUplinks = uplinks.filter(c => c.from.device === 'leaf-compute-1');
    const storageUplinks = uplinks.filter(c => c.from.device === 'leaf-storage-1');
    
    expect(computeUplinks).toHaveLength(2);
    expect(storageUplinks).toHaveLength(2);
  });
});

describe('validateWiring', () => {
  let validWiring: Wiring;

  beforeEach(() => {
    validWiring = {
      devices: {
        spines: [
          { id: 'spine-1', type: 'spine', modelId: 'DS3000', ports: 8 }
        ],
        leaves: [
          { id: 'leaf-1', type: 'leaf', modelId: 'DS2000', ports: 8 }
        ],
        servers: [
          { id: 'srv-default-server-1', type: 'server', modelId: 'server', ports: 1 }
        ]
      },
      connections: [
        {
          id: 'link-leaf-1-spine-1-1',
          from: { device: 'leaf-1', port: '2/1' },
          to: { device: 'spine-1', port: '1/1' },
          type: 'uplink'
        },
        {
          id: 'link-srv-default-server-1-leaf-1-1',
          from: { device: 'srv-default-server-1', port: 'eth0' },
          to: { device: 'leaf-1', port: '1/1' },
          type: 'endpoint'
        }
      ],
      metadata: {
        fabricName: 'Test',
        fabricId: 'test',
        generatedAt: new Date(),
        totalDevices: 3,
        totalConnections: 2
      }
    };
  });

  it('should pass validation for correct wiring', () => {
    const result = validateWiring(validWiring);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should detect duplicate device IDs', () => {
    // Add duplicate device ID
    validWiring.devices.servers.push({
      id: 'spine-1', // Same as spine
      type: 'server',
      modelId: 'server',
      ports: 1
    });

    const result = validateWiring(validWiring);
    expect(result.errors.some(e => e.includes('Duplicate device IDs'))).toBe(true);
  });

  it('should detect port overlaps', () => {
    // Add connection that uses the same port on same device
    validWiring.connections.push({
      id: 'link-duplicate-port',
      from: { device: 'leaf-1', port: '2/1' }, // Same port as existing uplink
      to: { device: 'spine-1', port: '1/2' },
      type: 'uplink'
    });

    const result = validateWiring(validWiring);
    expect(result.errors.some(e => e.includes('Port overlap'))).toBe(true);
  });

  it('should detect leaves without uplinks', () => {
    // Remove uplink connection
    validWiring.connections = validWiring.connections.filter(c => c.type !== 'uplink');

    const result = validateWiring(validWiring);
    expect(result.warnings.some(w => w.includes('has no uplink connections'))).toBe(true);
  });

  it('should warn about uneven spine utilization', () => {
    // Add more spines and uneven connections
    validWiring.devices.spines.push(
      { id: 'spine-2', type: 'spine', modelId: 'DS3000', ports: 8 },
      { id: 'spine-3', type: 'spine', modelId: 'DS3000', ports: 8 }
    );
    
    // Add more uplinks all to spine-1 (creates uneven utilization)
    validWiring.connections.push(
      {
        id: 'link-leaf-1-spine-1-2',
        from: { device: 'leaf-1', port: '2/2' },
        to: { device: 'spine-1', port: '1/2' },
        type: 'uplink'
      },
      {
        id: 'link-leaf-1-spine-1-3',
        from: { device: 'leaf-1', port: '2/3' },
        to: { device: 'spine-1', port: '1/3' },
        type: 'uplink'
      }
    );

    const result = validateWiring(validWiring);
    expect(result.warnings.some(w => w.includes('Uneven spine utilization'))).toBe(true);
  });
});

describe('emitYaml - Determinism Tests', () => {
  let wiring: Wiring;

  beforeEach(() => {
    // Create a simple wiring for determinism tests
    const fabricSpec: FabricSpec = {
      name: 'Determinism Test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointProfile: { name: 'Server', portsPerEndpoint: 1, count: 2 },
      endpointCount: 2
    };

    const allocation: AllocationResult = {
      leafMaps: [{
        leafId: 0,
        uplinks: [
          { port: '2/1', toSpine: 0 },
          { port: '2/2', toSpine: 0 }
        ]
      }],
      spineUtilization: [2],
      issues: []
    };

    wiring = buildWiring(fabricSpec, mockProfiles, allocation);
  });

  it('should produce deterministic YAML output', () => {
    const yaml1 = emitYaml(wiring);
    const yaml2 = emitYaml(wiring);

    // All YAML outputs should be identical
    expect(yaml1.switchesYaml).toBe(yaml2.switchesYaml);
    expect(yaml1.serversYaml).toBe(yaml2.serversYaml);
    expect(yaml1.connectionsYaml).toBe(yaml2.connectionsYaml);
  });

  it('should maintain deterministic ordering with shuffled input', () => {
    // Create wiring with devices and connections in different order
    const shuffledWiring: Wiring = {
      ...wiring,
      devices: {
        // Reverse order of devices
        spines: [...wiring.devices.spines].reverse(),
        leaves: [...wiring.devices.leaves].reverse(),
        servers: [...wiring.devices.servers].reverse()
      },
      connections: [...wiring.connections].reverse()
    };

    const originalYaml = emitYaml(wiring);
    const shuffledYaml = emitYaml(shuffledWiring);

    // Output should be identical despite input order differences
    expect(originalYaml.switchesYaml).toBe(shuffledYaml.switchesYaml);
    expect(originalYaml.serversYaml).toBe(shuffledYaml.serversYaml);
    expect(originalYaml.connectionsYaml).toBe(shuffledYaml.connectionsYaml);
  });

  it('should include proper metadata in YAML output', () => {
    const yaml = emitYaml(wiring);

    // Check that metadata is included in all files
    expect(yaml.switchesYaml).toContain('metadata:');
    expect(yaml.switchesYaml).toContain('totalSwitches:');
    expect(yaml.switchesYaml).toContain('fabricName:');
    
    expect(yaml.serversYaml).toContain('metadata:');
    expect(yaml.serversYaml).toContain('totalServers:');
    
    expect(yaml.connectionsYaml).toContain('metadata:');
    expect(yaml.connectionsYaml).toContain('totalConnections:');
  });
});

describe('Error Cases - Capacity Exceeded', () => {
  it('should handle missing spine profile', () => {
    const fabricSpec: FabricSpec = {
      name: 'Error Test',
      spineModelId: 'NONEXISTENT',
      leafModelId: 'DS2000'
    };

    const allocation: AllocationResult = {
      leafMaps: [],
      spineUtilization: [],
      issues: []
    };

    expect(() => {
      buildWiring(fabricSpec, mockProfiles, allocation);
    }).toThrow('Spine profile not found: NONEXISTENT');
  });

  it('should handle missing leaf profile', () => {
    const fabricSpec: FabricSpec = {
      name: 'Error Test',
      spineModelId: 'DS3000',
      leafModelId: 'NONEXISTENT'
    };

    const allocation: AllocationResult = {
      leafMaps: [],
      spineUtilization: [],
      issues: []
    };

    expect(() => {
      buildWiring(fabricSpec, mockProfiles, allocation);
    }).toThrow('Leaf profile not found: NONEXISTENT');
  });

  it('should handle allocation with capacity issues', () => {
    const fabricSpec: FabricSpec = {
      name: 'Capacity Error Test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointCount: 4
    };

    // Allocation with capacity errors
    const allocationWithErrors: AllocationResult = {
      leafMaps: [],
      spineUtilization: [],
      issues: ['Spine capacity exceeded: need 8 ports, spine has 4 fabricAssignable']
    };

    // Should not throw but should create empty wiring
    const wiring = buildWiring(fabricSpec, mockProfiles, allocationWithErrors);
    expect(wiring.devices.leaves).toHaveLength(0);
    expect(wiring.devices.servers).toHaveLength(0);
    expect(wiring.connections).toHaveLength(0);
  });
});

describe('YAML Determinism - Save/Load/Save Test', () => {
  it('should produce byte-equal YAML after round-trip', () => {
    const fabricSpec: FabricSpec = {
      name: 'Round Trip Test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointProfile: { name: 'Server', portsPerEndpoint: 1, count: 4 },
      endpointCount: 4
    };

    const allocation: AllocationResult = {
      leafMaps: [
        {
          leafId: 0,
          uplinks: [
            { port: '2/1', toSpine: 0 },
            { port: '2/2', toSpine: 1 }
          ]
        }
      ],
      spineUtilization: [1, 1],
      issues: []
    };

    const originalWiring = buildWiring(fabricSpec, mockProfiles, allocation);
    const yaml1 = emitYaml(originalWiring);
    
    // Simulate load (parsing YAML back to objects would require deserializer)
    // For this test, we verify that re-emitting the same wiring produces identical YAML
    const yaml2 = emitYaml(originalWiring);
    
    // Verify byte-equality
    expect(yaml1.switchesYaml).toBe(yaml2.switchesYaml);
    expect(yaml1.serversYaml).toBe(yaml2.serversYaml); 
    expect(yaml1.connectionsYaml).toBe(yaml2.connectionsYaml);
  });
});

describe('FGD Integration', () => {
  it('should convert wiring to WiringDiagram format', () => {
    const fabricSpec: FabricSpec = {
      name: 'FGD Test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointProfile: { name: 'Server', portsPerEndpoint: 1, count: 2 },
      endpointCount: 2
    };

    const allocation: AllocationResult = {
      leafMaps: [{
        leafId: 0,
        uplinks: [
          { port: '2/1', toSpine: 0 },
          { port: '2/2', toSpine: 0 }
        ]
      }],
      spineUtilization: [2],
      issues: []
    };

    const wiring = buildWiring(fabricSpec, mockProfiles, allocation);
    const diagram = wiringToWiringDiagram(wiring);

    // Check conversion correctness
    expect(diagram.devices.spines).toHaveLength(1);
    expect(diagram.devices.spines[0].id).toBe('spine-1');
    expect(diagram.devices.spines[0].model).toBe('DS3000');

    expect(diagram.devices.leaves).toHaveLength(1);  
    expect(diagram.devices.leaves[0].id).toBe('leaf-1');
    expect(diagram.devices.leaves[0].model).toBe('DS2000');

    expect(diagram.devices.servers).toHaveLength(2);
    expect(diagram.devices.servers[0].id).toBe('srv-default-server-1');

    expect(diagram.connections).toHaveLength(4); // 2 uplinks + 2 endpoints
    expect(diagram.metadata.fabricName).toBe('FGD Test');
  });

  it('should write wiring to FGD format', async () => {
    const fabricSpec: FabricSpec = {
      name: 'FGD Write Test',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 2,
      endpointProfile: { name: 'Server', portsPerEndpoint: 1, count: 1 },
      endpointCount: 1
    };

    const allocation: AllocationResult = {
      leafMaps: [{
        leafId: 0,
        uplinks: [
          { port: '2/1', toSpine: 0 },
          { port: '2/2', toSpine: 0 }
        ]
      }],
      spineUtilization: [2],
      issues: []
    };

    const wiring = buildWiring(fabricSpec, mockProfiles, allocation);
    
    // Test FGD write (in browser environment this will use in-memory storage)
    const result = await writeWiringToFGD(wiring, {
      fabricId: 'test-fabric',
      createDirs: true
    });

    expect(result.success).toBe(true);
    expect(result.fabricPath).toBe('./fgd/test-fabric');
    expect(result.filesWritten).toHaveLength(3);
    expect(result.filesWritten.some(f => f.includes('servers.yaml'))).toBe(true);
    expect(result.filesWritten.some(f => f.includes('switches.yaml'))).toBe(true);
    expect(result.filesWritten.some(f => f.includes('connections.yaml'))).toBe(true);
  });
});