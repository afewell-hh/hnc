/**
 * VPC Import/Export Utilities - WP-VPC1
 * Deterministic import/export functionality for VPC configurations
 */

import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import type { 
  VPCConfiguration, 
  VPCImportResult, 
  VPCExportOptions, 
  VPCExportResult,
  VPCNetwork,
  VRFConfig,
  VPCPolicy 
} from '../types/vpc-editor.types'
import { createFieldProvenance } from './provenance.utils'

/**
 * Import VPC configuration from various formats
 */
export async function importVPCConfiguration(
  content: string,
  format: 'yaml' | 'json' | 'k8s-crd' | 'auto' = 'auto'
): Promise<VPCImportResult> {
  const result: VPCImportResult = {
    configuration: createEmptyVPCConfiguration(),
    warnings: [],
    transformed: false,
    source: 'json'
  }

  try {
    // Auto-detect format
    if (format === 'auto') {
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        format = 'json'
      } else if (content.includes('apiVersion:') && content.includes('kind:')) {
        format = 'k8s-crd'
      } else {
        format = 'yaml'
      }
    }

    result.source = format

    let parsed: any
    switch (format) {
      case 'json':
        parsed = JSON.parse(content)
        break
      case 'yaml':
      case 'k8s-crd':
        parsed = yamlLoad(content) as any
        break
      default:
        throw new Error(`Unsupported format: ${format}`)
    }

    // Handle Kubernetes CRD format
    if (format === 'k8s-crd') {
      result.configuration = transformK8sCRDToVPCConfig(parsed)
      result.transformed = true
    } else {
      // Direct VPC configuration format
      result.configuration = validateAndNormalizeVPCConfig(parsed)
    }

    // Add import provenance
    addImportProvenance(result.configuration, format)

  } catch (error) {
    result.warnings.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.configuration = createEmptyVPCConfiguration()
  }

  return result
}

/**
 * Export VPC configuration to various formats
 */
export async function exportVPCConfiguration(
  configuration: VPCConfiguration,
  options: VPCExportOptions
): Promise<VPCExportResult> {
  const result: VPCExportResult = {
    content: '',
    format: options.format,
    valid: true,
    warnings: []
  }

  try {
    let exportData: any

    // Prepare data for export
    if (options.format === 'k8s-crd') {
      exportData = transformVPCConfigToK8sCRDs(configuration, options)
    } else {
      exportData = prepareVPCConfigForExport(configuration, options)
    }

    // Generate content based on format
    switch (options.format) {
      case 'json':
        result.content = JSON.stringify(exportData, null, 2)
        break
      case 'yaml':
      case 'k8s-crd':
        if (Array.isArray(exportData)) {
          // Multiple CRDs
          result.content = exportData.map(crd => yamlDump(crd)).join('---\n')
        } else {
          result.content = yamlDump(exportData)
        }
        break
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }

    // Validate if requested
    if (options.validate) {
      result.warnings.push(...validateExportedContent(result.content, options.format))
    }

  } catch (error) {
    result.valid = false
    result.warnings.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.content = ''
  }

  return result
}

/**
 * Create empty VPC configuration
 */
function createEmptyVPCConfiguration(): VPCConfiguration {
  return {
    metadata: {
      name: 'vpc-config',
      namespace: 'default'
    },
    networks: [],
    vrfs: [],
    globalPolicies: [],
    provenance: createFieldProvenance('import', 'root')
  }
}

/**
 * Transform Kubernetes CRD to VPC configuration
 */
function transformK8sCRDToVPCConfig(k8sData: any): VPCConfiguration {
  const config = createEmptyVPCConfiguration()

  if (Array.isArray(k8sData)) {
    // Multiple CRDs
    k8sData.forEach(crd => processK8sCRD(crd, config))
  } else {
    // Single CRD
    processK8sCRD(k8sData, config)
  }

  return config
}

/**
 * Process individual K8s CRD
 */
