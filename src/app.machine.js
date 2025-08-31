import { createMachine, assign, fromPromise } from 'xstate';
import { FabricSpecSchema, generateWiringStub } from './app.state.js';
import { computeDerived } from './domain/topology.js';
import { allocateUplinks } from './domain/allocator.js';
import { saveFGD, loadFGD } from './io/fgd.js';
import { isValidConfig, canSaveTopology } from './app.guards.js';

// Load switch profiles from fixtures
const loadSwitchProfiles = () => {
  try {
    // Import switch profiles as modules since we're in a browser environment
    // For now, return hardcoded profiles based on the fixtures
    const ds2000Profile = {
      modelId: 'celestica-ds2000',
      roles: ['leaf'],
      ports: {
        endpointAssignable: ['E1/1-48'],
        fabricAssignable: ['E1/49-56']
      },
      profiles: {
        endpoint: { portProfile: 'SFP28-25G', speedGbps: 25 },
        uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 }
      },
      meta: { source: 'switch_profile.go', version: 'v0.3.0' }
    };
    
    const ds3000Profile = {
      modelId: 'celestica-ds3000',
      roles: ['spine'],
      ports: {
        endpointAssignable: [],
        fabricAssignable: ['E1/1-32']
      },
      profiles: {
        endpoint: { portProfile: null, speedGbps: 0 },
        uplink: { portProfile: 'QSFP28-100G', speedGbps: 100 }
      },
      meta: { source: 'switch_profile.go', version: 'v0.3.0' }
    };
    
    return {
      'DS2000': ds2000Profile,
      'DS3000': ds3000Profile
    };
  } catch (error) {
    console.error('Failed to load switch profiles:', error);
    return null;
  }
};
export const fabricDesignMachine = createMachine({
    id: 'fabricDesign',
    initial: 'configuring',
    context: {
        config: {
            name: '',
            spineModelId: 'DS3000',
            leafModelId: 'DS2000', 
            uplinksPerLeaf: 2,
            endpointProfile: { name: 'Standard Server', portsPerEndpoint: 2 },
            endpointCount: 48
        },
        computedTopology: null,
        allocationResult: null,
        switchProfiles: null,
        errors: [],
        savedToFgd: false,
        loadedDiagram: null
    },
    states: {
        configuring: {
            on: {
                UPDATE_CONFIG: { actions: assign({ config: ({ context, event }) => ({ ...context.config, ...event.data }), errors: [] }) },
                COMPUTE_TOPOLOGY: [
                    {
                        guard: isValidConfig,
                        target: 'computed',
                        actions: assign(({ context }) => {
                            try {
                                console.log('COMPUTE_TOPOLOGY: Guard passed, computing topology');
                                console.log('COMPUTE_TOPOLOGY: Config:', JSON.stringify(context.config, null, 2));
                                
                                // Compute derived topology
                                const computedTopology = computeDerived(context.config);
                                console.log('COMPUTE_TOPOLOGY: Topology result:', JSON.stringify(computedTopology, null, 2));
                                
                                // Load switch profiles
                                const switchProfiles = loadSwitchProfiles();
                                
                                let allocationResult = null;
                                const errors = [];
                                
                                if (switchProfiles && computedTopology?.isValid) {
                                    try {
                                        // Get profiles for the configured models
                                        const leafProfile = switchProfiles[context.config.leafModelId || 'DS2000'];
                                        const spineProfile = switchProfiles[context.config.spineModelId || 'DS3000'];
                                        
                                        if (!leafProfile) {
                                            errors.push(`Leaf profile not found: ${context.config.leafModelId || 'DS2000'}`);
                                        } else if (!spineProfile) {
                                            errors.push(`Spine profile not found: ${context.config.spineModelId || 'DS3000'}`);
                                        } else {
                                            // Create allocation spec
                                            const allocationSpec = {
                                                uplinksPerLeaf: context.config.uplinksPerLeaf || 2,
                                                leavesNeeded: computedTopology.leavesNeeded,
                                                spinesNeeded: computedTopology.spinesNeeded,
                                                endpointCount: context.config.endpointCount || 48
                                            };
                                            
                                            // Perform allocation
                                            allocationResult = allocateUplinks(allocationSpec, leafProfile, spineProfile);
                                            console.log('COMPUTE_TOPOLOGY: Allocation result:', JSON.stringify(allocationResult, null, 2));
                                            
                                            // Add allocation issues to errors if any
                                            if (allocationResult.issues && allocationResult.issues.length > 0) {
                                                errors.push(...allocationResult.issues);
                                            }
                                        }
                                    } catch (allocationError) {
                                        console.error('COMPUTE_TOPOLOGY: Allocation failed:', allocationError);
                                        errors.push(`Port allocation failed: ${allocationError.message}`);
                                    }
                                } else if (!switchProfiles) {
                                    errors.push('Failed to load switch profiles');
                                }
                                
                                console.log('COMPUTE_TOPOLOGY: Transitioning to computed state');
                                return {
                                    computedTopology,
                                    allocationResult,
                                    switchProfiles: switchProfiles ? {
                                        leaf: switchProfiles[context.config.leafModelId || 'DS2000'],
                                        spine: switchProfiles[context.config.spineModelId || 'DS3000']
                                    } : null,
                                    errors
                                };
                            } catch (error) {
                                console.error('COMPUTE_TOPOLOGY: computeDerived failed:', error);
                                return {
                                    computedTopology: null,
                                    allocationResult: null,
                                    switchProfiles: null,
                                    errors: [`Computation failed: ${error.message}`]
                                };
                            }
                        })
                    },
                    {
                        target: 'invalid',
                        actions: assign({
                            errors: ({ context }) => {
                                console.log('COMPUTE_TOPOLOGY: Guard failed, going to invalid state');
                                // Just check uplinks directly without schema parsing
                                if (context.config && context.config.uplinksPerLeaf % 2 !== 0) {
                                    return ['Uplinks per leaf must be even for proper distribution'];
                                }
                                return ['Invalid configuration'];
                            }
                        })
                    }
                ],
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, allocationResult: null, switchProfiles: null, errors: [], savedToFgd: false, loadedDiagram: null }) },
                LOAD_FROM_FGD: { target: 'loading' }
            }
        },
        computed: {
            on: {
                UPDATE_CONFIG: { target: 'configuring', actions: assign({ config: ({ context, event }) => ({ ...context.config, ...event.data }), computedTopology: null, allocationResult: null, switchProfiles: null, errors: [] }) },
                SAVE_TO_FGD: [
                    { guard: canSaveTopology, target: 'saving', actions: assign({ errors: [] }) },
                    {
                        target: 'invalid',
                        actions: assign({
                            errors: ({ context }) => {
                                const t = context.computedTopology;
                                if (!t)
                                    return ['No topology computed'];
                                if (!t.isValid)
                                    return t.validationErrors;
                                const errors = [];
                                if (t.oversubscriptionRatio > 4.0)
                                    errors.push(`Oversubscription too high: ${t.oversubscriptionRatio.toFixed(2)}:1`);
                                if (t.leavesNeeded === 0)
                                    errors.push('No leaves computed');
                                if (t.spinesNeeded === 0)
                                    errors.push('No spines computed');
                                return errors.length > 0 ? errors : ['Cannot save invalid topology'];
                            }
                        })
                    }
                ],
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, allocationResult: null, switchProfiles: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        },
        invalid: {
            on: {
                UPDATE_CONFIG: { target: 'configuring', actions: assign({ config: ({ context, event }) => ({ ...context.config, ...event.data }), computedTopology: null, allocationResult: null, switchProfiles: null, errors: [] }) },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, allocationResult: null, switchProfiles: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        },
        loading: {
            invoke: {
                id: 'loadFgd',
                src: fromPromise(async ({ input }) => {
                    const result = await loadFGD({ fabricId: input.fabricId });
                    if (!result.success)
                        throw new Error(result.error || 'Failed to load from FGD');
                    return { success: true, diagram: result.diagram };
                }),
                input: ({ event }) => ({ fabricId: event.fabricId }),
                onDone: {
                    target: 'loaded',
                    actions: assign({
                        loadedDiagram: ({ event }) => event.output.diagram,
                        errors: []
                    })
                },
                onError: {
                    target: 'configuring',
                    actions: assign({
                        errors: ({ event }) => [`Failed to load from FGD: ${event.error?.message || 'Unknown error'}`]
                    })
                }
            }
        },
        saving: {
            invoke: {
                id: 'saveFgd',
                src: fromPromise(async ({ input }) => {
                    if (!input.context.computedTopology?.isValid)
                        throw new Error('Invalid topology cannot be saved');
                    const config = input.context.config;
                    const wiringDiagram = generateWiringStub(config, input.context.computedTopology);
                    const result = await saveFGD(wiringDiagram, { fabricId: config.name || `fabric-${Date.now()}` });
                    if (!result.success)
                        throw new Error(result.error || 'Failed to save to FGD');
                    return { success: true, fgdId: result.fgdId, wiringDiagram };
                }),
                input: ({ context }) => ({ context }),
                onDone: { target: 'saved', actions: assign({ savedToFgd: true, errors: [] }) },
                onError: {
                    target: 'computed',
                    actions: assign({
                        errors: ({ event }) => [`Failed to save to FGD: ${event.error?.message || 'Unknown error'}`]
                    })
                }
            }
        },
        saved: {
            on: {
                UPDATE_CONFIG: {
                    target: 'configuring',
                    actions: assign({
                        config: ({ context, event }) => ({ ...context.config, ...event.data }),
                        computedTopology: null,
                        allocationResult: null,
                        switchProfiles: null,
                        errors: [],
                        savedToFgd: false
                    })
                },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, allocationResult: null, switchProfiles: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        },
        loaded: {
            on: {
                UPDATE_CONFIG: {
                    target: 'configuring',
                    actions: assign({
                        config: ({ context, event }) => ({ ...context.config, ...event.data }),
                        computedTopology: null,
                        allocationResult: null,
                        switchProfiles: null,
                        errors: [],
                        savedToFgd: false,
                        loadedDiagram: null
                    })
                },
                LOAD_FROM_FGD: { target: 'loading' },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, allocationResult: null, switchProfiles: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        }
    }
});
