import { describe, it, expect } from 'vitest';
import { serializeWiringDiagram, deserializeWiringDiagram, validateYAML } from '../../src/io/yaml';
// Test fixture: minimal wiring diagram
const mockWiringDiagram = {
    devices: {
        spines: [
            { id: 'spine-1', model: 'DS3000', ports: 32 },
            { id: 'spine-2', model: 'DS3000', ports: 32 }
        ],
        leaves: [
            { id: 'leaf-1', model: 'DS2000', ports: 48 },
            { id: 'leaf-2', model: 'DS2000', ports: 48 }
        ],
        servers: [
            { id: 'server-1', type: 'compute', connections: 2 },
            { id: 'server-2', type: 'storage', connections: 4 }
        ]
    },
    connections: [
        {
            from: { device: 'leaf-1', port: 'uplink-1' },
            to: { device: 'spine-1', port: 'downlink-1' },
            type: 'uplink'
        },
        {
            from: { device: 'leaf-1', port: 'uplink-2' },
            to: { device: 'spine-2', port: 'downlink-2' },
            type: 'uplink'
        }
    ],
    metadata: {
        generatedAt: new Date('2024-01-01T00:00:00Z'),
        fabricName: 'test-fabric',
        totalDevices: 6
    }
};
describe('YAML Serialization', () => {
    it('should serialize wiring diagram to YAML strings', () => {
        const result = serializeWiringDiagram(mockWiringDiagram);
        expect(result).toHaveProperty('servers');
        expect(result).toHaveProperty('switches');
        expect(result).toHaveProperty('connections');
        // Verify that all results are valid YAML strings
        expect(typeof result.servers).toBe('string');
        expect(typeof result.switches).toBe('string');
        expect(typeof result.connections).toBe('string');
        // Verify non-empty
        expect(result.servers.length).toBeGreaterThan(0);
        expect(result.switches.length).toBeGreaterThan(0);
        expect(result.connections.length).toBeGreaterThan(0);
    });
    it('should produce valid YAML for each component', () => {
        const result = serializeWiringDiagram(mockWiringDiagram);
        const serversValid = validateYAML(result.servers);
        const switchesValid = validateYAML(result.switches);
        const connectionsValid = validateYAML(result.connections);
        expect(serversValid.isValid).toBe(true);
        expect(switchesValid.isValid).toBe(true);
        expect(connectionsValid.isValid).toBe(true);
    });
    it('should produce deterministic output with sorted keys', () => {
        const result1 = serializeWiringDiagram(mockWiringDiagram);
        const result2 = serializeWiringDiagram(mockWiringDiagram);
        expect(result1.servers).toBe(result2.servers);
        expect(result1.switches).toBe(result2.switches);
        expect(result1.connections).toBe(result2.connections);
    });
    it('should handle empty devices arrays', () => {
        const emptyDiagram = {
            devices: {
                spines: [],
                leaves: [],
                servers: []
            },
            connections: [],
            metadata: {
                generatedAt: new Date('2024-01-01T00:00:00Z'),
                fabricName: 'empty-fabric',
                totalDevices: 0
            }
        };
        const result = serializeWiringDiagram(emptyDiagram);
        expect(result.servers).toContain('servers: []');
        expect(result.switches).toContain('switches: []');
        expect(result.connections).toContain('connections: []');
    });
});
describe('YAML Deserialization', () => {
    it('should deserialize YAML strings back to wiring diagram', () => {
        const serialized = serializeWiringDiagram(mockWiringDiagram);
        const result = deserializeWiringDiagram(serialized);
        // Verify structure
        expect(result).toHaveProperty('devices');
        expect(result).toHaveProperty('connections');
        expect(result).toHaveProperty('metadata');
        // Verify devices
        expect(result.devices.spines).toHaveLength(2);
        expect(result.devices.leaves).toHaveLength(2);
        expect(result.devices.servers).toHaveLength(2);
        // Verify connections
        expect(result.connections).toHaveLength(2);
        // Verify metadata
        expect(result.metadata.fabricName).toBe('test-fabric');
        expect(result.metadata.totalDevices).toBe(6);
    });
    it('should preserve all device data through roundtrip', () => {
        const serialized = serializeWiringDiagram(mockWiringDiagram);
        const result = deserializeWiringDiagram(serialized);
        // Check spines
        expect(result.devices.spines).toEqual(mockWiringDiagram.devices.spines);
        // Check leaves
        expect(result.devices.leaves).toEqual(mockWiringDiagram.devices.leaves);
        // Check servers
        expect(result.devices.servers).toEqual(mockWiringDiagram.devices.servers);
    });
    it('should preserve connection data through roundtrip', () => {
        const serialized = serializeWiringDiagram(mockWiringDiagram);
        const result = deserializeWiringDiagram(serialized);
        expect(result.connections).toEqual(mockWiringDiagram.connections);
    });
    it('should preserve metadata through roundtrip', () => {
        const serialized = serializeWiringDiagram(mockWiringDiagram);
        const result = deserializeWiringDiagram(serialized);
        expect(result.metadata.fabricName).toBe(mockWiringDiagram.metadata.fabricName);
        expect(result.metadata.totalDevices).toBe(mockWiringDiagram.metadata.totalDevices);
        // Note: Date comparison is done by value, not reference
        expect(result.metadata.generatedAt.getTime()).toBe(mockWiringDiagram.metadata.generatedAt.getTime());
    });
    it('should throw error for invalid YAML', () => {
        const invalidYamls = {
            servers: 'invalid: yaml: [unclosed',
            switches: 'valid: yaml\nkey: value',
            connections: 'valid: yaml\nkey: value'
        };
        expect(() => deserializeWiringDiagram(invalidYamls)).toThrow();
    });
    it('should throw error for missing required fields', () => {
        const incompleteYamls = {
            servers: 'servers: []',
            switches: 'invalid_structure: true',
            connections: 'connections: []'
        };
        expect(() => deserializeWiringDiagram(incompleteYamls)).toThrow();
    });
});
describe('YAML Validation', () => {
    it('should validate correct YAML', () => {
        const validYaml = 'key: value\narray:\n  - item1\n  - item2';
        const result = validateYAML(validYaml);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
    });
    it('should detect invalid YAML', () => {
        const invalidYaml = 'key: value\n  invalid_indentation: true\n[unclosed_array';
        const result = validateYAML(invalidYaml);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
    });
    it('should handle empty strings', () => {
        const emptyResult = validateYAML('');
        expect(emptyResult.isValid).toBe(true);
        const whitespaceResult = validateYAML('   \n\n   ');
        expect(whitespaceResult.isValid).toBe(true);
    });
});
describe('Roundtrip Testing', () => {
    it('should preserve complex wiring diagram exactly', () => {
        // Create a more complex diagram
        const complexDiagram = {
            devices: {
                spines: [
                    { id: 'spine-1', model: 'DS3000-48', ports: 48 },
                    { id: 'spine-2', model: 'DS3000-48', ports: 48 },
                    { id: 'spine-3', model: 'DS3000-32', ports: 32 }
                ],
                leaves: [
                    { id: 'leaf-01', model: 'DS2000-48', ports: 48 },
                    { id: 'leaf-02', model: 'DS2000-48', ports: 48 },
                    { id: 'leaf-03', model: 'DS2000-24', ports: 24 },
                    { id: 'leaf-04', model: 'DS2000-24', ports: 24 }
                ],
                servers: [
                    { id: 'compute-001', type: 'HPC', connections: 4 },
                    { id: 'compute-002', type: 'HPC', connections: 4 },
                    { id: 'storage-001', type: 'NVMe', connections: 8 },
                    { id: 'mgmt-001', type: 'management', connections: 1 }
                ]
            },
            connections: [
                { from: { device: 'leaf-01', port: 'eth1/1' }, to: { device: 'spine-1', port: 'eth1/1' }, type: 'uplink' },
                { from: { device: 'leaf-01', port: 'eth1/2' }, to: { device: 'spine-2', port: 'eth1/1' }, type: 'uplink' },
                { from: { device: 'leaf-02', port: 'eth1/1' }, to: { device: 'spine-1', port: 'eth1/2' }, type: 'uplink' },
                { from: { device: 'leaf-02', port: 'eth1/2' }, to: { device: 'spine-3', port: 'eth1/1' }, type: 'uplink' }
            ],
            metadata: {
                generatedAt: new Date('2024-03-15T14:30:00Z'),
                fabricName: 'production-fabric-v2',
                totalDevices: 11
            }
        };
        // Perform roundtrip
        const serialized = serializeWiringDiagram(complexDiagram);
        const deserialized = deserializeWiringDiagram(serialized);
        // Verify exact preservation
        expect(deserialized.devices.spines).toEqual(complexDiagram.devices.spines);
        expect(deserialized.devices.leaves).toEqual(complexDiagram.devices.leaves);
        expect(deserialized.devices.servers).toEqual(complexDiagram.devices.servers);
        expect(deserialized.connections).toEqual(complexDiagram.connections);
        expect(deserialized.metadata.fabricName).toBe(complexDiagram.metadata.fabricName);
        expect(deserialized.metadata.totalDevices).toBe(complexDiagram.metadata.totalDevices);
        expect(deserialized.metadata.generatedAt.getTime()).toBe(complexDiagram.metadata.generatedAt.getTime());
    });
    it('should handle multiple serialization-deserialization cycles', () => {
        let current = mockWiringDiagram;
        // Perform 5 cycles
        for (let i = 0; i < 5; i++) {
            const serialized = serializeWiringDiagram(current);
            current = deserializeWiringDiagram(serialized);
        }
        // Verify no data degradation
        expect(current.devices.spines).toEqual(mockWiringDiagram.devices.spines);
        expect(current.devices.leaves).toEqual(mockWiringDiagram.devices.leaves);
        expect(current.devices.servers).toEqual(mockWiringDiagram.devices.servers);
        expect(current.connections).toEqual(mockWiringDiagram.connections);
        expect(current.metadata.fabricName).toBe(mockWiringDiagram.metadata.fabricName);
        expect(current.metadata.totalDevices).toBe(mockWiringDiagram.metadata.totalDevices);
    });
});
