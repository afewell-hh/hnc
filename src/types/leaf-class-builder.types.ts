/**
 * Extended CRD-aligned types for Leaf Class Builder UI components
 * Builds on existing fabric types with UI-specific enhancements
 */

import type {
  LeafClass,
  EndpointProfile,
  LAGConstraints,
  SwitchModel
} from '../schemas/fabric-spec.schema';
// Base types for provenance and validation (self-contained)
export type FieldProvenance = 'auto' | 'user' | 'import';

export interface ProvenanceInfo {
  source: FieldProvenance;
  timestamp?: string;
  comment?: string;
}

export interface FieldWithProvenance<T> {
  value: T;
  provenance: ProvenanceInfo;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  remediation?: string;
  context?: string;
}

// CRD Field types for advanced drawer
export interface CRDField {
  path: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  description?: string;
  required?: boolean;
  enumValues?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    format?: string;
  };
  provenance: ProvenanceInfo;
  currentValue: unknown;
  defaultValue?: unknown;
}

export interface CRDFieldGroup {
  name: string;
  label: string;
  description?: string;
  fields: CRDField[];
  collapsed?: boolean;
}

// Extended assignable range configuration for UI
export interface AssignableRangeConfig {
  id: string;
  name: string;
  description?: string;
  type: 'vlan' | 'port' | 'subnet' | 'asn';
  range: {
    start: number;
    end: number;
  };
  // UI-specific fields
  allocated?: number;
  available?: number;
  utilization?: number;
  conflicts?: string[];
  provenance: ProvenanceInfo;
}

// Enhanced endpoint profile with UI state
export interface EndpointProfileConfig extends EndpointProfile {
  id: string;
  isDefault?: boolean;
  conflicts?: string[];
  vlanMode: 'access' | 'trunk' | 'hybrid';
  provenance: ProvenanceInfo;
  // Extended QoS configuration
  qos?: {
    trustMode?: 'none' | 'cos' | 'dscp';
    defaultCos?: number;
    queues?: Array<{
      id: number;
      weight: number;
      priority?: 'high' | 'medium' | 'low';
    }>;
    rateLimit?: {
      ingress?: number;
      egress?: number;
    };
  };
  // Extended storm control
  stormControl?: {
    broadcast?: number;
    multicast?: number;
    unicast?: number;
    enabled?: boolean;
  };
  // Security settings
  security?: {
    dhcpSnooping?: boolean;
    arpInspection?: boolean;
    bpduGuard?: boolean;
    portSecurity?: {
      enabled?: boolean;
      maxMac?: number;
      violation?: 'shutdown' | 'restrict' | 'protect';
    };
  };
}

// Uplink group configuration
export interface UplinkGroupConfig {
  id: string;
  name: string;
  description?: string;
  ports: string[];
  mode: 'active-backup' | 'lacp' | 'static';
  lacpConfig?: {
    mode?: 'active' | 'passive';
    rate?: 'slow' | 'fast';
    systemPriority?: number;
    portPriority?: number;
  };
  redundancy?: {
    minLinks?: number;
    maxLinks?: number;
    failoverDelay?: number;
  };
  monitoring?: {
    linkDetection?: boolean;
    loadBalancing?: 'round-robin' | 'hash-based' | 'bandwidth';
  };
  provenance: ProvenanceInfo;
}

// Enhanced leaf class configuration with CRD compliance
export interface LeafClassConfigUI extends Omit<LeafClass, 'endpointProfiles'> {
  // Enhanced properties with UI state
  assignableRanges: AssignableRangeConfig[];
  endpointProfiles: EndpointProfileConfig[];
  uplinkGroups: UplinkGroupConfig[];
  
