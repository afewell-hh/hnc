import type { SwitchInstance, EndpointInstance, ConnectionMapping } from './derived-topology.types';

// Physical rack layout information
export interface RackLayout {
  readonly id: string;
  readonly name: string;
  readonly units: number; // Standard 42U rack
  readonly powerCapacity: number; // Watts
  readonly coolingCapacity: number; // BTU/hr
  readonly position: {
    row: string;
    column: number;
  };
  readonly occupiedUnits: Array<{
    startUnit: number;
    endUnit: number;
    deviceId: string;
    deviceType: 'switch' | 'endpoint' | 'pdu' | 'empty';
  }>;
}

// Power distribution unit information
export interface PowerDistribution {
  readonly pduId: string;
  readonly rackId: string;
  readonly capacity: number; // Watts
  readonly outlets: Array<{
    id: string;
    deviceId: string;
    powerDraw: number;
    redundant: boolean;
  }>;
  readonly redundancy: 'A' | 'B' | 'A+B';
}

// Cable management and organization
export interface CableManagement {
  readonly id: string;
  readonly connectionId: string;
  readonly routing: {
    path: string[]; // Rack IDs in order
    trayLevel: number;
    bundleId?: string;
  };
  readonly installation: {
    installedBy: string;
    installedDate: Date;
    testResults: {
      continuity: boolean;
      attenuation: number;
      reflectance: number;
    };
  };
}

// Complete wiring diagram structure
export interface WiringDiagram {
  // Physical infrastructure
  readonly racks: RackLayout[];
  readonly switches: SwitchInstance[];
  readonly endpoints: EndpointInstance[];
  readonly connections: ConnectionMapping[];
  
  // Power and cooling
  readonly powerDistribution: PowerDistribution[];
  readonly coolingLayout: {
    airflowDirection: 'front-to-back' | 'side-to-side';
    hotAisles: string[]; // Rack row IDs
    coldAisles: string[]; // Rack row IDs
  };
  
  // Cable management
  readonly cableManagement: CableManagement[];
  readonly cableBundles: Array<{
    id: string;
    connectionIds: string[];
    routingPath: string[];
    installationNotes: string;
  }>;
  
  // Network topology summary
  readonly topology: {
    fabricName: string;
    totalSwitches: number;
    totalEndpoints: number;
    totalConnections: number;
    redundancyLevel: 'none' | 'partial' | 'full';
  };
  
  // Installation metadata
  readonly installation: {
    version: string;
    generatedAt: Date;
    generatedBy: string;
    validationStatus: 'valid' | 'warnings' | 'errors';
    installationNotes: string[];
  };
}

// Wiring diagram generation options
export interface WiringDiagramOptions {
  readonly layout: {
    rackSpacing: number; // meters
    aisleWidth: number; // meters
    maxRacksPerRow: number;
    preferredRackConfiguration: 'dense' | 'spread' | 'balanced';
  };
  
  readonly cabling: {
    preferredCableType: 'copper' | 'fiber' | 'mixed';
    maxCableLength: number; // meters
    bundlingStrategy: 'none' | 'by_destination' | 'by_type' | 'optimal';
    redundantCabling: boolean;
  };
  
  readonly power: {
    redundantPower: boolean;
    powerEfficiencyTarget: number; // Percentage
    coolingStrategy: 'air' | 'liquid' | 'hybrid';
  };
  
  readonly naming: {
    switchNamingPattern: string; // e.g., "sw-{type}-{rack}-{unit}"
    endpointNamingPattern: string; // e.g., "srv-{profile}-{id}"
    rackNamingPattern: string; // e.g., "rack-{row}-{col}"
  };
}

// Wiring validation results
export interface WiringValidation {
  readonly isValid: boolean;
  readonly validationResults: Array<{
    category: 'physical' | 'electrical' | 'network' | 'thermal';
    level: 'error' | 'warning' | 'info';
    message: string;
    affectedComponents: string[];
    suggestedFix?: string;
  }>;
  
  readonly constraints: {
    rackSpaceUtilization: number; // Percentage
    powerUtilization: number; // Percentage
    coolingUtilization: number; // Percentage
    cableLengthCompliance: boolean;
    redundancyCompliance: boolean;
  };
  
  readonly validatedAt: Date;
}

// Installation bill of materials
export interface InstallationBOM {
  readonly switches: Array<{
    model: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    specifications: Record<string, any>;
  }>;
  
  readonly servers: Array<{
    profile: string;
    model: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    specifications: Record<string, any>;
  }>;
  
  readonly cables: Array<{
    type: string;
    length: number;
    quantity: number;
    unitCost: number;
    totalCost: number;
    specifications: Record<string, any>;
  }>;
  
  readonly infrastructure: Array<{
    component: 'rack' | 'pdu' | 'cooling' | 'other';
    model: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    specifications: Record<string, any>;
  }>;
  
  readonly summary: {
    totalCost: number;
    itemCount: number;
    estimatedInstallationTime: number; // hours
    warrantyPeriod: number; // months
  };
  
  readonly generatedAt: Date;
}

// Export utility types for convenience
export type WiringComponent = SwitchInstance | EndpointInstance;
export type PhysicalComponent = WiringComponent | RackLayout | PowerDistribution;
export type InstallationComponent = PhysicalComponent | CableManagement;