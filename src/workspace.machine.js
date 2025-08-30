import { createMachine, assign } from 'xstate';
let fabricIdCounter = 0;
export const workspaceMachine = createMachine({
    id: 'workspace',
    initial: 'listing',
    context: {
        fabrics: [],
        selectedFabricId: null,
        errors: []
    },
    states: {
        listing: {
            on: {
                UPDATE_FABRIC_STATUS: {
                    actions: assign({
                        fabrics: ({ context, event }) => context.fabrics.map(fabric => fabric.id === event.fabricId
                            ? { ...fabric, status: event.status, lastModified: new Date() }
                            : fabric)
                    })
                },
                CREATE_FABRIC: [
                    {
                        guard: ({ event, context }) => {
                            // Check if name is not empty and not duplicate
                            const name = event.name?.trim();
                            return Boolean(name && !context.fabrics.some(f => f.name === name));
                        },
                        actions: assign({
                            fabrics: ({ context, event }) => {
                                const newFabric = {
                                    id: `fabric-${Date.now()}-${++fabricIdCounter}`,
                                    name: event.name.trim(),
                                    status: 'draft',
                                    createdAt: new Date(),
                                    lastModified: new Date()
                                };
                                return [...context.fabrics, newFabric];
                            },
                            errors: []
                        })
                    },
                    {
                        target: 'error',
                        actions: assign({
                            errors: ({ event, context }) => {
                                if (!event.name?.trim()) {
                                    return ['Fabric name cannot be empty'];
                                }
                                if (context.fabrics.some(f => f.name === event.name.trim())) {
                                    return ['Fabric name must be unique'];
                                }
                                return ['Invalid fabric name'];
                            }
                        })
                    }
                ],
                SELECT_FABRIC: {
                    target: 'selected',
                    actions: assign({
                        selectedFabricId: ({ event }) => event.fabricId,
                        errors: []
                    })
                },
                DELETE_FABRIC: {
                    actions: assign({
                        fabrics: ({ context, event }) => context.fabrics.filter(fabric => fabric.id !== event.fabricId),
                        errors: []
                    })
                }
            }
        },
        creating: {
            on: {
                LIST_FABRICS: {
                    target: 'listing',
                    actions: assign({ errors: [] })
                }
            }
        },
        selected: {
            on: {
                BACK_TO_LIST: {
                    target: 'listing',
                    actions: assign({
                        selectedFabricId: null,
                        errors: []
                    })
                },
                UPDATE_FABRIC_STATUS: {
                    actions: assign({
                        fabrics: ({ context, event }) => context.fabrics.map(fabric => fabric.id === event.fabricId
                            ? { ...fabric, status: event.status, lastModified: new Date() }
                            : fabric)
                    })
                },
                DELETE_FABRIC: [
                    {
                        guard: ({ context, event }) => context.selectedFabricId === event.fabricId,
                        target: 'listing',
                        actions: assign({
                            fabrics: ({ context, event }) => context.fabrics.filter(fabric => fabric.id !== event.fabricId),
                            selectedFabricId: null,
                            errors: []
                        })
                    },
                    {
                        actions: assign({
                            fabrics: ({ context, event }) => context.fabrics.filter(fabric => fabric.id !== event.fabricId)
                        })
                    }
                ]
            }
        },
        error: {
            on: {
                CREATE_FABRIC: [
                    {
                        guard: ({ event, context }) => {
                            const name = event.name?.trim();
                            return Boolean(name && !context.fabrics.some(f => f.name === name));
                        },
                        target: 'listing',
                        actions: assign({
                            fabrics: ({ context, event }) => {
                                const newFabric = {
                                    id: `fabric-${Date.now()}-${++fabricIdCounter}`,
                                    name: event.name.trim(),
                                    status: 'draft',
                                    createdAt: new Date(),
                                    lastModified: new Date()
                                };
                                return [...context.fabrics, newFabric];
                            },
                            errors: []
                        })
                    },
                    {
                        actions: assign({
                            errors: ({ event, context }) => {
                                if (!event.name?.trim()) {
                                    return ['Fabric name cannot be empty'];
                                }
                                if (context.fabrics.some(f => f.name === event.name.trim())) {
                                    return ['Fabric name must be unique'];
                                }
                                return ['Invalid fabric name'];
                            }
                        })
                    }
                ],
                LIST_FABRICS: {
                    target: 'listing',
                    actions: assign({ errors: [] })
                },
                SELECT_FABRIC: {
                    target: 'selected',
                    actions: assign({
                        selectedFabricId: ({ event }) => event.fabricId,
                        errors: []
                    })
                }
            }
        }
    }
});