  // CRD metadata preservation
  crdFields?: {
    metadata?: {
      name: string;
      namespace?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec?: Record<string, unknown>;
    status?: Record<string, unknown>;
  };

  // UI state
  isExpanded?: boolean;
  hasUnsavedChanges?: boolean;
  validationState?: 'valid' | 'warning' | 'error';
  lastModified?: Date;
  provenance: ProvenanceInfo;
}

// Topology configuration with multi-class support
export interface TopologyConfig {
  name: string;
  description?: string;
  leafClasses: LeafClassConfigUI[];
  fabricSettings: {
    spineModel: SwitchModel;
    spineCount?: number;
    fabricASN?: number;
    loopbackSubnet?: string;
    vtepSubnet?: string;
    fabricSubnet?: string;
  };
  globalSettings?: {
    defaultUplinksPerLeaf?: number;
    breakoutEnabled?: boolean;
    lacpEnabled?: boolean;
    mclagEnabled?: boolean;
  };
  // CRD compliance
  crdCompliant: boolean;
  crdVersion?: string;
  lastValidated?: Date;
  provenance: ProvenanceInfo;
}

// Validation context for leaf class builder
export interface LeafClassValidationContext {
  leafClass: LeafClassConfigUI;
  siblingClasses: LeafClassConfigUI[];
  fabricSettings: TopologyConfig['fabricSettings'];
  globalConstraints: {
    maxVlans?: number;
    maxEndpoints?: number;
    maxUplinkGroups?: number;
    requiredFields: string[];
  };
}

// Builder state management
export interface LeafClassBuilderState {
  currentStep: 'basic' | 'ranges' | 'profiles' | 'uplinks' | 'validation' | 'advanced';
  leafClasses: LeafClassConfigUI[];
  selectedLeafClassId?: string;
  showAdvancedDrawer: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: ValidationError[];
  isLoading: boolean;
  mode: 'create' | 'edit' | 'clone';
}

// Events for leaf class builder
export type LeafClassBuilderEvent =
  | { type: 'CREATE_LEAF_CLASS'; template?: Partial<LeafClassConfigUI> }
  | { type: 'SELECT_LEAF_CLASS'; leafClassId: string }
  | { type: 'UPDATE_LEAF_CLASS'; leafClassId: string; updates: Partial<LeafClassConfigUI> }
  | { type: 'DELETE_LEAF_CLASS'; leafClassId: string }
  | { type: 'CLONE_LEAF_CLASS'; sourceId: string; newName: string }
  | { type: 'ADD_ASSIGNABLE_RANGE'; leafClassId: string; range: AssignableRangeConfig }
  | { type: 'UPDATE_ASSIGNABLE_RANGE'; leafClassId: string; rangeId: string; updates: Partial<AssignableRangeConfig> }
  | { type: 'DELETE_ASSIGNABLE_RANGE'; leafClassId: string; rangeId: string }
  | { type: 'ADD_ENDPOINT_PROFILE'; leafClassId: string; profile: EndpointProfileConfig }
  | { type: 'UPDATE_ENDPOINT_PROFILE'; leafClassId: string; profileId: string; updates: Partial<EndpointProfileConfig> }
  | { type: 'DELETE_ENDPOINT_PROFILE'; leafClassId: string; profileId: string }
  | { type: 'SET_DEFAULT_ENDPOINT_PROFILE'; leafClassId: string; profileId: string }
  | { type: 'ADD_UPLINK_GROUP'; leafClassId: string; group: UplinkGroupConfig }
  | { type: 'UPDATE_UPLINK_GROUP'; leafClassId: string; groupId: string; updates: Partial<UplinkGroupConfig> }
  | { type: 'DELETE_UPLINK_GROUP'; leafClassId: string; groupId: string }
  | { type: 'VALIDATE_LEAF_CLASS'; leafClassId: string }
  | { type: 'VALIDATE_ALL' }
  | { type: 'SET_STEP'; step: LeafClassBuilderState['currentStep'] }
  | { type: 'TOGGLE_ADVANCED_DRAWER' }
  | { type: 'EXPORT_CRD'; leafClassId?: string }
  | { type: 'IMPORT_CRD'; crdData: Record<string, unknown> }
  | { type: 'RESET_CHANGES'; leafClassId?: string }
  | { type: 'SAVE_CHANGES' };

// CRD field mapping for advanced drawer
export interface CRDFieldMapping {
  uiField: string;
  crdPath: string;
  required: boolean;
  validation?: (value: unknown) => ValidationError[];
  transform?: {
    toCRD: (uiValue: unknown) => unknown;
    fromCRD: (crdValue: unknown) => unknown;
  };
}

// Templates for quick leaf class creation
export interface LeafClassTemplate {
  id: string;
  name: string;
  description: string;
  category: 'compute' | 'storage' | 'network' | 'edge' | 'custom';
  template: Partial<LeafClassConfigUI>;
  tags: string[];
  complexity: 'simple' | 'intermediate' | 'advanced';
}

// Builder configuration
export interface LeafClassBuilderConfig {
  enableAdvancedFeatures: boolean;
  enableCRDExport: boolean;
  enableTemplates: boolean;
  maxLeafClasses: number;
  validationMode: 'strict' | 'relaxed';
  autoSave: boolean;
  showProvenance: boolean;
  crdCompliance: 'enforced' | 'optional' | 'disabled';
}