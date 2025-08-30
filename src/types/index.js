/**
 * Central type exports for HNC v0.1
 * Provides clean imports for all schema and type definitions
 */
// Schema exports
export { SwitchModelSchema, EndpointProfileSchema, FabricSpecSchema, FabricSpecInputSchema, ValidatedFabricSpecSchema, FabricSpecUpdateSchema, validateFabricSpec, validateFabricSpecSafe, } from '../schemas/fabric-spec.schema';
// Derived topology types
export { SWITCH_CAPACITY, } from './derived-topology.types';
// Utility functions
export { calculateLeavesNeeded, calculateSpinesNeeded, calculateTotalCapacity, calculateOversubscriptionRatio, validateTopology, computeTopology, validateFabricSpecQuick, } from '../utils/topology-calculator';
// Configuration defaults
export const DEFAULT_CONFIG = {
    fabric: {
        version: '1.0.0',
        maxEndpoints: 1000,
        maxProfiles: 10,
    },
    switches: {
        leafModel: 'DS2000',
        spineModel: 'DS3000',
        defaultUplinks: 2,
    },
    validation: {
        maxOversubscription: 4.0,
        minRedundancy: false,
        strictPortLimits: true,
    },
};
// Error types for better error handling
export class FabricSpecValidationError extends Error {
    field;
    value;
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'FabricSpecValidationError';
    }
}
export class TopologyComputationError extends Error {
    fabricSpec;
    computationTimeMs;
    constructor(message, fabricSpec, computationTimeMs) {
        super(message);
        this.fabricSpec = fabricSpec;
        this.computationTimeMs = computationTimeMs;
        this.name = 'TopologyComputationError';
    }
}
export class WiringDiagramError extends Error {
    topology;
    validationErrors;
    constructor(message, topology, validationErrors) {
        super(message);
        this.topology = topology;
        this.validationErrors = validationErrors;
        this.name = 'WiringDiagramError';
    }
}
