// Core type definitions for HNC fabric design

// Field provenance tracking
export type FieldProvenance = 'auto' | 'user' | 'import' | 'manual_override'

// Issue types for the issues panel
export interface Issue {
  id: string
  type: 'error' | 'warning' | 'info'
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  field?: string // field that caused the issue
  overridable?: boolean // can this issue be manually overridden
  overridden?: boolean // has this issue been manually overridden
  category: 'validation' | 'constraint' | 'optimization' | 'configuration' | 'import-conflict'
}

// Override state tracking for fields
export interface FieldOverride {
  fieldPath: string
  originalValue: any
  overriddenValue: any
  reason: string
  overriddenBy: 'user' | 'system'
  overriddenAt: Date
  relatedIssues: string[] // issue IDs that this override addresses
}

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
  type?: 'server' | 'storage' | 'compute' | 'network'
  count?: number
  bandwidth?: number
  redundancy?: boolean
  esLag?: boolean // ES-LAG intent flag
  nics?: number   // NIC count per endpoint (defaults to 1)
}

// Guard types for validation constraints
export interface ESLAGGuard {
  guardType: 'ES_LAG_INVALID'
  message: string
  details: {
    leafClassId: string
    profileName: string
    requiredNics: number
    actualNics: number
  }
}

export interface MCLAGGuard {
  guardType: 'MC_LAG_ODD_LEAF_COUNT'
  message: string
  details: {
    classId: string
    leafCount: number
    mcLagEnabled: boolean
  }
}

export type FabricGuard = ESLAGGuard | MCLAGGuard

// Derived topology computation results
export interface DerivedTopology {
  leavesNeeded: number
  spinesNeeded: number
  totalPorts: number
  usedPorts: number
  oversubscriptionRatio: number
  isValid: boolean
  validationErrors: string[]
  guards: FabricGuard[] // Constraint validation violations
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

// Import progress tracking (WP-IMP3)
export interface ImportProgress {
  status: 'idle' | 'importing' | 'success' | 'error'
  message?: string
  progress?: number
}

// XState types for machine context and events
export interface FabricDesignContext {
  config: Partial<FabricSpec>
  computedTopology: DerivedTopology | null
  allocationResult?: AllocationResult | null
  extendedAllocationResult?: ExtendedAllocationResult | null
  switchProfiles?: {
    leaf: SwitchProfile;
    spine: SwitchProfile;
  } | null
  errors: string[]
  savedToFgd: boolean
  loadedDiagram: WiringDiagram | null
  // Rule evaluation results
  ruleEvaluationResult?: import('./domain/rules').RuleEvaluationResult | null
  issues: Issue[]
  fieldOverrides: FieldOverride[]
  rulesEngineEnabled: boolean
  // Import progress tracking (WP-IMP3)
  importProgress: ImportProgress
  // Import conflict resolution (WP-IMP2)
  importConflicts: import('./domain/import-conflict-resolver').ImportConflict[]
  importedSpec?: FabricSpec | null
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
    breakout?: {
      supportsBreakout: boolean
      breakoutType?: string
      capacityMultiplier?: number
    }
  }
  meta: { source: string; version: string }
}

export type FabricDesignEvent =
  | { type: 'UPDATE_CONFIG'; data: Partial<FabricSpec> }
  | { type: 'COMPUTE_TOPOLOGY' }
  | { type: 'SAVE_TO_FGD' }
  | { type: 'LOAD_FROM_FGD'; fabricId: string }
  | { type: 'RESET' }
  | { type: 'OVERRIDE_ISSUE'; issueId: string; reason: string }
  | { type: 'CLEAR_OVERRIDE'; fieldPath: string }
  // Import events (WP-IMP3)
  | { type: 'START_IMPORT'; fabricSpec: FabricSpec }
  | { type: 'IMPORT_SUCCESS' }
  | { type: 'IMPORT_FAILED'; error: string }
  // Import conflict resolution events (WP-IMP2)
  | { type: 'IMPORT_SPEC'; fabricSpec: FabricSpec }
  | { type: 'RESOLVE_IMPORT_CONFLICT'; conflictId: string; actionType: 'accept' | 'reject' | 'modify'; modifyValue?: any }
  | { type: 'DETECT_IMPORT_CONFLICTS' }
  | { type: 'CLEAR_IMPORT_CONFLICTS' }

// LAG constraint types for future WPs
export interface LAGConstraints {
  esLag?: {
    enabled: boolean
    minMembers?: number
    maxMembers?: number
    loadBalancing?: 'round-robin' | 'hash-based'
  }
  mcLag?: {
    enabled: boolean
    peerLinkCount?: number
    keepAliveInterval?: number
    systemPriority?: number
  }
}


// LeafClass interface for multi-class fabric support
export interface LeafClass {
  id: string
  name: string
  role: 'standard' | 'border'
  leafModelId?: string // defaults to global leaf model if not specified
  uplinksPerLeaf: number
  endpointProfiles: EndpointProfile[]
  lag?: LAGConstraints
  count?: number // number of leaves in this class
  mcLag?: boolean // MC-LAG constraint flag
  breakoutEnabled?: boolean // Enable breakout for this leaf class
  metadata?: Record<string, any>
  // Field provenance tracking per leaf class
  provenance?: {
    spines?: FieldProvenance
    leaves?: FieldProvenance
  }
}

// Per-class allocation results
export interface LeafClassAllocation {
  classId: string
  leafMaps: LeafAllocation[]
  totalEndpoints: number
  utilizationPercent: number
  issues: string[]
}

// Extended allocation result with per-class support
export interface ExtendedAllocationResult {
  leafClassAllocations: LeafClassAllocation[]
  spineUtilization: number[]
  totalLeavesAllocated: number
  overallUtilization: number
  issues: string[]
  legacy?: AllocationResult // for backwards compatibility
}

// Fabric specification type (derived from Zod schema)
export interface FabricSpec {
  name: string
  spineModelId: string
  leafModelId: string // global default for leaf classes without specific model
  
  // Multi-class support (new)
  leafClasses?: LeafClass[]
  
  // Backwards compatibility (legacy single-class mode)
  uplinksPerLeaf?: number
  endpointProfile?: EndpointProfile
  endpointCount?: number
  breakoutEnabled?: boolean // Simple breakout toggle for single-class mode
  
  // Common fields
  metadata?: Record<string, any>
  version?: string
  createdAt?: Date
}