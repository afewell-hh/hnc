import { createMachine, assign, fromPromise } from 'xstate'
import { FabricDesignContext, FabricDesignEvent, FabricSpecSchema, generateWiringStub } from './app.state.js'
import { computeDerived } from './domain/topology.js'
import { saveFGD, loadFGD } from './io/fgd.js'

export const fabricDesignMachine = createMachine({
  id: 'fabricDesign',
  initial: 'configuring',
  context: {
    config: {},
    computedTopology: null,
    errors: [],
    savedToFgd: false,
    loadedDiagram: null
  } as FabricDesignContext,
  states: {
    configuring: {
      on: {
        UPDATE_CONFIG: {
          actions: assign({
            config: ({ context, event }) => ({ ...context.config, ...event.data }),
            errors: []
          })
        },
        COMPUTE_TOPOLOGY: [
          {
            guard: ({ context }) => {
              try {
                const config = FabricSpecSchema.parse(context.config)
                return config.uplinksPerLeaf % 2 === 0 // Critical: even uplinks only
              } catch { 
                return false 
              }
            },
            target: 'computed',
            actions: assign({ computedTopology: ({ context }) => computeDerived(FabricSpecSchema.parse(context.config)), errors: [] })
          },
          {
            target: 'invalid',
            actions: assign({
              errors: ({ context }) => {
                try {
                  const config = FabricSpecSchema.parse(context.config)
                  return config.uplinksPerLeaf % 2 !== 0 ? ['Uplinks per leaf must be even'] : ['Invalid configuration']
                } catch (error: any) {
                  const errors = error.errors?.map((e: any) => e.message) || ['Invalid configuration']
                  if (context.config && (context.config as any).uplinksPerLeaf % 2 !== 0) {
                    errors.push('Uplinks per leaf must be even for proper distribution')
                  }
                  return errors
                }
              }
            })
          }
        ],
        RESET: {
          target: 'configuring',
          actions: assign({
            config: {},
            computedTopology: null,
            errors: [],
            savedToFgd: false,
            loadedDiagram: null
          })
        },
        LOAD_FROM_FGD: {
          target: 'loading'
        }
      }
    },
    computed: {
      on: {
        UPDATE_CONFIG: {
          target: 'configuring',
          actions: assign({
            config: ({ context, event }) => ({ ...context.config, ...event.data }),
            computedTopology: null,
            errors: []
          })
        },
        SAVE_TO_FGD: [
          {
            guard: ({ context }) => {
              const t = context.computedTopology
              return Boolean(t?.isValid && t.leavesNeeded > 0 && t.spinesNeeded > 0 && t.oversubscriptionRatio <= 4.0)
            },
            target: 'saving', actions: assign({ errors: [] })
          },
          {
            target: 'invalid',
            actions: assign({
              errors: ({ context }) => {
                const t = context.computedTopology
                if (!t) return ['No topology computed']
                if (!t.isValid) return t.validationErrors
                const errors: string[] = []
                if (t.oversubscriptionRatio > 4.0) errors.push(`Oversubscription too high: ${t.oversubscriptionRatio.toFixed(2)}:1`)
                if (t.leavesNeeded === 0) errors.push('No leaves computed')
                if (t.spinesNeeded === 0) errors.push('No spines computed')
                return errors.length > 0 ? errors : ['Cannot save invalid topology']
              }
            })
          }
        ],
        RESET: {
          target: 'configuring',
          actions: assign({
            config: {},
            computedTopology: null,
            errors: [],
            savedToFgd: false,
            loadedDiagram: null
          })
        }
      }
    },
    invalid: {
      on: {
        UPDATE_CONFIG: {
          target: 'configuring',
          actions: assign({
            config: ({ context, event }) => ({ ...context.config, ...event.data }),
            computedTopology: null,
            errors: []
          })
        },
        RESET: {
          target: 'configuring',
          actions: assign({
            config: {},
            computedTopology: null,
            errors: [],
            savedToFgd: false,
            loadedDiagram: null
          })
        }
      }
    },
    loading: {
      invoke: {
        id: 'loadFgd',
        src: fromPromise(async ({ input }: { input: { fabricId: string } }) => {
          const result = await loadFGD({ fabricId: input.fabricId })
          if (!result.success) {
            throw new Error(result.error || 'Failed to load from FGD')
          }
          return { success: true, diagram: result.diagram }
        }),
        input: ({ event }) => ({ fabricId: (event as any).fabricId }),
        onDone: { 
          target: 'loaded', 
          actions: assign({ 
            loadedDiagram: ({ event }) => (event as any).output.diagram,
            errors: [] 
          })
        },
        onError: { 
          target: 'configuring', 
          actions: assign({ 
            errors: ({ event }) => [`Failed to load from FGD: ${(event as any).error?.message || 'Unknown error'}`]
          })
        }
      }
    },
    saving: {
      invoke: {
        id: 'saveFgd',
        src: fromPromise(async ({ input }: { input: { context: FabricDesignContext } }) => {
          if (!input.context.computedTopology?.isValid) {
            throw new Error('Invalid topology cannot be saved')
          }
          const config = FabricSpecSchema.parse(input.context.config)
          const wiringDiagram = generateWiringStub(config, input.context.computedTopology)
          
          // Save to actual FGD files
          const result = await saveFGD(wiringDiagram, { 
            fabricId: config.name || `fabric-${Date.now()}` 
          })
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to save to FGD')
          }
          
          return { success: true, fgdId: result.fgdId, wiringDiagram }
        }),
        input: ({ context }) => ({ context }),
        onDone: { target: 'saved', actions: assign({ savedToFgd: true, errors: [] }) },
        onError: { target: 'computed', actions: assign({ 
          errors: ({ event }) => [`Failed to save to FGD: ${(event as any).error?.message || 'Unknown error'}`] }) }
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
        RESET: {
          target: 'configuring',
          actions: assign({
            config: {},
            computedTopology: null,
            errors: [],
            savedToFgd: false,
            loadedDiagram: null
          })
        }
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
        LOAD_FROM_FGD: {
          target: 'loading'
        },
        RESET: {
          target: 'configuring',
          actions: assign({
            config: {},
            computedTopology: null,
            errors: [],
            savedToFgd: false,
            loadedDiagram: null
          })
        }
      }
    }
  }
})