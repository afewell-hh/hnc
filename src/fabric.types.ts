// Fabric Summary types for workspace management
import type { DriftStatus } from './drift/types.js'
import type { GitStatus } from './features/git.service.js'

// Import CRD-derived types from upstream
import type {
  K8sResource,
  K8sMetadata,
  Switch as CRDSwitch,
  SwitchProfile as CRDSwitchProfile,
  Server as CRDServer,
  ServerProfile as CRDServerProfile,
  Connection as CRDConnection,
  VPC as CRDVPC,
  VPCAttachment as CRDVPCAttachment,
  VPCPeering as CRDVPCPeering,
  External as CRDExternal,
  ExternalAttachment as CRDExternalAttachment,
  ExternalPeering as CRDExternalPeering
} from './upstream/types/generated.d.js'

export interface FabricSummary {
  id: string
  name: string
  status: 'draft' | 'computed' | 'saved'
  createdAt: Date
  lastModified: Date
  driftStatus?: DriftStatus | null
  gitStatus?: GitStatus | null
}

// Workspace context and events
export interface WorkspaceContext {
  fabrics: FabricSummary[]
  selectedFabricId: string | null
  errors: string[]
}

export type WorkspaceEvent =
  | { type: 'CREATE_FABRIC'; name: string }
  | { type: 'SELECT_FABRIC'; fabricId: string }
  | { type: 'DELETE_FABRIC'; fabricId: string }
  | { type: 'LIST_FABRICS' }
  | { type: 'UPDATE_FABRIC_STATUS'; fabricId: string; status: 'draft' | 'computed' | 'saved' }
  | { type: 'UPDATE_FABRIC_DRIFT'; fabricId: string; driftStatus: DriftStatus | null }
  | { type: 'UPDATE_FABRIC_GIT'; fabricId: string; gitStatus: GitStatus | null }
  | { type: 'CHECK_ALL_DRIFT' }
  | { type: 'CHECK_GIT_STATUS'; fabricId?: string }
  | { type: 'BACK_TO_LIST' }

// CRD-compliant fabric deployment types aligned with upstream schema
export interface FabricCRD extends K8sResource {
  apiVersion: 'fabric.githedgehog.com/v1beta1'
  kind: 'Fabric'
  spec: {
    switches: string[] // References to Switch CRDs
    servers: string[] // References to Server CRDs
    connections: string[] // References to Connection CRDs
    topology?: {
      spineLeaf?: {
        spines: number
        leafs: number
        fabricLinks: number
      }
    }
  }
  status?: {
    conditions?: Array<{
      type: string
      status: 'True' | 'False' | 'Unknown'
      lastTransitionTime: string
      reason: string
      message?: string
    }>
    totalSwitches?: number
    totalServers?: number
    totalConnections?: number
  }
}

// Extended switch type that preserves both HNC semantics and CRD compliance
export interface HNCSwitchCRD extends CRDSwitch {
  apiVersion: 'wiring.githedgehog.com/v1beta1'
  kind: 'Switch'
  spec: CRDSwitch['spec'] & {
    // HNC-specific extensions while maintaining CRD compliance
    hncMetadata?: {
      fabricRole: 'spine' | 'leaf'
      uplinkPorts?: number
      downlinkPorts?: number
      endpointPorts?: number
    }
  }
}

// Extended server type that preserves both HNC semantics and CRD compliance
export interface HNCServerCRD extends CRDServer {
  apiVersion: 'wiring.githedgehog.com/v1beta1'
  kind: 'Server'
  spec: CRDServer['spec'] & {
    // HNC-specific extensions while maintaining CRD compliance
    hncMetadata?: {
      endpointType?: 'server' | 'storage' | 'compute' | 'network'
      connectionCount?: number
      redundancy?: boolean
    }
  }
}

// Extended connection type that preserves both HNC semantics and CRD compliance
export interface HNCConnectionCRD extends CRDConnection {
  apiVersion: 'wiring.githedgehog.com/v1beta1'
  kind: 'Connection'
  spec: CRDConnection['spec'] & {
    // HNC-specific extensions while maintaining CRD compliance
    hncMetadata?: {
      connectionType: 'uplink' | 'downlink' | 'endpoint' | 'fabric'
      portBinding?: {
        sourcePort: string
        targetPort: string
      }
    }
  }
}

// CRD-compliant fabric deployment collection
export interface FabricDeploymentCRDs {
  fabric: FabricCRD
  switches: HNCSwitchCRD[]
  servers: HNCServerCRD[]
  connections: HNCConnectionCRD[]
  vpcs?: CRDVPC[]
  vpcAttachments?: CRDVPCAttachment[]
  vpcPeerings?: CRDVPCPeering[]
  externals?: CRDExternal[]
  externalAttachments?: CRDExternalAttachment[]
  externalPeerings?: CRDExternalPeering[]
  switchProfiles?: CRDSwitchProfile[]
  serverProfiles?: CRDServerProfile[]
}

// Type mapping utilities for CRD conversion
export interface CRDTypeMapping {
  // Maps HNC internal types to CRD-compliant structures
  switchRoleToSpec: (role: 'spine' | 'leaf') => Partial<CRDSwitch['spec']>
  serverTypeToSpec: (type: 'server' | 'storage' | 'compute' | 'network') => Partial<CRDServer['spec']>
  connectionTypeToSpec: (type: 'uplink' | 'downlink' | 'endpoint' | 'fabric') => Partial<CRDConnection['spec']>
}

// CRD import/export semantic validation
export interface CRDSemanticValidation {
  validateRoundTrip: (original: FabricDeploymentCRDs, roundTripped: FabricDeploymentCRDs) => {
    isValid: boolean
    errors: string[]
    warnings: string[]
    semanticDifferences: Array<{
      path: string
      original: any
      roundTripped: any
      impact: 'breaking' | 'semantic' | 'cosmetic'
    }>
  }
  preservesSemantics: (original: any, transformed: any, path?: string) => boolean
}

// Legacy compatibility types for backwards compatibility
export interface LegacyFabricImport {
  servers: Array<{
    id: string
    type: string
    connections: number
  }>
  switches: Array<{
    id: string
    model: string
    ports: number
    type: 'leaf' | 'spine'
  }>
  connections: Array<{
    from: { device: string; port: string }
    to: { device: string; port: string }
    type: 'uplink' | 'downlink' | 'endpoint'
  }>
  metadata: {
    fabricName: string
    totalSwitches: number
    totalServers: number
    totalConnections: number
    generatedAt: string
  }
}