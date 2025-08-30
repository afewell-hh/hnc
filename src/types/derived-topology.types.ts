import type { FabricSpec } from '../schemas/fabric-spec.schema';

// Switch capacity constants based on model specifications
export const SWITCH_CAPACITY = {
  DS2000: {
    ports: 48,
    uplinks: 4,
    bandwidth: 1000, // Gbps per port
    maxEndpoints: 48,
  },
  DS3000: {
    ports: 64,
    downlinks: 32, // Maximum downlinks to leaf switches
    bandwidth: 10000, // Gbps per port
    maxLeaves: 32,
  },
} as const;

// Computed topology metrics derived from FabricSpec
export interface DerivedTopology {
  // Primary computed values
  readonly leavesNeeded: number;
  readonly spinesNeeded: number;
  readonly totalCapacity: number;
  readonly oversubscriptionRatio: number;
  
  // Detailed capacity breakdown
  readonly capacityBreakdown: {
    endpointPorts: number;
    uplinkPorts: number;
    availableEndpointPorts: number;
    totalBandwidth: number; // Gbps
  };
  
  // Utilization metrics
  readonly utilization: {
    leafPortUtilization: number; // Percentage
    spinePortUtilization: number; // Percentage
    bandwidthUtilization: number; // Percentage
  };
  
  // Redundancy and reliability metrics
  readonly redundancy: {
    hasRedundantSpines: boolean;
    hasRedundantUplinks: boolean;
    redundancyLevel: 'none' | 'partial' | 'full';
  };
  
  // Validation flags
  readonly validation: {
    isValid: boolean;
    withinPortLimits: boolean;
    withinBandwidthLimits: boolean;
    meetsRedundancyRequirements: boolean;
    warnings: string[];
    errors: string[];
  };
  
  // Computed at timestamp
  readonly computedAt: Date;
}

// Switch instance type for wiring diagram
export interface SwitchInstance {
  readonly id: string;
  readonly type: 'leaf' | 'spine';
  readonly model: 'DS2000' | 'DS3000';
  readonly position: {
    rack: number;
    unit: number;
  };
  readonly ports: {
    total: number;
    available: number;
    used: number;
  };
  readonly metadata: Record<string, any>;
}

// Server/endpoint instance type
export interface EndpointInstance {
  readonly id: string;
  readonly profileName: string;
  readonly type: 'server' | 'storage' | 'compute' | 'network';
  readonly position: {
    rack: number;
    unit: number;
  };
  readonly connectivity: {
    requiredBandwidth: number;
    redundant: boolean;
    connectedSwitches: string[]; // Switch IDs
  };
  readonly metadata: Record<string, any>;
}

// Connection mapping between components
export interface ConnectionMapping {
  readonly id: string;
  readonly type: 'endpoint-to-leaf' | 'leaf-to-spine';
  readonly source: {
    id: string;
    port: number;
    type: 'endpoint' | 'leaf' | 'spine';
  };
  readonly destination: {
    id: string;
    port: number;
    type: 'endpoint' | 'leaf' | 'spine';
  };
  readonly bandwidth: number; // Gbps
  readonly cable: {
    type: 'copper' | 'fiber';
    length: number; // meters
  };
  readonly metadata: Record<string, any>;
}

// Complete topology computation result
export interface TopologyComputationResult {
  readonly fabricSpec: FabricSpec;
  readonly derivedTopology: DerivedTopology;
  readonly computationMeta: {
    algorithmVersion: string;
    computationTimeMs: number;
    cacheHit: boolean;
    warnings: string[];
    errors: string[];
  };
}

// Topology comparison for different configurations
export interface TopologyComparison {
  readonly scenarios: Array<{
    name: string;
    fabricSpec: FabricSpec;
    derivedTopology: DerivedTopology;
  }>;
  readonly comparison: {
    costEfficiency: number[];
    portUtilization: number[];
    redundancyLevel: string[];
    recommendedIndex: number;
  };
  readonly comparedAt: Date;
}

// Topology optimization suggestions
export interface TopologyOptimization {
  readonly currentTopology: DerivedTopology;
  readonly suggestions: Array<{
    type: 'reduce_oversubscription' | 'improve_redundancy' | 'optimize_cost' | 'increase_capacity';
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: {
      costChange: number; // Percentage
      performanceChange: number; // Percentage
      redundancyChange: string;
    };
    suggestedChanges: Partial<FabricSpec>;
  }>;
  readonly optimizedAt: Date;
}