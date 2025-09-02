import * as yaml from 'js-yaml'
import type { VPC, VPCAttachment, VPCPeering, External, ExternalAttachment, ExternalPeering } from '../upstream/types/generated'

export interface VPCYAMLs {
  vpcs: string
  vpcAttachments: string
  vpcPeerings: string
  externals: string
  externalAttachments: string
  externalPeerings: string
}

export interface VPCYAMLConfig {
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    defaultIsolated?: boolean
    defaultRestricted?: boolean
    ipv4Namespace?: string
    vlanNamespace?: string
    mode?: string
    subnets: Record<string, {
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
    }>
    permit?: string[][]
    staticRoutes?: Array<{
      destination: string
      nextHop: string
      metric?: number
    }>
  }
}

export interface VPCDeploymentConfig {
  vpcs: VPCYAMLConfig[]
  vpcAttachments: Array<{
    metadata: { name: string; namespace?: string }
    spec: {
      connection?: string
      subnet?: string
      nativeVLAN?: boolean
    }
  }>
  vpcPeerings: Array<{
    metadata: { name: string; namespace?: string }
    spec: {
      remote?: string
      permit?: Array<{
        localSubnets: string[]
        remoteSubnets: string[]
        bidirectional?: boolean
      }>
    }
  }>
  externals: Array<{
    metadata: { name: string; namespace?: string }
    spec: {
      ipv4Namespace?: string
      inboundCommunity?: string
      outboundCommunity?: string
    }
  }>
  externalAttachments: Array<{
    metadata: { name: string; namespace?: string }
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
  }>
  externalPeerings: Array<{
    metadata: { name: string; namespace?: string }
    spec: {
      permit?: {
        vpc?: string
        external?: string
        vpcSubnets?: string[]
        externalPrefixes?: string[]
      }
    }
  }>
}

export interface VPCSerializationOptions {
  namespace?: string
  generateK8sMetadata?: boolean
  includeStatus?: boolean
  apiVersionOverride?: {
    vpc?: string
    vpcAttachment?: string
    vpcPeering?: string
    external?: string
    externalAttachment?: string
    externalPeering?: string
  }
}

/**
 * Convert VPC configuration to CRD-compliant YAML structure
 * Generates separate CRD YAML documents for each VPC resource type
 */
export function serializeVPCConfigToCRDs(
  config: VPCDeploymentConfig,
  options: VPCSerializationOptions = {}
): VPCYAMLs {
  const opts = {
    namespace: 'default',
    generateK8sMetadata: true,
    includeStatus: false,
    ...options
  }

  return {
    vpcs: serializeVPCs(config.vpcs, opts),
    vpcAttachments: serializeVPCAttachments(config.vpcAttachments, opts),
    vpcPeerings: serializeVPCPeerings(config.vpcPeerings, opts),
    externals: serializeExternals(config.externals, opts),
    externalAttachments: serializeExternalAttachments(config.externalAttachments, opts),
    externalPeerings: serializeExternalPeerings(config.externalPeerings, opts)
  }
}

function serializeVPCs(vpcs: VPCYAMLConfig[], options: VPCSerializationOptions): string {
  const crdVPCs = vpcs.map(vpc => convertToVPCCRD(vpc, options))
  return serializeK8sResourceArray(crdVPCs)
}

function serializeVPCAttachments(attachments: VPCDeploymentConfig['vpcAttachments'], options: VPCSerializationOptions): string {
  const crdAttachments = attachments.map(attachment => convertToVPCAttachmentCRD(attachment, options))
  return serializeK8sResourceArray(crdAttachments)
}

function serializeVPCPeerings(peerings: VPCDeploymentConfig['vpcPeerings'], options: VPCSerializationOptions): string {
  const crdPeerings = peerings.map(peering => convertToVPCPeeringCRD(peering, options))
  return serializeK8sResourceArray(crdPeerings)
}

function serializeExternals(externals: VPCDeploymentConfig['externals'], options: VPCSerializationOptions): string {
  const crdExternals = externals.map(external => convertToExternalCRD(external, options))
  return serializeK8sResourceArray(crdExternals)
}

function serializeExternalAttachments(attachments: VPCDeploymentConfig['externalAttachments'], options: VPCSerializationOptions): string {
  const crdAttachments = attachments.map(attachment => convertToExternalAttachmentCRD(attachment, options))
  return serializeK8sResourceArray(crdAttachments)
}

function serializeExternalPeerings(peerings: VPCDeploymentConfig['externalPeerings'], options: VPCSerializationOptions): string {
  const crdPeerings = peerings.map(peering => convertToExternalPeeringCRD(peering, options))
  return serializeK8sResourceArray(crdPeerings)
}

