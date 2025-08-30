/**
 * Central type exports for HNC v0.1
 * Provides clean imports for all schema and type definitions
 */

// Schema exports
export {
  SwitchModelSchema,
  EndpointProfileSchema,
  FabricSpecSchema,
  FabricSpecInputSchema,
  ValidatedFabricSpecSchema,
  FabricSpecUpdateSchema,
  validateFabricSpec,
  validateFabricSpecSafe,
  type SwitchModel,
  type EndpointProfile,
  type FabricSpec,
  type FabricSpecInput,
  type ValidatedFabricSpec,
  type FabricSpecUpdate,
} from '../schemas/fabric-spec.schema';

// Derived topology types
export {
  SWITCH_CAPACITY,
  type DerivedTopology,
  type SwitchInstance,
  type EndpointInstance,
  type ConnectionMapping,
  type TopologyComputationResult,
  type TopologyComparison,
  type TopologyOptimization,
} from './derived-topology.types';

// Wiring diagram types
export {
  type RackLayout,
  type PowerDistribution,
  type CableManagement,
  type WiringDiagram,
  type WiringDiagramOptions,
  type WiringValidation,
  type InstallationBOM,
  type WiringComponent,
  type PhysicalComponent,
  type InstallationComponent,
} from './wiring-diagram.types';

// Utility functions
export {
  calculateLeavesNeeded,
  calculateSpinesNeeded,
  calculateTotalCapacity,
  calculateOversubscriptionRatio,
  validateTopology,
  computeTopology,
  validateFabricSpecQuick,
} from '../utils/topology-calculator';

// Common type unions for convenience - use actual imports instead of aliases

// Validation result types
export interface ValidationResult<T = unknown> {
  readonly isValid: boolean;
  readonly data?: T;
  readonly errors: string[];
  readonly warnings: string[];
}

// Computation status types
export type ComputationStatus = 'idle' | 'computing' | 'complete' | 'error';
export type ValidationStatus = 'valid' | 'warnings' | 'errors' | 'pending';

// Configuration defaults
export const DEFAULT_CONFIG = {
  fabric: {
    version: '1.0.0',
    maxEndpoints: 1000,
    maxProfiles: 10,
  },
  switches: {
    leafModel: 'DS2000' as const,
    spineModel: 'DS3000' as const,
    defaultUplinks: 2,
  },
  validation: {
    maxOversubscription: 4.0,
    minRedundancy: false,
    strictPortLimits: true,
  },
} as const;

// Error types for better error handling
export class FabricSpecValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'FabricSpecValidationError';
  }
}

export class TopologyComputationError extends Error {
  constructor(
    message: string,
    public readonly fabricSpec: any,
    public readonly computationTimeMs: number
  ) {
    super(message);
    this.name = 'TopologyComputationError';
  }
}

export class WiringDiagramError extends Error {
  constructor(
    message: string,
    public readonly topology: any,
    public readonly validationErrors: string[]
  ) {
    super(message);
    this.name = 'WiringDiagramError';  
  }
}