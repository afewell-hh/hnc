import { describe, it, expect } from 'vitest'
import { 
  serializeVPCConfigToCRDs, 
  deserializeCRDsToVPCConfig, 
  validateVPCConfiguration,
  generateSampleVPCDeployment,
  type VPCDeploymentConfig 
} from '../../src/io/vpc-yaml'

describe('vpc-yaml', () => {
  const sampleConfig: VPCDeploymentConfig = {
    vpcs: [
      {
        metadata: {
          name: 'test-vpc',
          labels: { env: 'test' },
          annotations: { 'created-by': 'test-suite' }
        },
        spec: {
          defaultIsolated: false,
          defaultRestricted: false,
          ipv4Namespace: 'default',
          vlanNamespace: 'default',
          mode: 'default',
          subnets: {
            'web': {
              name: 'web',
              cidr: '10.1.1.0/24',
              gateway: '10.1.1.1',
              isolated: false,
              restricted: false
            },
            'app': {
              name: 'app',
              cidr: '10.1.2.0/24',
              gateway: '10.1.2.1',
              isolated: true,
              restricted: false
            }
          },
          permit: [['web', 'app']],
          staticRoutes: [
            {
              destination: '0.0.0.0/0',
              nextHop: '10.1.0.1',
              metric: 100
            }
          ]
        }
      }
    ],
    vpcAttachments: [
      {
        metadata: { name: 'web-attachment' },
        spec: {
          connection: 'web-connection',
          subnet: 'test-vpc/web',
          nativeVLAN: false
        }
      }
    ],
    vpcPeerings: [
      {
        metadata: { name: 'test-peering' },
        spec: {
          remote: 'remote-vpc',
          permit: [
            {
              localSubnets: ['test-vpc/web'],
              remoteSubnets: ['remote-vpc/public'],
              bidirectional: true
            }
          ]
        }
      }
    ],
    externals: [
      {
        metadata: { name: 'internet' },
        spec: {
          ipv4Namespace: 'default',
          inboundCommunity: '65102:5000',
          outboundCommunity: '50000:50001'
        }
      }
    ],
    externalAttachments: [
      {
        metadata: { name: 'bgp-attachment' },
        spec: {
          connection: 'border-connection',
          external: 'internet',
          neighbor: {
            asn: 65100,
            ip: '192.168.1.1',
            password: 'bgp-secret'
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
            vpc: 'test-vpc',
            external: 'internet',
            vpcSubnets: ['test-vpc/web'],
            externalPrefixes: ['0.0.0.0/0']
          }
        }
      }
    ]
  }

  describe('serializeVPCConfigToCRDs', () => {
    it('serializes VPC configuration to CRD YAML', () => {
      const result = serializeVPCConfigToCRDs(sampleConfig)

      expect(result).toHaveProperty('vpcs')
      expect(result).toHaveProperty('vpcAttachments')
      expect(result).toHaveProperty('vpcPeerings')
      expect(result).toHaveProperty('externals')
      expect(result).toHaveProperty('externalAttachments')
      expect(result).toHaveProperty('externalPeerings')

      // Check VPC YAML structure
      expect(result.vpcs).toContain('apiVersion: "vpc.githedgehog.com/v1alpha2"')
      expect(result.vpcs).toContain('kind: "VPC"')
      expect(result.vpcs).toContain('name: "test-vpc"')

      // Check subnet serialization
      expect(result.vpcs).toContain('web:')
      expect(result.vpcs).toContain('cidr: "10.1.1.0/24"')
      expect(result.vpcs).toContain('gateway: "10.1.1.1"')

      // Check static routes
      expect(result.vpcs).toContain('destination: "0.0.0.0/0"')
      expect(result.vpcs).toContain('nextHop: "10.1.0.1"')
      expect(result.vpcs).toContain('metric: 100')
    })

    it('includes K8s metadata when generateK8sMetadata is true', () => {
      const result = serializeVPCConfigToCRDs(sampleConfig, {
        generateK8sMetadata: true
      })

      expect(result.vpcs).toContain('app.kubernetes.io/name: "hnc-vpc"')
      expect(result.vpcs).toContain('hnc.githedgehog.com/vpc: "test-vpc"')
      expect(result.vpcs).toContain('hnc.githedgehog.com/generated-at:')
    })

    it('serializes VPC attachments correctly', () => {
      const result = serializeVPCConfigToCRDs(sampleConfig)

      expect(result.vpcAttachments).toContain('kind: "VPCAttachment"')
      expect(result.vpcAttachments).toContain('name: "web-attachment"')
      expect(result.vpcAttachments).toContain('connection: "web-connection"')
      expect(result.vpcAttachments).toContain('subnet: "test-vpc/web"')
      expect(result.vpcAttachments).toContain('nativeVLAN: false')
    })

    it('serializes VPC peerings correctly', () => {
      const result = serializeVPCConfigToCRDs(sampleConfig)

      expect(result.vpcPeerings).toContain('kind: "VPCPeering"')
      expect(result.vpcPeerings).toContain('name: "test-peering"')
      expect(result.vpcPeerings).toContain('remote: "remote-vpc"')
      expect(result.vpcPeerings).toContain('- "test-vpc/web"')
      expect(result.vpcPeerings).toContain('- "remote-vpc/public"')
    })

    it('serializes external configurations correctly', () => {
      const result = serializeVPCConfigToCRDs(sampleConfig)

      expect(result.externals).toContain('kind: "External"')
      expect(result.externals).toContain('name: "internet"')
      expect(result.externals).toContain('inboundCommunity: "65102:5000"')
      expect(result.externals).toContain('outboundCommunity: "50000:50001"')

      expect(result.externalAttachments).toContain('kind: "ExternalAttachment"')
      expect(result.externalAttachments).toContain('asn: 65100')
      expect(result.externalAttachments).toContain('ip: "192.168.1.1"')

      expect(result.externalPeerings).toContain('kind: "ExternalPeering"')
      expect(result.externalPeerings).toContain('vpc: "test-vpc"')
      expect(result.externalPeerings).toContain('external: "internet"')
    })
  })

  describe('deserializeCRDsToVPCConfig', () => {
    it('deserializes CRD YAML back to VPC configuration', () => {
      const yamls = serializeVPCConfigToCRDs(sampleConfig)
      const result = deserializeCRDsToVPCConfig(yamls)

      expect(result).toHaveProperty('vpcs')
      expect(result).toHaveProperty('vpcAttachments')
      expect(result).toHaveProperty('vpcPeerings')
      expect(result).toHaveProperty('externals')
      expect(result).toHaveProperty('externalAttachments')
      expect(result).toHaveProperty('externalPeerings')

      // Check VPC deserialization
      expect(result.vpcs).toHaveLength(1)
      expect(result.vpcs[0].metadata.name).toBe('test-vpc')
      expect(result.vpcs[0].spec.subnets.web.cidr).toBe('10.1.1.0/24')
      expect(result.vpcs[0].spec.staticRoutes).toHaveLength(1)
      expect(result.vpcs[0].spec.staticRoutes?.[0].destination).toBe('0.0.0.0/0')

      // Check attachment deserialization
      expect(result.vpcAttachments).toHaveLength(1)
      expect(result.vpcAttachments[0].metadata.name).toBe('web-attachment')
      expect(result.vpcAttachments[0].spec.subnet).toBe('test-vpc/web')

      // Check peering deserialization
      expect(result.vpcPeerings).toHaveLength(1)
      expect(result.vpcPeerings[0].spec.remote).toBe('remote-vpc')
      expect(result.vpcPeerings[0].spec.permit?.[0].localSubnets).toContain('test-vpc/web')
    })

    it('handles round-trip serialization correctly', () => {
      const yamls = serializeVPCConfigToCRDs(sampleConfig)
      const roundTripped = deserializeCRDsToVPCConfig(yamls)
      const yamls2 = serializeVPCConfigToCRDs(roundTripped)

      // The YAML should be semantically equivalent
      expect(yamls2.vpcs).toContain('name: "test-vpc"')
      expect(yamls2.vpcs).toContain('cidr: "10.1.1.0/24"')
      expect(yamls2.vpcAttachments).toContain('subnet: "test-vpc/web"')
    })
  })

  describe('validateVPCConfiguration', () => {
    it('validates correct VPC configuration', () => {
      const result = validateVPCConfiguration(sampleConfig)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects invalid VPC names', () => {
      const invalidConfig = {
        ...sampleConfig,
        vpcs: [
          {
            ...sampleConfig.vpcs[0],
            metadata: { ...sampleConfig.vpcs[0].metadata, name: '' }
          }
        ]
      }

      const result = validateVPCConfiguration(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('VPC 0: Name is required')
    })

    it('detects invalid CIDR formats', () => {
      const invalidConfig = {
        ...sampleConfig,
        vpcs: [
          {
            ...sampleConfig.vpcs[0],
            spec: {
              ...sampleConfig.vpcs[0].spec,
              subnets: {
                'invalid': {
                  name: 'invalid',
                  cidr: 'not-a-cidr',
                  gateway: '10.1.1.1',
                  isolated: false,
                  restricted: false
                }
              }
            }
          }
        ]
      }

      const result = validateVPCConfiguration(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('VPC test-vpc, subnet invalid: Invalid CIDR format')
    })

    it('detects missing VPC attachment requirements', () => {
      const invalidConfig = {
        ...sampleConfig,
        vpcAttachments: [
          {
            metadata: { name: 'invalid-attachment' },
            spec: {
              connection: '',
              subnet: '',
              nativeVLAN: false
            }
          }
        ]
      }

      const result = validateVPCConfiguration(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('VPC Attachment invalid-attachment: Connection is required')
      expect(result.errors).toContain('VPC Attachment invalid-attachment: Subnet is required')
    })

    it('detects invalid subnet format in attachments', () => {
      const invalidConfig = {
        ...sampleConfig,
        vpcAttachments: [
          {
            metadata: { name: 'invalid-attachment' },
            spec: {
              connection: 'conn-1',
              subnet: 'invalid-format',
              nativeVLAN: false
            }
          }
        ]
      }

      const result = validateVPCConfiguration(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.warnings).toContain('VPC Attachment invalid-attachment: Subnet format should be "vpc-name/subnet-name"')
    })

    it('detects invalid BGP neighbor configuration', () => {
      const invalidConfig = {
        ...sampleConfig,
        externalAttachments: [
          {
            metadata: { name: 'invalid-bgp' },
            spec: {
              connection: 'border-conn',
              external: 'internet',
              neighbor: {
                asn: 0, // Invalid ASN
                ip: 'not-an-ip', // Invalid IP
              },
              switch: {
                ip: '10.0.0.1',
                asn: 65000
              }
            }
          }
        ]
      }

      const result = validateVPCConfiguration(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('External Attachment invalid-bgp: Valid neighbor IP is required')
      expect(result.errors).toContain('External Attachment invalid-bgp: Neighbor ASN is required')
    })
  })

  describe('generateSampleVPCDeployment', () => {
    it('generates a complete sample VPC deployment', () => {
      const sample = generateSampleVPCDeployment()

      expect(sample).toHaveProperty('vpcs')
      expect(sample).toHaveProperty('vpcAttachments')
      expect(sample).toHaveProperty('vpcPeerings')
      expect(sample).toHaveProperty('externals')
      expect(sample).toHaveProperty('externalAttachments')
      expect(sample).toHaveProperty('externalPeerings')

      // Check sample has reasonable content
      expect(sample.vpcs).toHaveLength(1)
      expect(sample.vpcs[0].metadata.name).toBe('prod-vpc')
      expect(sample.vpcs[0].spec.subnets).toHaveProperty('web')
      expect(sample.vpcs[0].spec.subnets).toHaveProperty('app')
      expect(sample.vpcs[0].spec.subnets).toHaveProperty('db')

      expect(sample.vpcAttachments).toHaveLength(1)
      expect(sample.vpcPeerings).toHaveLength(1)
      expect(sample.externals).toHaveLength(1)
      expect(sample.externalAttachments).toHaveLength(1)
      expect(sample.externalPeerings).toHaveLength(1)
    })

    it('generates valid configuration that passes validation', () => {
      const sample = generateSampleVPCDeployment()
      const validation = validateVPCConfiguration(sample)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty YAML gracefully', () => {
      const emptyYamls = {
        vpcs: '',
        vpcAttachments: '',
        vpcPeerings: '',
        externals: '',
        externalAttachments: '',
        externalPeerings: ''
      }

      const result = deserializeCRDsToVPCConfig(emptyYamls)

      expect(result.vpcs).toHaveLength(0)
      expect(result.vpcAttachments).toHaveLength(0)
      expect(result.vpcPeerings).toHaveLength(0)
      expect(result.externals).toHaveLength(0)
      expect(result.externalAttachments).toHaveLength(0)
      expect(result.externalPeerings).toHaveLength(0)
    })

    it('handles multi-document YAML', () => {
      const multiDocYaml = `
apiVersion: vpc.githedgehog.com/v1alpha2
kind: VPC
metadata:
  name: vpc-1
spec:
  subnets:
    default:
      cidr: 10.1.0.0/24
---
apiVersion: vpc.githedgehog.com/v1alpha2
kind: VPC
metadata:
  name: vpc-2
spec:
  subnets:
    default:
      cidr: 10.2.0.0/24
`

      const yamls = {
        vpcs: multiDocYaml,
        vpcAttachments: '',
        vpcPeerings: '',
        externals: '',
        externalAttachments: '',
        externalPeerings: ''
      }

      const result = deserializeCRDsToVPCConfig(yamls)

      expect(result.vpcs).toHaveLength(2)
      expect(result.vpcs[0].metadata.name).toBe('vpc-1')
      expect(result.vpcs[1].metadata.name).toBe('vpc-2')
    })
  })
})