function convertToVPCCRD(vpc: VPCYAMLConfig, options: VPCSerializationOptions): VPC {
  return {
    apiVersion: options.apiVersionOverride?.vpc || 'vpc.githedgehog.com/v1alpha2',
    kind: 'VPC',
    metadata: {
      name: vpc.metadata.name,
      namespace: vpc.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-vpc',
          'app.kubernetes.io/component': 'network-vpc',
          'hnc.githedgehog.com/vpc': vpc.metadata.name,
          ...vpc.metadata.labels
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString(),
          'hnc.githedgehog.com/subnet-count': Object.keys(vpc.spec.subnets).length.toString(),
          ...vpc.metadata.annotations
        }
      })
    },
    spec: {
      defaultIsolated: vpc.spec.defaultIsolated,
      defaultRestricted: vpc.spec.defaultRestricted,
      ipv4Namespace: vpc.spec.ipv4Namespace,
      vlanNamespace: vpc.spec.vlanNamespace,
      mode: vpc.spec.mode,
      subnets: convertSubnetsToK8sFormat(vpc.spec.subnets),
      permit: vpc.spec.permit,
      staticRoutes: vpc.spec.staticRoutes?.map(route => ({
        destination: route.destination,
        nextHop: route.nextHop,
        ...(route.metric && { metric: route.metric })
      }))
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertToVPCAttachmentCRD(attachment: VPCDeploymentConfig['vpcAttachments'][0], options: VPCSerializationOptions): VPCAttachment {
  return {
    apiVersion: options.apiVersionOverride?.vpcAttachment || 'vpc.githedgehog.com/v1alpha2',
    kind: 'VPCAttachment',
    metadata: {
      name: attachment.metadata.name,
      namespace: attachment.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-vpc-attachment',
          'app.kubernetes.io/component': 'network-attachment',
          ...(attachment.spec.connection && { 'hnc.githedgehog.com/connection': attachment.spec.connection }),
          ...(attachment.spec.subnet && { 'hnc.githedgehog.com/subnet': attachment.spec.subnet })
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString()
        }
      })
    },
    spec: {
      connection: attachment.spec.connection,
      subnet: attachment.spec.subnet,
      nativeVLAN: attachment.spec.nativeVLAN
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertToVPCPeeringCRD(peering: VPCDeploymentConfig['vpcPeerings'][0], options: VPCSerializationOptions): VPCPeering {
  return {
    apiVersion: options.apiVersionOverride?.vpcPeering || 'vpc.githedgehog.com/v1alpha2',
    kind: 'VPCPeering',
    metadata: {
      name: peering.metadata.name,
      namespace: peering.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-vpc-peering',
          'app.kubernetes.io/component': 'network-peering',
          ...(peering.spec.remote && { 'hnc.githedgehog.com/remote-vpc': peering.spec.remote })
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString(),
          'hnc.githedgehog.com/permit-count': (peering.spec.permit?.length || 0).toString()
        }
      })
    },
    spec: {
      remote: peering.spec.remote,
      permit: peering.spec.permit?.map(p => ({
        local: p.localSubnets,
        remote: p.remoteSubnets,
        ...(p.bidirectional !== undefined && { bidirectional: p.bidirectional })
      }))
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertToExternalCRD(external: VPCDeploymentConfig['externals'][0], options: VPCSerializationOptions): External {
  return {
    apiVersion: options.apiVersionOverride?.external || 'vpc.githedgehog.com/v1alpha2',
    kind: 'External',
    metadata: {
      name: external.metadata.name,
      namespace: external.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-external',
          'app.kubernetes.io/component': 'external-network'
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString()
        }
      })
    },
    spec: {
      ipv4Namespace: external.spec.ipv4Namespace,
      inboundCommunity: external.spec.inboundCommunity,
      outboundCommunity: external.spec.outboundCommunity
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertToExternalAttachmentCRD(attachment: VPCDeploymentConfig['externalAttachments'][0], options: VPCSerializationOptions): ExternalAttachment {
  return {
    apiVersion: options.apiVersionOverride?.externalAttachment || 'vpc.githedgehog.com/v1alpha2',
    kind: 'ExternalAttachment',
    metadata: {
      name: attachment.metadata.name,
      namespace: attachment.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-external-attachment',
          'app.kubernetes.io/component': 'external-attachment',
          ...(attachment.spec.connection && { 'hnc.githedgehog.com/connection': attachment.spec.connection }),
          ...(attachment.spec.external && { 'hnc.githedgehog.com/external': attachment.spec.external })
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString()
        }
      })
    },
    spec: {
      connection: attachment.spec.connection,
      external: attachment.spec.external,
      neighbor: attachment.spec.neighbor ? {
        asn: attachment.spec.neighbor.asn,
        ip: attachment.spec.neighbor.ip,
        ...(attachment.spec.neighbor.password && { password: attachment.spec.neighbor.password })
      } : undefined,
      switch: attachment.spec.switch ? {
        ip: attachment.spec.switch.ip,
        asn: attachment.spec.switch.asn
      } : undefined
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertToExternalPeeringCRD(peering: VPCDeploymentConfig['externalPeerings'][0], options: VPCSerializationOptions): ExternalPeering {
  return {
    apiVersion: options.apiVersionOverride?.externalPeering || 'vpc.githedgehog.com/v1alpha2',
    kind: 'ExternalPeering',
    metadata: {
      name: peering.metadata.name,
      namespace: peering.metadata.namespace || options.namespace || 'default',
      ...(options.generateK8sMetadata && {
        labels: {
          'app.kubernetes.io/name': 'hnc-external-peering',
          'app.kubernetes.io/component': 'external-peering',
          ...(peering.spec.permit?.vpc && { 'hnc.githedgehog.com/vpc': peering.spec.permit.vpc }),
          ...(peering.spec.permit?.external && { 'hnc.githedgehog.com/external': peering.spec.permit.external })
        },
        annotations: {
          'hnc.githedgehog.com/generated-at': new Date().toISOString()
        }
      })
    },
    spec: {
      permit: peering.spec.permit ? {
        vpc: peering.spec.permit.vpc,
        external: peering.spec.permit.external,
        vpcSubnets: peering.spec.permit.vpcSubnets,
        externalPrefixes: peering.spec.permit.externalPrefixes
      } : undefined
    },
    ...(options.includeStatus && {
      status: {}
    })
  }
}

function convertSubnetsToK8sFormat(subnets: VPCYAMLConfig['spec']['subnets']): Record<string, any> {
  const result: Record<string, any> = {}
  
  Object.entries(subnets).forEach(([name, subnet]) => {
    result[name] = {
      cidr: subnet.cidr,
      ...(subnet.gateway && { gateway: subnet.gateway }),
      ...(subnet.vlan && { vlan: subnet.vlan }),
      ...(subnet.isolated !== undefined && { isolated: subnet.isolated }),
      ...(subnet.restricted !== undefined && { restricted: subnet.restricted }),
      ...(subnet.dhcp && {
        dhcp: {
          enable: subnet.dhcp.enable,
          ...(subnet.dhcp.start && { start: subnet.dhcp.start }),
          ...(subnet.dhcp.end && { end: subnet.dhcp.end })
        }
      })
    }
  })
  
  return result
}

/**
 * Deserialize CRD YAML structure back to VPC configuration
 */
export function deserializeCRDsToVPCConfig(yamls: VPCYAMLs): VPCDeploymentConfig {
  try {
    const vpcs = parseMultiDocumentYAML<VPC>(yamls.vpcs).map(convertFromVPCCRD)
    const vpcAttachments = parseMultiDocumentYAML<VPCAttachment>(yamls.vpcAttachments).map(convertFromVPCAttachmentCRD)
    const vpcPeerings = parseMultiDocumentYAML<VPCPeering>(yamls.vpcPeerings).map(convertFromVPCPeeringCRD)
    const externals = parseMultiDocumentYAML<External>(yamls.externals).map(convertFromExternalCRD)
    const externalAttachments = parseMultiDocumentYAML<ExternalAttachment>(yamls.externalAttachments).map(convertFromExternalAttachmentCRD)
    const externalPeerings = parseMultiDocumentYAML<ExternalPeering>(yamls.externalPeerings).map(convertFromExternalPeeringCRD)

    return {
      vpcs,
      vpcAttachments,
      vpcPeerings,
      externals,
      externalAttachments,
      externalPeerings
    }
  } catch (error) {
    throw new Error(`Failed to deserialize VPC CRD YAML: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function convertFromVPCCRD(vpc: VPC): VPCYAMLConfig {
  return {
    metadata: {
      name: vpc.metadata.name || '',
      namespace: vpc.metadata.namespace,
      labels: vpc.metadata.labels,
      annotations: vpc.metadata.annotations
    },
    spec: {
      defaultIsolated: vpc.spec.defaultIsolated,
      defaultRestricted: vpc.spec.defaultRestricted,
      ipv4Namespace: vpc.spec.ipv4Namespace,
      vlanNamespace: vpc.spec.vlanNamespace,
      mode: vpc.spec.mode,
      subnets: convertSubnetsFromK8sFormat(vpc.spec.subnets || {}),
      permit: vpc.spec.permit,
      staticRoutes: vpc.spec.staticRoutes?.map(route => ({
        destination: route.destination,
        nextHop: route.nextHop,
        metric: route.metric
      }))
    }
  }
}

function convertFromVPCAttachmentCRD(attachment: VPCAttachment): VPCDeploymentConfig['vpcAttachments'][0] {
  return {
    metadata: {
      name: attachment.metadata.name || '',
      namespace: attachment.metadata.namespace
    },
    spec: {
      connection: attachment.spec.connection,
      subnet: attachment.spec.subnet,
      nativeVLAN: attachment.spec.nativeVLAN
    }
  }
}

function convertFromVPCPeeringCRD(peering: VPCPeering): VPCDeploymentConfig['vpcPeerings'][0] {
  return {
    metadata: {
      name: peering.metadata.name || '',
      namespace: peering.metadata.namespace
    },
    spec: {
      remote: peering.spec.remote,
      permit: peering.spec.permit?.map(p => ({
        localSubnets: Array.isArray(p.local) ? p.local : [],
        remoteSubnets: Array.isArray(p.remote) ? p.remote : [],
        bidirectional: p.bidirectional
      }))
    }
  }
}

function convertFromExternalCRD(external: External): VPCDeploymentConfig['externals'][0] {
  return {
    metadata: {
      name: external.metadata.name || '',
      namespace: external.metadata.namespace
    },
    spec: {
      ipv4Namespace: external.spec.ipv4Namespace,
      inboundCommunity: external.spec.inboundCommunity,
      outboundCommunity: external.spec.outboundCommunity
    }
  }
}

function convertFromExternalAttachmentCRD(attachment: ExternalAttachment): VPCDeploymentConfig['externalAttachments'][0] {
  return {
    metadata: {
      name: attachment.metadata.name || '',
      namespace: attachment.metadata.namespace
    },
    spec: {
      connection: attachment.spec.connection,
      external: attachment.spec.external,
      neighbor: attachment.spec.neighbor ? {
        asn: attachment.spec.neighbor.asn,
        ip: attachment.spec.neighbor.ip,
        password: attachment.spec.neighbor.password
      } : undefined,
      switch: attachment.spec.switch ? {
        ip: attachment.spec.switch.ip,
        asn: attachment.spec.switch.asn
      } : undefined
    }
  }
}

function convertFromExternalPeeringCRD(peering: ExternalPeering): VPCDeploymentConfig['externalPeerings'][0] {
  return {
    metadata: {
      name: peering.metadata.name || '',
      namespace: peering.metadata.namespace
    },
    spec: {
      permit: peering.spec.permit ? {
        vpc: peering.spec.permit.vpc,
        external: peering.spec.permit.external,
        vpcSubnets: peering.spec.permit.vpcSubnets,
        externalPrefixes: peering.spec.permit.externalPrefixes
      } : undefined
    }
  }
}

function convertSubnetsFromK8sFormat(subnets: Record<string, any>): VPCYAMLConfig['spec']['subnets'] {
  const result: VPCYAMLConfig['spec']['subnets'] = {}
  
  Object.entries(subnets).forEach(([name, subnet]) => {
    result[name] = {
      cidr: subnet.cidr || '',
      gateway: subnet.gateway,
      vlan: subnet.vlan,
      isolated: subnet.isolated,
      restricted: subnet.restricted,
      dhcp: subnet.dhcp ? {
        enable: subnet.dhcp.enable || false,
        start: subnet.dhcp.start,
        end: subnet.dhcp.end
      } : undefined
    }
  })
  
  return result
}

function parseMultiDocumentYAML<T>(yamlContent: string): T[] {
  if (!yamlContent.trim()) {
    return []
  }
  
  if (yamlContent.includes('---')) {
    return (yaml.loadAll(yamlContent) as T[]).filter(doc => doc != null)
  } else {
    const doc = yaml.load(yamlContent) as T
    return doc ? [doc] : []
  }
}

function serializeK8sResource(resource: any): string {
  return yaml.dump(resource, {
    sortKeys: true,
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
    noRefs: true
  })
}

function serializeK8sResourceArray(resources: any[]): string {
  if (resources.length === 0) {
    return ''
  }
  
  return resources.map(resource => 
    yaml.dump(resource, {
      sortKeys: true,
      indent: 2,
      lineWidth: 120,
      quotingType: '"',
      noRefs: true
    })
  ).join('---\n')
}

/**
 * Validate VPC configuration for common issues
 */
export function validateVPCConfiguration(config: VPCDeploymentConfig): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate VPCs
  config.vpcs.forEach((vpc, index) => {
    if (!vpc.metadata.name) {
      errors.push(`VPC ${index}: Name is required`)
    }
    
    if (!vpc.spec.subnets || Object.keys(vpc.spec.subnets).length === 0) {
      errors.push(`VPC ${vpc.metadata.name}: At least one subnet is required`)
    }

    // Validate CIDR ranges
    Object.entries(vpc.spec.subnets || {}).forEach(([subnetName, subnet]) => {
      if (!subnet.cidr || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet.cidr)) {
        errors.push(`VPC ${vpc.metadata.name}, subnet ${subnetName}: Invalid CIDR format`)
      }
    })
  })

  // Validate VPC Attachments
  config.vpcAttachments.forEach((attachment, index) => {
    if (!attachment.spec.connection) {
      errors.push(`VPC Attachment ${attachment.metadata.name || index}: Connection is required`)
    }
    if (!attachment.spec.subnet) {
      errors.push(`VPC Attachment ${attachment.metadata.name || index}: Subnet is required`)
    }
    if (attachment.spec.subnet && !/^[\w-]+\/[\w-]+$/.test(attachment.spec.subnet)) {
      warnings.push(`VPC Attachment ${attachment.metadata.name || index}: Subnet format should be "vpc-name/subnet-name"`)
    }
  })

  // Validate VPC Peerings
  config.vpcPeerings.forEach((peering, index) => {
    if (!peering.spec.remote) {
      errors.push(`VPC Peering ${peering.metadata.name || index}: Remote VPC is required`)
    }
    if (!peering.spec.permit || peering.spec.permit.length === 0) {
      errors.push(`VPC Peering ${peering.metadata.name || index}: At least one permit policy is required`)
    }
  })

  // Validate External Attachments
  config.externalAttachments.forEach((attachment, index) => {
    if (!attachment.spec.neighbor?.ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(attachment.spec.neighbor.ip)) {
      errors.push(`External Attachment ${attachment.metadata.name || index}: Valid neighbor IP is required`)
    }
    if (!attachment.spec.neighbor?.asn) {
      errors.push(`External Attachment ${attachment.metadata.name || index}: Neighbor ASN is required`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Generate a complete VPC deployment example
 */
export function generateSampleVPCDeployment(): VPCDeploymentConfig {
  return {
    vpcs: [
      {
        metadata: {
          name: 'prod-vpc',
          labels: { 'environment': 'production' }
        },
        spec: {
          defaultIsolated: false,
          defaultRestricted: false,
          ipv4Namespace: 'default',
          vlanNamespace: 'default',
          mode: 'default',
          subnets: {
            'web': {
              cidr: '10.1.1.0/24',
              gateway: '10.1.1.1',
              isolated: false
            },
            'app': {
              cidr: '10.1.2.0/24',
              gateway: '10.1.2.1',
              isolated: true
            },
            'db': {
              cidr: '10.1.3.0/24',
              gateway: '10.1.3.1',
              isolated: true,
              restricted: true
            }
          },
          permit: [
            ['web', 'app'],
            ['app', 'db']
          ]
        }
      }
    ],
    vpcAttachments: [
      {
        metadata: { name: 'web-servers-attachment' },
        spec: {
          connection: 'web-server-connection',
          subnet: 'prod-vpc/web',
          nativeVLAN: false
        }
      }
    ],
    vpcPeerings: [
      {
        metadata: { name: 'prod-dev-peering' },
        spec: {
          remote: 'dev-vpc',
          permit: [
            {
              localSubnets: ['prod-vpc/web'],
              remoteSubnets: ['dev-vpc/test'],
              bidirectional: true
            }
          ]
        }
      }
    ],
    externals: [
      {
        metadata: { name: 'internet-gateway' },
        spec: {
          ipv4Namespace: 'default',
          inboundCommunity: '65102:5000',
          outboundCommunity: '50000:50001'
        }
      }
    ],
    externalAttachments: [
      {
        metadata: { name: 'internet-attachment' },
        spec: {
          connection: 'border-connection',
          external: 'internet-gateway',
          neighbor: {
            asn: 65100,
            ip: '192.168.1.1'
          },
          switch: {
            ip: '10.0.0.1',
            asn: 65000
          }
        }
      }
    ],
    externalPeerings: [
      {
        metadata: { name: 'internet-peering' },
        spec: {
          permit: {
            vpc: 'prod-vpc',
            external: 'internet-gateway',
            vpcSubnets: ['prod-vpc/web'],
            externalPrefixes: ['0.0.0.0/0']
          }
        }
      }
    ]
  }
}