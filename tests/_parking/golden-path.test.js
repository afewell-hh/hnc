// TODO: This test is quarantined - Golden path integration tests (JS version) are timing out
// These are complex end-to-end tests that require state machine timing fixes for v0.4.1
// The tests exercise the full workflow but need better async handling

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { createActor } from 'xstate';
import { fabricDesignMachine } from '../../src/app.machine';
import { loadFGD } from '../../src/io/fgd';
const TEST_BASE_DIR = './test-golden-path-fgd';
// Golden path test specification
const goldenPathSpec = {
    name: 'golden-path-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 8, // Even number as required, more uplinks for better ratio
    endpointProfile: {
        name: 'compute-standard',
        portsPerEndpoint: 2
    },
    endpointCount: 24 // Reduced for better oversubscription ratio (24/8 = 3:1)
};
describe('Golden Path: Compute → Save → Reload', () => {
    beforeEach(async () => {
        // Clean up any existing test directory
        try {
            await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
        }
        catch {
            // Directory may not exist, ignore
        }
    });
    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
        }
        catch {
            // Directory may not exist, ignore
        }
    });
    it('should complete full compute→save→reload workflow successfully', async () => {
        // STEP 1: Configure and compute topology
        const actor = createActor(fabricDesignMachine);
        actor.start();
        // Initial state should be configuring
        expect(actor.getSnapshot().value).toBe('configuring');
        // Update configuration
        actor.send({ type: 'UPDATE_CONFIG', data: goldenPathSpec });
        // Compute topology
        actor.send({ type: 'COMPUTE_TOPOLOGY' });
        // Wait for computation to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        const computedSnapshot = actor.getSnapshot();
        expect(computedSnapshot.value).toBe('computed');
        expect(computedSnapshot.context.computedTopology).toBeDefined();
        expect(computedSnapshot.context.computedTopology?.isValid).toBe(true);
        // Verify computed values make sense
        const topology = computedSnapshot.context.computedTopology;
        expect(topology.leavesNeeded).toBeGreaterThan(0);
        expect(topology.spinesNeeded).toBeGreaterThan(0);
        expect(topology.oversubscriptionRatio).toBeLessThanOrEqual(4.0);
        console.log('✓ Topology computed successfully:', {
            leaves: topology.leavesNeeded,
            spines: topology.spinesNeeded,
            oversubscription: topology.oversubscriptionRatio.toFixed(2) + ':1'
        });
        // STEP 2: Save to FGD
        actor.send({ type: 'SAVE_TO_FGD' });
        // Wait for save to complete
        await new Promise(resolve => {
            const checkSaved = () => {
                const snapshot = actor.getSnapshot();
                if (snapshot.value === 'saved') {
                    resolve(null);
                }
                else if (snapshot.value === 'invalid') {
                    throw new Error(`Save failed: ${snapshot.context.errors.join(', ')}`);
                }
                else {
                    setTimeout(checkSaved, 100);
                }
            };
            checkSaved();
        });
        const savedSnapshot = actor.getSnapshot();
        expect(savedSnapshot.value).toBe('saved');
        expect(savedSnapshot.context.savedToFgd).toBe(true);
        expect(savedSnapshot.context.errors).toHaveLength(0);
        console.log('✓ Wiring diagram saved to FGD successfully');
        // STEP 3: Verify files were created
        const fabricPath = `./fgd/${goldenPathSpec.name}`;
        const expectedFiles = ['servers.yaml', 'switches.yaml', 'connections.yaml'];
        for (const filename of expectedFiles) {
            const filepath = `${fabricPath}/${filename}`;
            await expect(fs.access(filepath)).resolves.toBeUndefined();
            // Verify file has content
            const content = await fs.readFile(filepath, 'utf8');
            expect(content.length).toBeGreaterThan(10);
            expect(content).toMatch(/^[a-zA-Z_]/m); // Starts with valid YAML
        }
        console.log('✓ All FGD files created with valid content');
        // STEP 4: Load from FGD using direct file operations
        const loadResult = await loadFGD({
            fabricId: goldenPathSpec.name,
            baseDir: './fgd'
        });
        expect(loadResult.success).toBe(true);
        expect(loadResult.diagram).toBeDefined();
        const loadedDiagram = loadResult.diagram;
        // Verify loaded diagram structure
        expect(loadedDiagram.devices.spines.length).toBe(topology.spinesNeeded);
        expect(loadedDiagram.devices.leaves.length).toBe(topology.leavesNeeded);
        expect(loadedDiagram.devices.servers.length).toBe(goldenPathSpec.endpointCount);
        expect(loadedDiagram.connections.length).toBeGreaterThan(0);
        // Verify metadata
        expect(loadedDiagram.metadata.fabricName).toBe(goldenPathSpec.name);
        expect(loadedDiagram.metadata.totalDevices).toBe(topology.spinesNeeded + topology.leavesNeeded + goldenPathSpec.endpointCount);
        console.log('✓ Wiring diagram loaded successfully from FGD:', {
            spines: loadedDiagram.devices.spines.length,
            leaves: loadedDiagram.devices.leaves.length,
            servers: loadedDiagram.devices.servers.length,
            connections: loadedDiagram.connections.length,
            totalDevices: loadedDiagram.metadata.totalDevices
        });
        // STEP 5: Test state machine LOAD action
        const newActor = createActor(fabricDesignMachine);
        newActor.start();
        // Load from FGD through state machine
        newActor.send({ type: 'LOAD_FROM_FGD', fabricId: goldenPathSpec.name });
        // Wait for load to complete
        await new Promise(resolve => {
            const checkLoaded = () => {
                const snapshot = newActor.getSnapshot();
                if (snapshot.value === 'loaded') {
                    resolve(null);
                }
                else if (snapshot.value === 'configuring' && snapshot.context.errors.length > 0) {
                    throw new Error(`Load failed: ${snapshot.context.errors.join(', ')}`);
                }
                else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
        const loadedSnapshot = newActor.getSnapshot();
        expect(loadedSnapshot.value).toBe('loaded');
        expect(loadedSnapshot.context.loadedDiagram).toBeDefined();
        expect(loadedSnapshot.context.errors).toHaveLength(0);
        const stateMachineLoadedDiagram = loadedSnapshot.context.loadedDiagram;
        // Verify state machine loaded diagram matches direct load
        expect(stateMachineLoadedDiagram.devices.spines).toEqual(loadedDiagram.devices.spines);
        expect(stateMachineLoadedDiagram.devices.leaves).toEqual(loadedDiagram.devices.leaves);
        expect(stateMachineLoadedDiagram.devices.servers).toEqual(loadedDiagram.devices.servers);
        expect(stateMachineLoadedDiagram.connections).toEqual(loadedDiagram.connections);
        expect(stateMachineLoadedDiagram.metadata.fabricName).toBe(loadedDiagram.metadata.fabricName);
        console.log('✓ State machine LOAD action works correctly');
        // STEP 6: Verify data integrity through complete cycle
        // Compare original computed topology with what we can derive from loaded diagram
        expect(stateMachineLoadedDiagram.devices.spines.length).toBe(topology.spinesNeeded);
        expect(stateMachineLoadedDiagram.devices.leaves.length).toBe(topology.leavesNeeded);
        expect(stateMachineLoadedDiagram.devices.servers.length).toBe(goldenPathSpec.endpointCount);
        // Verify device models are preserved
        stateMachineLoadedDiagram.devices.spines.forEach(spine => {
            expect(spine.model).toBe(goldenPathSpec.spineModelId);
            expect(spine.ports).toBe(32); // DS3000 default
        });
        stateMachineLoadedDiagram.devices.leaves.forEach(leaf => {
            expect(leaf.model).toBe(goldenPathSpec.leafModelId);
            expect(leaf.ports).toBe(48); // DS2000 default
        });
        stateMachineLoadedDiagram.devices.servers.forEach(server => {
            expect(server.type).toBe(goldenPathSpec.endpointProfile.name);
            expect(server.connections).toBe(goldenPathSpec.endpointProfile.portsPerEndpoint);
        });
        // Verify connection topology
        const uplinkConnections = stateMachineLoadedDiagram.connections.filter(c => c.type === 'uplink');
        const expectedUplinks = topology.leavesNeeded * goldenPathSpec.uplinksPerLeaf;
        expect(uplinkConnections.length).toBe(expectedUplinks);
        console.log('✓ Data integrity preserved through complete cycle');
        // Clean up actors
        actor.stop();
        newActor.stop();
    });
    it('should handle invalid configurations gracefully', async () => {
        const invalidSpec = {
            name: 'invalid-fabric',
            spineModelId: 'DS3000',
            leafModelId: 'DS2000',
            uplinksPerLeaf: 3, // Invalid: odd number
            endpointProfile: {
                name: 'compute',
                portsPerEndpoint: 2
            },
            endpointCount: 10
        };
        const actor = createActor(fabricDesignMachine);
        actor.start();
        actor.send({ type: 'UPDATE_CONFIG', data: invalidSpec });
        actor.send({ type: 'COMPUTE_TOPOLOGY' });
        await new Promise(resolve => setTimeout(resolve, 100));
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('invalid');
        expect(snapshot.context.errors.length).toBeGreaterThan(0);
        expect(snapshot.context.errors.some(e => e.includes('even'))).toBe(true);
        console.log('✓ Invalid configuration handled correctly:', snapshot.context.errors);
        actor.stop();
    });
    it('should handle load failures gracefully', async () => {
        const actor = createActor(fabricDesignMachine);
        actor.start();
        // Try to load non-existent fabric
        actor.send({ type: 'LOAD_FROM_FGD', fabricId: 'non-existent-fabric' });
        // Wait for load to fail and return to configuring state
        await new Promise(resolve => {
            const checkFailed = () => {
                const snapshot = actor.getSnapshot();
                if (snapshot.value === 'configuring' && snapshot.context.errors.length > 0) {
                    resolve(null);
                }
                else if (snapshot.value === 'loaded') {
                    throw new Error('Load should have failed but succeeded');
                }
                else {
                    setTimeout(checkFailed, 100);
                }
            };
            checkFailed();
        });
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('configuring');
        expect(snapshot.context.errors.length).toBeGreaterThan(0);
        expect(snapshot.context.errors.some(e => e.includes('Failed to load from FGD'))).toBe(true);
        expect(snapshot.context.loadedDiagram).toBeNull();
        console.log('✓ Load failure handled correctly:', snapshot.context.errors);
        actor.stop();
    });
    it('should maintain state machine behavior after load', async () => {
        // First create and save a fabric
        const actor1 = createActor(fabricDesignMachine);
        actor1.start();
        actor1.send({ type: 'UPDATE_CONFIG', data: goldenPathSpec });
        actor1.send({ type: 'COMPUTE_TOPOLOGY' });
        await new Promise(resolve => setTimeout(resolve, 100));
        actor1.send({ type: 'SAVE_TO_FGD' });
        await new Promise(resolve => {
            const checkSaved = () => {
                if (actor1.getSnapshot().value === 'saved') {
                    resolve(null);
                }
                else {
                    setTimeout(checkSaved, 100);
                }
            };
            checkSaved();
        });
        actor1.stop();
        // Now load it in a new state machine and test state transitions
        const actor2 = createActor(fabricDesignMachine);
        actor2.start();
        actor2.send({ type: 'LOAD_FROM_FGD', fabricId: goldenPathSpec.name });
        await new Promise(resolve => {
            const checkLoaded = () => {
                if (actor2.getSnapshot().value === 'loaded') {
                    resolve(null);
                }
                else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
        expect(actor2.getSnapshot().value).toBe('loaded');
        // Test state transitions from loaded state
        actor2.send({ type: 'UPDATE_CONFIG', data: { endpointCount: 64 } });
        expect(actor2.getSnapshot().value).toBe('configuring');
        expect(actor2.getSnapshot().context.loadedDiagram).toBeNull();
        // Reset and load again
        actor2.send({ type: 'RESET' });
        expect(actor2.getSnapshot().value).toBe('configuring');
        actor2.send({ type: 'LOAD_FROM_FGD', fabricId: goldenPathSpec.name });
        await new Promise(resolve => {
            const checkLoaded = () => {
                if (actor2.getSnapshot().value === 'loaded') {
                    resolve(null);
                }
                else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
        // Test RESET from loaded state
        actor2.send({ type: 'RESET' });
        const resetSnapshot = actor2.getSnapshot();
        expect(resetSnapshot.value).toBe('configuring');
        expect(resetSnapshot.context.loadedDiagram).toBeNull();
        expect(resetSnapshot.context.config).toEqual({});
        console.log('✓ State machine behavior maintained correctly after load operations');
        actor2.stop();
    });
});
