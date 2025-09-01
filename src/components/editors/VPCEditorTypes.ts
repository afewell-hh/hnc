// Editor-specific types that align with UI component interfaces
import type { K8sMetadata } from '../../upstream/types/generated'

export interface VPCSubnet {
  cidr: string
  gateway?: string
  vlan?: number
  isolated?: boolean
  restricted?: boolean
  dhcp?: {
    enable: boolean
    start?: string
    end?: string
  }
}

export interface VPCConfig {
  metadata: K8sMetadata & { name: string } // Ensure name is required
  spec: {
    defaultIsolated?: boolean
    defaultRestricted?: boolean
    ipv4Namespace?: string
    vlanNamespace?: string
    mode?: 'default' | 'single' | 'multi'
    subnets: Record<string, VPCSubnet>
    permit?: string[][]
    staticRoutes?: Array<{
      destination: string
      nextHop: string
      metric?: number
    }>
  }
}

export interface VPCAttachmentConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    connection?: string
    subnet?: string
    nativeVLAN?: boolean
  }
}

export interface VPCPeeringPermit {
  localSubnets: string[]
  remoteSubnets: string[]
  bidirectional?: boolean
}

export interface VPCPeeringConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    remote?: string
    permit?: VPCPeeringPermit[]
  }
}

export interface ExternalConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    ipv4Namespace?: string
    inboundCommunity?: string
    outboundCommunity?: string
  }
}

export interface ExternalAttachmentConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    connection?: string
    external?: string
    neighbor?: {
      asn?: number
      ip?: string
      password?: string
    }
    switch?: {
      ip?: string
      asn?: number
    }
  }
}

export interface ExternalPeeringConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    permit?: {
      vpc?: string
      external?: string
      vpcSubnets?: string[]
      externalPrefixes?: string[]
    }
  }
}

export interface VRFRoute {
  id: string
  destination: string
  nextHop: string
  metric?: number
  adminDistance?: number
  type: 'static' | 'connected' | 'bgp' | 'ospf'
}

export interface VRFConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    vni?: number
    routeDistinguisher?: string
    routeTargets?: {
      import: string[]
      export: string[]
    }
    routes: VRFRoute[]
    bgp?: {
      asn?: number
      routerId?: string
      neighbors?: Array<{
        ip: string
        asn: number
        password?: string
      }>
    }
    redistribution?: {
      connected?: boolean
      static?: boolean
      ospf?: boolean
    }
    maxPaths?: number
    description?: string
  }
}

export interface RoutePolicyMatch {
  id: string
  type: 'prefix' | 'community' | 'as-path' | 'metric' | 'origin'
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'contains'
  value: string
}

export interface RoutePolicyAction {
  id: string
  type: 'permit' | 'deny' | 'set-metric' | 'set-community' | 'set-local-pref' | 'set-next-hop'
  value?: string
  priority: number
}

export interface RoutePolicyStatement {
  id: string
  sequenceNumber: number
  description?: string
  matches: RoutePolicyMatch[]
  actions: RoutePolicyAction[]
  enabled: boolean
}

export interface RoutePolicyConfig {
  metadata: K8sMetadata & { name: string }
  spec: {
    description?: string
    statements: RoutePolicyStatement[]
    defaultAction: 'permit' | 'deny'
  }
}