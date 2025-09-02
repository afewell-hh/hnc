/**
 * VPC Editor Types - WP-VPC1
 * CRD-aligned types for VPC networks, subnets, VRF, and policy management
 */

import type { FieldProvenance } from './leaf-class-builder.types'

// Base VPC CRD alignment
export interface VPCSpec {
  name: string
  namespace?: string
  annotations?: Record<string, string>
  labels?: Record<string, string>
}

// Network configuration aligned with githedgehog VPC CRDs
export interface VPCNetwork {
  name: string
  cidr: string
  vlanId?: number
  description?: string
  provenance: FieldProvenance
  subnets: VPCSubnet[]
  policies: VPCPolicy[]
}

export interface VPCSubnet {
  name: string
  cidr: string
  gateway?: string
  dhcp?: DHCPConfig
  vni?: number
  description?: string
  provenance: FieldProvenance
}

export interface DHCPConfig {
  enabled: boolean
  startIP?: string
  endIP?: string
  dnsServers?: string[]
  domainName?: string
  provenance: FieldProvenance
}

// VRF (Virtual Routing and Forwarding) configuration
export interface VRFConfig {
  name: string
  routeDistinguisher: string
  routeTargets: {
    import: string[]
    export: string[]
  }
  networks: string[] // References to VPCNetwork names
  description?: string
  provenance: FieldProvenance
}

// Policy configuration for VPC security and routing
export interface VPCPolicy {
  name: string
  type: 'security' | 'routing' | 'qos'
  rules: PolicyRule[]
  appliedTo: string[] // Network/subnet references
  priority: number
  description?: string
  provenance: FieldProvenance
}

export interface PolicyRule {
  id: string
  action: 'allow' | 'deny' | 'redirect'
  protocol?: 'tcp' | 'udp' | 'icmp' | 'any'
  sourceNet?: string
  destNet?: string
  sourcePorts?: string
  destPorts?: string
  priority: number
  provenance: FieldProvenance
}

// Complete VPC configuration
export interface VPCConfiguration {
  metadata: VPCSpec
  networks: VPCNetwork[]
  vrfs: VRFConfig[]
  globalPolicies: VPCPolicy[]
  provenance: FieldProvenance
  validation?: VPCValidationResult
}

export interface VPCValidationResult {
  isValid: boolean
  errors: VPCValidationMessage[]
  warnings: VPCValidationMessage[]
  info: VPCValidationMessage[]
}

export interface VPCValidationMessage {
  code: string
  what: string
  how: string
  why: string
  affectedFields: string[]
  context?: {
    network?: string
    subnet?: string
    vrf?: string
    policy?: string
    conflictsWith?: string[]
    suggestedValues?: string[]
  }
}

// Import/Export types for deterministic behavior
export interface VPCImportResult {
  configuration: VPCConfiguration
  warnings: string[]
  transformed: boolean
  source: 'yaml' | 'json' | 'k8s-crd'
}

export interface VPCExportOptions {
  format: 'yaml' | 'json' | 'k8s-crd'
  includeDefaults: boolean
  includeProvenance: boolean
  validate: boolean
}

export interface VPCExportResult {
  content: string
  format: string
  valid: boolean
  warnings: string[]
}

// UI component props
export interface VPCEditorProps {
  configuration: VPCConfiguration
  onChange: (config: VPCConfiguration) => void
  onValidate?: (result: VPCValidationResult) => void
  mode?: 'guided' | 'expert'
  readOnly?: boolean
}

export interface VPCNetworkBuilderProps {
  network: VPCNetwork
  onChange: (network: VPCNetwork) => void
  existingNetworks: VPCNetwork[]
  mode?: 'guided' | 'expert'
}

export interface VPCSubnetBuilderProps {
  subnet: VPCSubnet
  parentNetwork: VPCNetwork
  onChange: (subnet: VPCSubnet) => void
  existingSubnets: VPCSubnet[]
  mode?: 'guided' | 'expert'
}

export interface VRFBuilderProps {
  vrf: VRFConfig
  onChange: (vrf: VRFConfig) => void
  availableNetworks: VPCNetwork[]
  existingVrfs: VRFConfig[]
  mode?: 'guided' | 'expert'
}

export interface VPCPolicyBuilderProps {
  policy: VPCPolicy
  onChange: (policy: VPCPolicy) => void
  availableNetworks: VPCNetwork[]
  existingPolicies: VPCPolicy[]
  mode?: 'guided' | 'expert'
}

// Validation codes for common VPC issues
export const VPC_VALIDATION_CODES = {
  NETWORK_CIDR_OVERLAP: 'NETWORK_CIDR_OVERLAP',
  SUBNET_OUT_OF_NETWORK: 'SUBNET_OUT_OF_NETWORK',
  SUBNET_CIDR_OVERLAP: 'SUBNET_CIDR_OVERLAP',
  INVALID_VLAN_ID: 'INVALID_VLAN_ID',
  DUPLICATE_NETWORK_NAME: 'DUPLICATE_NETWORK_NAME',
  DUPLICATE_SUBNET_NAME: 'DUPLICATE_SUBNET_NAME',
  VRF_MISSING_NETWORK: 'VRF_MISSING_NETWORK',
  POLICY_INVALID_TARGET: 'POLICY_INVALID_TARGET',
  DHCP_RANGE_INVALID: 'DHCP_RANGE_INVALID',
  GATEWAY_NOT_IN_SUBNET: 'GATEWAY_NOT_IN_SUBNET',
  VNI_CONFLICT: 'VNI_CONFLICT',
  ROUTE_TARGET_INVALID: 'ROUTE_TARGET_INVALID'
} as const

export type VPCValidationCode = typeof VPC_VALIDATION_CODES[keyof typeof VPC_VALIDATION_CODES]