import { FabricSpecSchema } from './app.state.js';
export const isValidConfig = ({ context }) => {
    // Check the essential fields needed for computation
    const config = context.config;
    console.log('GUARD isValidConfig: called with config:', JSON.stringify(config, null, 2));
    
    // Must have essential numeric values
    if (!config.uplinksPerLeaf || !config.endpointCount) {
        console.log('GUARD isValidConfig: Missing uplinksPerLeaf or endpointCount');
        return false;
    }
    
    // Must have even uplinks
    if (config.uplinksPerLeaf % 2 !== 0) {
        console.log('GUARD isValidConfig: Odd uplinks per leaf');
        return false;
    }
    
    // Must have endpoint profile
    if (!config.endpointProfile || !config.endpointProfile.name) {
        console.log('GUARD isValidConfig: Missing endpoint profile');
        return false;
    }
    
    // Must have model IDs
    if (!config.spineModelId || !config.leafModelId) {
        console.log('GUARD isValidConfig: Missing model IDs');
        return false;
    }
    
    console.log('GUARD isValidConfig: Configuration is valid - RETURNING TRUE');
    return true;
};
export const canSaveTopology = ({ context }) => {
    const t = context.computedTopology;
    return Boolean(t?.isValid && t.leavesNeeded > 0 && t.spinesNeeded > 0 && t.oversubscriptionRatio <= 4.0);
};