function processK8sCRD(crd: any, config: VPCConfiguration) {
  if (!crd.kind) return

  switch (crd.kind) {
    case 'VPCNetwork':
    case 'Network':
      if (crd.spec) {
        const network: VPCNetwork = {
          name: crd.metadata?.name || 'unknown',
          cidr: crd.spec.cidr || '10.0.0.0/24',
          vlanId: crd.spec.vlanId,
          description: crd.spec.description,
          provenance: createFieldProvenance('import', 'k8s-crd'),
          subnets: crd.spec.subnets || [],
          policies: []
        }
        config.networks.push(network)
      }
      break

    case 'VRF':
      if (crd.spec) {
        const vrf: VRFConfig = {
          name: crd.metadata?.name || 'unknown',
          routeDistinguisher: crd.spec.routeDistinguisher || '65000:1',
          routeTargets: crd.spec.routeTargets || { import: [], export: [] },
          networks: crd.spec.networks || [],
          description: crd.spec.description,
          provenance: createFieldProvenance('import', 'k8s-crd')
        }
        config.vrfs.push(vrf)
      }
      break

    case 'NetworkPolicy':
      if (crd.spec) {
        const policy: VPCPolicy = {
          name: crd.metadata?.name || 'unknown',
          type: determineVPCPolicyType(crd.spec),
          rules: transformK8sPolicyRules(crd.spec.rules || []),
          appliedTo: crd.spec.appliedTo || [],
          priority: crd.spec.priority || 1000,
          description: crd.spec.description,
          provenance: createFieldProvenance('import', 'k8s-crd')
        }
        config.globalPolicies.push(policy)
      }
      break
  }

  // Update metadata from first CRD
  if (crd.metadata && !config.metadata.name) {
    config.metadata.name = crd.metadata.name || 'vpc-config'
    config.metadata.namespace = crd.metadata.namespace || 'default'
  }
}

/**
 * Transform VPC configuration to Kubernetes CRDs
 */
function transformVPCConfigToK8sCRDs(
  config: VPCConfiguration, 
  options: VPCExportOptions
): any[] {
  const crds: any[] = []

  // Create Network CRDs
  config.networks.forEach(network => {
    const networkCRD = {
      apiVersion: 'networking.githedgehog.com/v1alpha2',
      kind: 'VPCNetwork',
      metadata: {
        name: network.name,
        namespace: config.metadata.namespace || 'default'
      },
      spec: {
        cidr: network.cidr,
        ...(network.vlanId && { vlanId: network.vlanId }),
        ...(network.description && { description: network.description }),
        ...(network.subnets.length > 0 && { subnets: network.subnets })
      }
    }

    if (!options.includeDefaults) {
      cleanDefaultValues(networkCRD.spec)
    }

    crds.push(networkCRD)
  })

  // Create VRF CRDs
  config.vrfs.forEach(vrf => {
    const vrfCRD = {
      apiVersion: 'networking.githedgehog.com/v1alpha2',
      kind: 'VRF',
      metadata: {
        name: vrf.name,
        namespace: config.metadata.namespace || 'default'
      },
      spec: {
        routeDistinguisher: vrf.routeDistinguisher,
        routeTargets: vrf.routeTargets,
        networks: vrf.networks,
        ...(vrf.description && { description: vrf.description })
      }
    }

    crds.push(vrfCRD)
  })

  // Create NetworkPolicy CRDs
  config.globalPolicies.forEach(policy => {
    const policyCRD = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policy.name,
        namespace: config.metadata.namespace || 'default'
      },
      spec: {
        priority: policy.priority,
        rules: policy.rules,
        appliedTo: policy.appliedTo,
        ...(policy.description && { description: policy.description })
      }
    }

    crds.push(policyCRD)
  })

  return crds
}

/**
 * Prepare VPC config for export (clean up internals)
 */
function prepareVPCConfigForExport(
  config: VPCConfiguration, 
  options: VPCExportOptions
): VPCConfiguration {
  const exportConfig: VPCConfiguration = JSON.parse(JSON.stringify(config))

  if (!options.includeProvenance) {
    removeProvenanceFields(exportConfig)
  }

  if (!options.includeDefaults) {
    removeDefaultValues(exportConfig)
  }

  return exportConfig
}

/**
 * Add import provenance to all fields
 */
