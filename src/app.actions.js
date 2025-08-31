import { assign } from 'xstate';
import { FabricSpecSchema } from './app.state.js';
import { computeDerived } from './domain/topology.js';
export const updateConfig = assign({
    config: ({ context, event }) => ({ ...context.config, ...event.data }),
    errors: []
});
export const computeTopology = assign({
    computedTopology: ({ context }) => computeDerived(FabricSpecSchema.parse(context.config)),
    errors: []
});
export const setComputationErrors = assign({
    errors: ({ context }) => {
        try {
            const config = FabricSpecSchema.parse(context.config);
            return config.uplinksPerLeaf % 2 !== 0 ? ['Uplinks per leaf must be even'] : ['Invalid configuration'];
        }
        catch (error) {
            const errors = error.errors?.map((e) => e.message) || ['Invalid configuration'];
            if (context.config && context.config.uplinksPerLeaf % 2 !== 0) {
                errors.push('Uplinks per leaf must be even for proper distribution');
            }
            return errors;
        }
    }
});
export const setSaveErrors = assign({
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
});
export const resetState = assign({
    config: {},
    computedTopology: null,
    errors: [],
    savedToFgd: false,
    loadedDiagram: null
});
export const resetToConfiguring = assign({
    config: ({ context, event }) => ({ ...context.config, ...event.data }),
    computedTopology: null,
    errors: []
});
export const resetToConfiguringFromSaved = assign({
    config: ({ context, event }) => ({ ...context.config, ...event.data }),
    computedTopology: null,
    errors: [],
    savedToFgd: false,
    loadedDiagram: null
});
export const clearErrors = assign({ errors: [] });
export const setSavedState = assign({ savedToFgd: true, errors: [] });
export const setLoadedDiagram = assign({
    loadedDiagram: ({ event }) => event.output.diagram,
    errors: []
});
export const setLoadError = assign({
    errors: ({ event }) => [`Failed to load from FGD: ${event.error?.message || 'Unknown error'}`]
});
export const setSaveError = assign({
    errors: ({ event }) => [`Failed to save to FGD: ${event.error?.message || 'Unknown error'}`]
});
