// TODO: This test is quarantined - references src/drift/detector.js which doesn't exist
// The actual file is src/drift/detector.ts - needs significant refactoring for v0.4.1
// Original drift detection functionality may not be implemented yet

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectDrift, generateDriftReport } from '../../src/drift/detector.ts';
import * as fgdModule from '../../src/io/fgd.js';
// Mock the FGD module
vi.mock('../../src/io/fgd.js');
const mockFGD = fgdModule;
describe('Drift Detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    // Sample wiring diagrams for testing
    const baseDiagram = {
        devices: {
            spines: [
                { id: 'spine-01', model: 'DS3000', ports: 64 }
            ],
            leaves: [
                { id: 'leaf-01', model: 'DS2000', ports: 48 },
                { id: 'leaf-02', model: 'DS2000', ports: 48 }
            ],
            servers: [
                { id: 'server-01', type: 'compute', connections: 2 },
                { id: 'server-02', type: 'storage', connections: 1 }
            ]
        },
        connections: [
            {
                from: { device: 'leaf-01', port: 'eth47' },
                to: { device: 'spine-01', port: 'eth1' },
                type: 'uplink'
            },
            {
                from: { device: 'server-01', port: 'eth0' },
                to: { device: 'leaf-01', port: 'eth1' },
                type: 'endpoint'
            }
        ],
        metadata: {
            generatedAt: new Date('2024-01-01'),
            fabricName: 'test-fabric',
            totalDevices: 4
        }
    };
    describe('detectDrift', () => {
        it('should return no drift when no files exist on disk', async () => {
            mockFGD.fabricExists.mockResolvedValue(false);
            const result = await detectDrift('test-fabric', baseDiagram);
            expect(result.hasDrift).toBe(false);
            expect(result.driftSummary).toContain('No files found on disk - nothing to compare against');
            expect(result.affectedFiles).toEqual([]);
        });
        it('should return no drift when diagrams are identical', async () => {
            mockFGD.fabricExists.mockResolvedValue(true);
            mockFGD.loadFGD.mockResolvedValue({
                success: true,
                diagram: baseDiagram,
                filesRead: ['switches.yaml', 'servers.yaml', 'connections.yaml']
            });
            const result = await detectDrift('test-fabric', baseDiagram);
            expect(result.hasDrift).toBe(false);
            expect(result.driftSummary.some(s => s.includes('No drift detected'))).toBe(true);
            expect(result.affectedFiles).toEqual(['switches.yaml', 'servers.yaml', 'connections.yaml']);
        });
        it('should detect drift when devices are added', async () => {
            const modifiedDiagram = {
                ...baseDiagram,
                devices: {
                    ...baseDiagram.devices,
                    servers: [
                        ...baseDiagram.devices.servers,
                        { id: 'server-03', type: 'compute', connections: 2 }
                    ]
                }
            };
            mockFGD.fabricExists.mockResolvedValue(true);
            mockFGD.loadFGD.mockResolvedValue({
                success: true,
                diagram: baseDiagram,
                filesRead: ['switches.yaml', 'servers.yaml', 'connections.yaml']
            });
            const result = await detectDrift('test-fabric', modifiedDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.driftSummary.some(s => s.includes('endpoints: 1 added'))).toBe(true);
        });
        it('should handle errors gracefully', async () => {
            mockFGD.fabricExists.mockResolvedValue(true);
            mockFGD.loadFGD.mockResolvedValue({
                success: false,
                error: 'File not found'
            });
            const result = await detectDrift('test-fabric', baseDiagram);
            expect(result.hasDrift).toBe(false);
            expect(result.driftSummary.some(s => s.includes('Error detecting drift'))).toBe(true);
        });
    });
    describe('generateDriftReport', () => {
        it('should detect added devices', () => {
            const modifiedDiagram = {
                ...baseDiagram,
                devices: {
                    ...baseDiagram.devices,
                    leaves: [
                        ...baseDiagram.devices.leaves,
                        { id: 'leaf-03', model: 'DS2000', ports: 48 }
                    ]
                }
            };
            const result = generateDriftReport(modifiedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'added',
                category: 'switch',
                itemId: 'leaf-03'
            });
        });
        it('should detect removed devices', () => {
            const reducedDiagram = {
                ...baseDiagram,
                devices: {
                    ...baseDiagram.devices,
                    servers: [baseDiagram.devices.servers[0]] // Remove server-02
                }
            };
            const result = generateDriftReport(reducedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'removed',
                category: 'endpoint',
                itemId: 'server-02'
            });
        });
        it('should detect modified devices', () => {
            const modifiedDiagram = {
                ...baseDiagram,
                devices: {
                    ...baseDiagram.devices,
                    servers: [
                        { ...baseDiagram.devices.servers[0], connections: 4 }, // Changed connections
                        baseDiagram.devices.servers[1]
                    ]
                }
            };
            const result = generateDriftReport(modifiedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'modified',
                category: 'endpoint',
                itemId: 'server-01'
            });
        });
        it('should detect added connections', () => {
            const modifiedDiagram = {
                ...baseDiagram,
                connections: [
                    ...baseDiagram.connections,
                    {
                        from: { device: 'server-02', port: 'eth0' },
                        to: { device: 'leaf-02', port: 'eth1' },
                        type: 'endpoint'
                    }
                ]
            };
            const result = generateDriftReport(modifiedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'added',
                category: 'connection'
            });
        });
        it('should detect removed connections', () => {
            const reducedDiagram = {
                ...baseDiagram,
                connections: [baseDiagram.connections[0]] // Remove second connection
            };
            const result = generateDriftReport(reducedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'removed',
                category: 'connection'
            });
        });
        it('should detect modified connections', () => {
            const modifiedDiagram = {
                ...baseDiagram,
                connections: [
                    {
                        ...baseDiagram.connections[0],
                        type: 'downlink' // Changed type
                    },
                    baseDiagram.connections[1]
                ]
            };
            const result = generateDriftReport(modifiedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0]).toMatchObject({
                type: 'modified',
                category: 'connection'
            });
        });
        it('should categorize changes correctly in summary', () => {
            const complexModifiedDiagram = {
                ...baseDiagram,
                devices: {
                    spines: [...baseDiagram.devices.spines], // No change
                    leaves: [
                        ...baseDiagram.devices.leaves,
                        { id: 'leaf-03', model: 'DS2000', ports: 48 } // Added
                    ],
                    servers: [
                        { ...baseDiagram.devices.servers[0], connections: 4 }, // Modified
                        // server-02 removed
                    ]
                },
                connections: [
                    ...baseDiagram.connections,
                    {
                        from: { device: 'leaf-03', port: 'eth47' },
                        to: { device: 'spine-01', port: 'eth2' },
                        type: 'uplink'
                    }
                ]
            };
            const result = generateDriftReport(complexModifiedDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            expect(result.summary.categories.switches.added).toBe(1);
            expect(result.summary.categories.switches.removed).toBe(0);
            expect(result.summary.categories.switches.modified).toBe(0);
            expect(result.summary.categories.endpoints.added).toBe(0);
            expect(result.summary.categories.endpoints.removed).toBe(1);
            expect(result.summary.categories.endpoints.modified).toBe(1);
            expect(result.summary.categories.connections.added).toBe(1);
            expect(result.summary.categories.connections.removed).toBe(0);
            expect(result.summary.categories.connections.modified).toBe(0);
        });
        it('should return no drift for identical diagrams', () => {
            const result = generateDriftReport(baseDiagram, baseDiagram);
            expect(result.hasDrift).toBe(false);
            expect(result.changes).toHaveLength(0);
            expect(result.summary.hasDrift).toBe(false);
        });
        it('should include performance metrics', () => {
            const result = generateDriftReport(baseDiagram, baseDiagram);
            expect(result.performanceMetrics).toBeDefined();
            expect(result.performanceMetrics.comparisonTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.memoryDiagramSize).toBeGreaterThan(0);
            expect(result.performanceMetrics.diskFilesTotalSize).toBeGreaterThan(0);
        });
    });
    describe('Edge cases and error handling', () => {
        it('should handle empty diagrams', () => {
            const emptyDiagram = {
                devices: { spines: [], leaves: [], servers: [] },
                connections: [],
                metadata: {
                    generatedAt: new Date(),
                    fabricName: 'empty',
                    totalDevices: 0
                }
            };
            const result = generateDriftReport(emptyDiagram, baseDiagram);
            expect(result.hasDrift).toBe(true);
            // Should detect removal of all devices and connections
            expect(result.changes.filter(c => c.type === 'removed').length).toBeGreaterThan(0);
        });
        it('should handle large topology differences efficiently', () => {
            const largeDiagram = {
                devices: {
                    spines: Array.from({ length: 10 }, (_, i) => ({
                        id: `spine-${i.toString().padStart(2, '0')}`,
                        model: 'DS3000',
                        ports: 64
                    })),
                    leaves: Array.from({ length: 100 }, (_, i) => ({
                        id: `leaf-${i.toString().padStart(3, '0')}`,
                        model: 'DS2000',
                        ports: 48
                    })),
                    servers: Array.from({ length: 1000 }, (_, i) => ({
                        id: `server-${i.toString().padStart(4, '0')}`,
                        type: 'compute',
                        connections: 2
                    }))
                },
                connections: [],
                metadata: {
                    generatedAt: new Date(),
                    fabricName: 'large-fabric',
                    totalDevices: 1110
                }
            };
            const startTime = Date.now();
            const result = generateDriftReport(largeDiagram, baseDiagram);
            const duration = Date.now() - startTime;
            expect(result.hasDrift).toBe(true);
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
            expect(result.performanceMetrics.comparisonTimeMs).toBeGreaterThan(0);
        });
    });
});
