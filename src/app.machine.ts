import { createMachine, assign, fromPromise } from 'xstate'
import { FabricDesignContext, FabricDesignEvent, FabricSpecSchema, generateWiringStub } from './app.state'
import { computeDerived } from './domain/topology'

export const fabricDesignMachine = createMachine({
  id: 'fabricDesign',
  initial: 'configuring',
  context: {
    config: {},
    computedTopology: null,
    errors: [],
    savedToFgd: false
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
            savedToFgd: false
          })
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
            savedToFgd: false
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
            savedToFgd: false
          })
        }
      }
    },
    saving: {
      invoke: {
        id: 'saveFgd',
        src: fromPromise(async ({ input }: { input: { context: FabricDesignContext } }) => {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate FGD save
          if (!input.context.computedTopology?.isValid) {
            throw new Error('Invalid topology cannot be saved')
          }
          const config = FabricSpecSchema.parse(input.context.config)
          const wiringDiagram = generateWiringStub(config, input.context.computedTopology)
          return { success: true, fgdId: `fgd-${Date.now()}`, wiringDiagram }
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
            savedToFgd: false
          })
        }
      }
    }
  }
})