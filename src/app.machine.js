import { createMachine, assign, fromPromise } from 'xstate';
import { FabricSpecSchema, generateWiringStub } from './app.state.js';
import { computeDerived } from './domain/topology.js';
import { saveFGD, loadFGD } from './io/fgd.js';
import { isValidConfig, canSaveTopology } from './app.guards.js';
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
                        actions: assign({ 
                            computedTopology: ({ context }) => {
                                try {
                                    console.log('COMPUTE_TOPOLOGY: Guard passed, computing topology');
                                    console.log('COMPUTE_TOPOLOGY: Config:', JSON.stringify(context.config, null, 2));
                                    const result = computeDerived(context.config);
                                    console.log('COMPUTE_TOPOLOGY: Result:', JSON.stringify(result, null, 2));
                                    console.log('COMPUTE_TOPOLOGY: Transitioning to computed state');
                                    return result;
                                } catch (error) {
                                    console.error('COMPUTE_TOPOLOGY: computeDerived failed:', error);
                                    return null;
                                }
                            }, 
                            errors: [] 
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
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, errors: [], savedToFgd: false, loadedDiagram: null }) },
                LOAD_FROM_FGD: { target: 'loading' }
            }
        },
        computed: {
            on: {
                UPDATE_CONFIG: { target: 'configuring', actions: assign({ config: ({ context, event }) => ({ ...context.config, ...event.data }), computedTopology: null, errors: [] }) },
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
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        },
        invalid: {
            on: {
                UPDATE_CONFIG: { target: 'configuring', actions: assign({ config: ({ context, event }) => ({ ...context.config, ...event.data }), computedTopology: null, errors: [] }) },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
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
                        errors: [],
                        savedToFgd: false
                    })
                },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        },
        loaded: {
            on: {
                UPDATE_CONFIG: {
                    target: 'configuring',
                    actions: assign({
                        config: ({ context, event }) => ({ ...context.config, ...event.data }),
                        computedTopology: null,
                        errors: [],
                        savedToFgd: false,
                        loadedDiagram: null
                    })
                },
                LOAD_FROM_FGD: { target: 'loading' },
                RESET: { target: 'configuring', actions: assign({ config: {}, computedTopology: null, errors: [], savedToFgd: false, loadedDiagram: null }) }
            }
        }
    }
});
