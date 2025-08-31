import { fromPromise } from 'xstate';
import { FabricSpecSchema, generateWiringStub } from './app.state.js';
import { saveFGD, loadFGD } from './io/fgd.js';
export const loadFgdPromise = fromPromise(async ({ input }) => {
    const result = await loadFGD({ fabricId: input.fabricId });
    if (!result.success) {
        throw new Error(result.error || 'Failed to load from FGD');
    }
    return { success: true, diagram: result.diagram };
});
export const saveFgdPromise = fromPromise(async ({ input }) => {
    if (!input.context.computedTopology?.isValid) {
        throw new Error('Invalid topology cannot be saved');
    }
    const config = FabricSpecSchema.parse(input.context.config);
    const wiringDiagram = generateWiringStub(config, input.context.computedTopology);
    // Save to actual FGD files
    const result = await saveFGD(wiringDiagram, {
        fabricId: config.name || `fabric-${Date.now()}`
    });
    if (!result.success) {
        throw new Error(result.error || 'Failed to save to FGD');
    }
    return { success: true, fgdId: result.fgdId, wiringDiagram };
});
