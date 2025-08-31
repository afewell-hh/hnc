// Core type definitions for HNC fabric design

// Switch catalog types (stub)
export interface SwitchModel {
  id: string
  name: string
  manufacturer: string
  ports: number
  type: 'leaf' | 'spine'
  maxUplinks?: number
}

export interface EndpointProfile {
  name: string
  portsPerEndpoint: number
}

// Derived topology computation results
export interface DerivedTopology {
  leavesNeeded: number
  spinesNeeded: number
  totalPorts: number
  usedPorts: number
  oversubscriptionRatio: number
  isValid: boolean
  validationErrors: string[]
}

// Wiring diagram stub structure
export interface WiringConnection {
  from: { device: string; port: string }
  to: { device: string; port: string }
  type: 'uplink' | 'downlink' | 'endpoint'
}

export interface WiringDiagram {
  devices: {
    spines: Array<{ id: string; model: string; ports: number }>
    leaves: Array<{ id: string; model: string; ports: number }>
    servers: Array<{ id: string; type: string; connections: number }>
  }
  connections: WiringConnection[]
  metadata: {
    generatedAt: Date
    fabricName: string
    totalDevices: number
  }
}

// XState types for machine context and events
export interface FabricDesignContext {
  config: Partial<FabricSpec>
  computedTopology: DerivedTopology | null
  allocationResult?: AllocationResult | null
  switchProfiles?: {
    leaf: SwitchProfile;
    spine: SwitchProfile;
  } | null
  errors: string[]
  savedToFgd: boolean
  loadedDiagram: WiringDiagram | null
}

// Import allocation types
export interface AllocationResult {
  leafMaps: LeafAllocation[]
  spineUtilization: number[]
  issues: string[]
}

export interface LeafAllocation {
  leafId: number
  uplinks: UplinkAssignment[]
}

export interface UplinkAssignment {
  port: string
  toSpine: number
}

export interface SwitchProfile {
  modelId: string
  roles: string[]
  ports: {
    endpointAssignable: string[]
    fabricAssignable: string[]
  }
  profiles: {
    endpoint: { portProfile: string | null; speedGbps: number }
    uplink: { portProfile: string | null; speedGbps: number }
  }
  meta: { source: string; version: string }
}

export type FabricDesignEvent =
  | { type: 'UPDATE_CONFIG'; data: Partial<FabricSpec> }
  | { type: 'COMPUTE_TOPOLOGY' }
  | { type: 'SAVE_TO_FGD' }
  | { type: 'LOAD_FROM_FGD'; fabricId: string }
  | { type: 'RESET' }

// Fabric specification type (derived from Zod schema)
export interface FabricSpec {
  name: string
  spineModelId: string
  leafModelId: string
  uplinksPerLeaf: number
  endpointProfile: EndpointProfile
  endpointCount: number
}