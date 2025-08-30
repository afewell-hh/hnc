// Default fabric specification for testing and initial state
export const DEFAULT_SPEC = {
    name: 'Default Fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 4,
    endpointProfile: {
        name: 'Standard Server',
        portsPerEndpoint: 1
    },
    endpointCount: 100
};