function addImportProvenance(config: VPCConfiguration, source: string) {
  config.provenance = createFieldProvenance('import', source)
  
  config.networks.forEach(network => {
    network.provenance = createFieldProvenance('import', source)
    network.subnets.forEach(subnet => {
      subnet.provenance = createFieldProvenance('import', source)
      if (subnet.dhcp) {
        subnet.dhcp.provenance = createFieldProvenance('import', source)
      }
    })
  })

  config.vrfs.forEach(vrf => {
    vrf.provenance = createFieldProvenance('import', source)
  })

  config.globalPolicies.forEach(policy => {
    policy.provenance = createFieldProvenance('import', source)
    policy.rules.forEach(rule => {
      rule.provenance = createFieldProvenance('import', source)
    })
  })
}

/**
 * Remove provenance fields for clean export
 */
function removeProvenanceFields(obj: any): void {
  if (obj && typeof obj === 'object') {
    delete obj.provenance
    
    if (Array.isArray(obj)) {
      obj.forEach(removeProvenanceFields)
    } else {
      Object.values(obj).forEach(removeProvenanceFields)
    }
  }
}

/**
 * Remove default values for cleaner export
 */
function removeDefaultValues(config: VPCConfiguration): void {
  // Remove empty arrays and undefined values
  config.networks = config.networks.filter(network => network.name && network.cidr)
  config.vrfs = config.vrfs.filter(vrf => vrf.name && vrf.routeDistinguisher)
  config.globalPolicies = config.globalPolicies.filter(policy => policy.name && policy.rules.length > 0)
}

/**
 * Clean default values from object
 */
function cleanDefaultValues(obj: any): void {
  Object.keys(obj).forEach(key => {
    if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
      delete obj[key]
    }
  })
}

/**
 * Validate and normalize VPC configuration
 */
function validateAndNormalizeVPCConfig(data: any): VPCConfiguration {
  // Basic structure validation
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid configuration structure')
  }

  return {
    metadata: {
      name: data.metadata?.name || 'vpc-config',
      namespace: data.metadata?.namespace || 'default',
      ...data.metadata
    },
    networks: Array.isArray(data.networks) ? data.networks : [],
    vrfs: Array.isArray(data.vrfs) ? data.vrfs : [],
    globalPolicies: Array.isArray(data.globalPolicies) ? data.globalPolicies : [],
    provenance: createFieldProvenance('import', 'direct')
  }
}

/**
 * Determine VPC policy type from K8s policy spec
 */
function determineVPCPolicyType(spec: any): 'security' | 'routing' | 'qos' {
  if (spec.ingress || spec.egress) return 'security'
  if (spec.routes) return 'routing'
  return 'qos'
}

/**
 * Transform K8s policy rules to VPC policy rules
 */
function transformK8sPolicyRules(k8sRules: any[]): any[] {
  return k8sRules.map((rule, index) => ({
    id: `rule-${index}`,
    action: rule.action || 'allow',
    protocol: rule.protocol || 'tcp',
    sourceNet: rule.from?.[0]?.namespaceSelector ? 'any' : rule.from?.[0]?.podSelector,
    destNet: rule.to?.[0]?.namespaceSelector ? 'any' : rule.to?.[0]?.podSelector,
    sourcePorts: rule.ports?.[0]?.port?.toString(),
    destPorts: rule.ports?.[0]?.port?.toString(),
    priority: rule.priority || 1000,
    provenance: createFieldProvenance('import', 'k8s-crd')
  }))
}

/**
 * Validate exported content
 */
function validateExportedContent(content: string, format: string): string[] {
  const warnings: string[] = []

  if (!content) {
    warnings.push('Empty export content')
    return warnings
  }

  try {
    switch (format) {
      case 'json':
        JSON.parse(content)
        break
      case 'yaml':
      case 'k8s-crd':
        yamlLoad(content)
        break
    }
  } catch (error) {
    warnings.push(`Invalid ${format} format: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return warnings
}

/**
 * Export presets for common scenarios
 */
export const VPC_EXPORT_PRESETS = {
  kubernetes: {
    format: 'k8s-crd' as const,
    includeDefaults: false,
    includeProvenance: false,
    validate: true
  },
  backup: {
    format: 'yaml' as const,
    includeDefaults: true,
    includeProvenance: true,
    validate: true
  },
  sharing: {
    format: 'json' as const,
    includeDefaults: false,
    includeProvenance: false,
    validate: true
  }
}