import type { Meta, StoryObj } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { expect, within, userEvent } from '@storybook/test'
import React, { useState } from 'react'

import { VPCEditor } from '../components/editors/VPCEditor'
import { VPCAttachmentEditor } from '../components/editors/VPCAttachmentEditor'
import { VPCPeeringEditor } from '../components/editors/VPCPeeringEditor'
import { ExternalConnectivityEditor } from '../components/editors/ExternalConnectivityEditor'
import type { VPCConfig } from '../components/editors/VPCEditor'
import type { VPCAttachmentConfig } from '../components/editors/VPCAttachmentEditor'
import type { VPCPeeringConfig } from '../components/editors/VPCPeeringEditor'
import type { ExternalConfig, ExternalAttachmentConfig, ExternalPeeringConfig } from '../components/editors/ExternalConnectivityEditor'

const meta: Meta<typeof VPCEditor> = {
  title: 'VPC/VPC Editors',
  component: VPCEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'VPC network configuration editors for managing virtual private clouds, attachments, peering, and external connectivity.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onChange: { action: 'vpc-changed' },
    onValidate: { action: 'validation-changed' },
    readonly: {
      control: 'boolean',
      description: 'Make the editor read-only'
    }
  }
}

export default meta
type Story = StoryObj<typeof VPCEditor>

// Sample data for stories
const sampleVPCConfig: VPCConfig = {
  metadata: {
    name: 'production-vpc',
    labels: { environment: 'prod', team: 'platform' },
    annotations: { 'created-by': 'hnc-vpc-editor' }
  },
  spec: {
    defaultIsolated: false,
    defaultRestricted: false,
    ipv4Namespace: 'default',
    vlanNamespace: 'default',
    mode: 'default',
    subnets: {
      'web-tier': {
        name: 'web-tier',
        cidr: '10.1.1.0/24',
        gateway: '10.1.1.1',
        isolated: false,
        restricted: false,
        dhcp: {
          enable: true,
          start: '10.1.1.100',
          end: '10.1.1.200'
        }
      },
      'app-tier': {
        name: 'app-tier',
        cidr: '10.1.2.0/24',
        gateway: '10.1.2.1',
        isolated: true,
        restricted: false
      },
      'db-tier': {
        name: 'db-tier',
        cidr: '10.1.3.0/24',
        gateway: '10.1.3.1',
        isolated: true,
        restricted: true
      }
    },
    permit: [
      ['web-tier', 'app-tier'],
      ['app-tier', 'db-tier']
    ],
    staticRoutes: [
      {
        destination: '0.0.0.0/0',
        nextHop: '10.1.0.1',
        metric: 100
      }
    ]
  }
}

const sampleAttachmentConfig: VPCAttachmentConfig = {
  metadata: {
    name: 'web-server-attachment',
    labels: { tier: 'web' }
  },
  spec: {
    connection: 'web-server-connection-1',
    subnet: 'production-vpc/web-tier',
    nativeVLAN: false
  }
}

const samplePeeringConfig: VPCPeeringConfig = {
  metadata: {
    name: 'prod-dev-peering',
    labels: { purpose: 'cross-env-access' }
  },
  spec: {
    remote: 'development-vpc',
    permit: [
      {
        localSubnets: ['production-vpc/web-tier'],
        remoteSubnets: ['development-vpc/test-tier'],
        bidirectional: true
      },
      {
        localSubnets: ['production-vpc/app-tier'],
        remoteSubnets: ['development-vpc/staging-tier'],
        bidirectional: false
      }
    ]
  }
}

const sampleExternalConfig: ExternalConfig = {
  metadata: {
    name: 'internet-gateway',
    labels: { type: 'wan' }
  },
  spec: {
    ipv4Namespace: 'default',
    inboundCommunity: '65102:5000',
    outboundCommunity: '50000:50001'
  }
}

const sampleExternalAttachment: ExternalAttachmentConfig = {
  metadata: {
    name: 'border-bgp-attachment',
    labels: { location: 'datacenter-1' }
  },
  spec: {
    connection: 'border-switch-connection',
    external: 'internet-gateway',
    neighbor: {
      asn: 65100,
      ip: '192.168.100.1',
      password: 'bgp-secret'
    },
    switch: {
      ip: '10.0.0.1',
      asn: 65000
    }
  }
}

const sampleExternalPeering: ExternalPeeringConfig = {
  metadata: {
    name: 'internet-vpc-peering',
    labels: { purpose: 'wan-access' }
  },
  spec: {
    permit: {
      vpc: 'production-vpc',
      external: 'internet-gateway',
      vpcSubnets: ['production-vpc/web-tier'],
      externalPrefixes: ['0.0.0.0/0', '8.8.8.0/24']
    }
  }
}

// VPC Editor Stories
export const BasicVPCNetworkSetup: Story = {
  render: (args) => {
    const [vpc, setVPC] = useState<VPCConfig>(sampleVPCConfig)
    const [isValid, setIsValid] = useState(true)
    const [errors, setErrors] = useState<string[]>([])

    return (
      <div>
        <h2>Basic VPC Network Setup</h2>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Configure a basic VPC with multiple tiers (web, app, database) and appropriate isolation settings.
        </p>
        <VPCEditor 
          {...args}
          vpc={vpc}
          onChange={(newVPC) => {
            setVPC(newVPC)
            action('vpc-changed')(newVPC)
          }}
          onValidate={(valid, validationErrors) => {
            setIsValid(valid)
            setErrors(validationErrors)
            action('validation-changed')(valid, validationErrors)
          }}
        />
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: isValid ? '#d4edda' : '#f8d7da',
          border: `1px solid ${isValid ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px' 
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Validation Status</h4>
          <div><strong>Valid:</strong> {isValid ? 'Yes' : 'No'}</div>
          {errors.length > 0 && (
            <div>
              <strong>Errors:</strong>
              <ul style={{ margin: '5px 0 0 20px' }}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  },
  args: {
    readonly: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify VPC editor renders
    const vpcNameInput = canvas.getByTestId('vpc-name-input')
    await expect(vpcNameInput).toBeInTheDocument()
    await expect(vpcNameInput).toHaveValue('production-vpc')

    // Check subnet tab functionality
    const subnetsTab = canvas.getByText('Subnets')
    await userEvent.click(subnetsTab)

    // Verify subnets are displayed
    await expect(canvas.getByText('web-tier')).toBeInTheDocument()
    await expect(canvas.getByText('app-tier')).toBeInTheDocument()
    await expect(canvas.getByText('db-tier')).toBeInTheDocument()

    // Test adding a new subnet
    const addSubnetButton = canvas.getByTestId('add-subnet-button')
    await userEvent.click(addSubnetButton)

    // Verify new subnet appears
    await expect(canvas.getByText('subnet-4')).toBeInTheDocument()

    // Check static routes tab
    const routingTab = canvas.getByText('Static Routes')
    await userEvent.click(routingTab)

    // Verify static routes are shown
    await expect(canvas.getByTestId('route-0-destination')).toHaveValue('0.0.0.0/0')
    await expect(canvas.getByTestId('route-0-nexthop')).toHaveValue('10.1.0.1')
  }
}

export const ComplexMultiVPCWithPeering: Story = {
  render: () => {
    const [vpc, setVPC] = useState<VPCConfig>({
      ...sampleVPCConfig,
      metadata: { name: 'enterprise-vpc' },
      spec: {
        ...sampleVPCConfig.spec,
        subnets: {
          'dmz': {
            name: 'dmz',
            cidr: '10.10.1.0/24',
            gateway: '10.10.1.1',
            isolated: false,
            restricted: false
          },
          'internal': {
            name: 'internal',
            cidr: '10.10.2.0/24', 
            gateway: '10.10.2.1',
            isolated: true,
            restricted: false
          },
          'secure': {
            name: 'secure',
            cidr: '10.10.3.0/24',
            gateway: '10.10.3.1',
            isolated: true,
            restricted: true
          },
          'management': {
            name: 'management',
            cidr: '10.10.4.0/24',
            gateway: '10.10.4.1',
            isolated: true,
            restricted: true
          }
        }
      }
    })

    const [attachment, setAttachment] = useState<VPCAttachmentConfig>({
      ...sampleAttachmentConfig,
      spec: {
        ...sampleAttachmentConfig.spec,
        subnet: 'enterprise-vpc/dmz'
      }
    })

    const [peering, setPeering] = useState<VPCPeeringConfig>({
      ...samplePeeringConfig,
      spec: {
        ...samplePeeringConfig.spec,
        permit: [
          {
            localSubnets: ['enterprise-vpc/dmz'],
            remoteSubnets: ['partner-vpc/public'],
            bidirectional: true
          },
          {
            localSubnets: ['enterprise-vpc/internal'],
            remoteSubnets: ['dev-vpc/testing'],
            bidirectional: false
          }
        ]
      }
    })

    const availableConnections = [
      { metadata: { name: 'dmz-server-conn' }, spec: { unbundled: { link: {} } } },
      { metadata: { name: 'internal-server-conn' }, spec: { bundled: { links: [] } } },
      { metadata: { name: 'secure-server-conn' }, spec: { mclag: { links: [] } } }
    ]

    const availableSubnets = ['enterprise-vpc/dmz', 'enterprise-vpc/internal', 'enterprise-vpc/secure']
    const availableVPCs = ['partner-vpc', 'dev-vpc', 'staging-vpc']
    const availableVPCSubnets = {
      'enterprise-vpc': ['dmz', 'internal', 'secure', 'management'],
      'partner-vpc': ['public', 'private'],
      'dev-vpc': ['testing', 'development']
    }

    return (
      <div>
        <h2>Complex Multi-VPC with Peering</h2>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Enterprise setup with multiple VPCs, complex peering relationships, and various attachment types.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          {/* Main VPC Configuration */}
          <section>
            <h3>Enterprise VPC Configuration</h3>
            <VPCEditor 
              vpc={vpc}
              onChange={setVPC}
              readonly={false}
            />
          </section>

          {/* VPC Attachment Configuration */}
          <section>
            <h3>Server Attachment Configuration</h3>
            <VPCAttachmentEditor
              attachment={attachment}
              availableConnections={availableConnections}
              availableSubnets={availableSubnets}
              onChange={setAttachment}
              readonly={false}
            />
          </section>

          {/* VPC Peering Configuration */}
          <section>
            <h3>Inter-VPC Peering</h3>
            <VPCPeeringEditor
              peering={peering}
              availableVPCs={availableVPCs}
              availableSubnets={availableVPCSubnets}
              onChange={setPeering}
              readonly={false}
            />
          </section>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Verify all main sections are present
    await expect(canvas.getByText('Enterprise VPC Configuration')).toBeInTheDocument()
    await expect(canvas.getByText('Server Attachment Configuration')).toBeInTheDocument()
    await expect(canvas.getByText('Inter-VPC Peering')).toBeInTheDocument()

    // Test VPC configuration
    const vpcNameInput = canvas.getByTestId('vpc-name-input')
    await expect(vpcNameInput).toHaveValue('enterprise-vpc')

    // Test attachment configuration
    const connectionSelect = canvas.getByTestId('connection-select')
    await userEvent.click(connectionSelect)
    await expect(canvas.getByText('dmz-server-conn (Unbundled)')).toBeInTheDocument()

    // Test peering configuration
    const remoteVPCSelect = canvas.getByTestId('remote-vpc-select')
    await userEvent.selectOptions(remoteVPCSelect, 'partner-vpc')
    
    // Verify peering policy can be expanded
    const policyHeader = canvas.getByText('Policy 1')
    await userEvent.click(policyHeader)
    
    // Check that subnet checkboxes are available
    await expect(canvas.getByTestId('local-subnet-0-dmz')).toBeInTheDocument()
  }
}

export const ExternalConnectivityScenario: Story = {
  render: () => {
    const [externalConfig, setExternalConfig] = useState({
      external: sampleExternalConfig,
      attachment: sampleExternalAttachment,
      peering: sampleExternalPeering
    })

    const availableConnections = ['border-switch-connection', 'wan-connection-1', 'wan-connection-2']
    const availableVPCs = ['production-vpc', 'staging-vpc', 'development-vpc']
    const availableSubnets = {
      'production-vpc': ['web-tier', 'app-tier', 'db-tier'],
      'staging-vpc': ['test-tier', 'qa-tier'],
      'development-vpc': ['dev-tier']
    }

    return (
      <div>
        <h2>External Connectivity Scenario</h2>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Configure external connectivity with BGP peering, route communities, and VPC-to-external routing policies.
        </p>
        
        <ExternalConnectivityEditor
          external={externalConfig.external}
          attachment={externalConfig.attachment}
          peering={externalConfig.peering}
          availableConnections={availableConnections}
          availableVPCs={availableVPCs}
          availableSubnets={availableSubnets}
          onChange={(config) => {
            setExternalConfig({
              external: config.external || externalConfig.external,
              attachment: config.attachment || externalConfig.attachment,
              peering: config.peering || externalConfig.peering
            })
          }}
          readonly={false}
        />

        {/* Configuration Preview */}
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}>
          <h4>Generated Configuration</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '12px' }}>
            <div>
              <h6>External Network</h6>
              <pre style={{ fontSize: '10px', backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
{`External: ${externalConfig.external.metadata.name}
Communities:
  In: ${externalConfig.external.spec.inboundCommunity}
  Out: ${externalConfig.external.spec.outboundCommunity}`}
              </pre>
            </div>
            <div>
              <h6>BGP Attachment</h6>
              <pre style={{ fontSize: '10px', backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
{`Connection: ${externalConfig.attachment.spec.connection}
Neighbor: ${externalConfig.attachment.spec.neighbor?.ip}
ASN: ${externalConfig.attachment.spec.neighbor?.asn}
Switch: ${externalConfig.attachment.spec.switch?.ip}`}
              </pre>
            </div>
            <div>
              <h6>VPC Peering</h6>
              <pre style={{ fontSize: '10px', backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
{`VPC: ${externalConfig.peering.spec.permit?.vpc}
Subnets: ${externalConfig.peering.spec.permit?.vpcSubnets?.length || 0}
Prefixes: ${externalConfig.peering.spec.permit?.externalPrefixes?.length || 0}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Test external network tab
    const externalTab = canvas.getByText('External Network')
    await userEvent.click(externalTab)
    
    const externalNameInput = canvas.getByTestId('external-name-input')
    await expect(externalNameInput).toHaveValue('internet-gateway')
    
    const inboundCommunityInput = canvas.getByTestId('inbound-community-input')
    await expect(inboundCommunityInput).toHaveValue('65102:5000')

    // Test BGP attachment tab
    const attachmentTab = canvas.getByText('BGP Attachment')
    await userEvent.click(attachmentTab)
    
    const neighborIP = canvas.getByTestId('neighbor-ip-input')
    await expect(neighborIP).toHaveValue('192.168.100.1')
    
    const neighborASN = canvas.getByTestId('neighbor-asn-input')
    await expect(neighborASN).toHaveValue(65100)

    // Test VPC peering tab
    const peeringTab = canvas.getByText('VPC Peering')
    await userEvent.click(peeringTab)
    
    const vpcSelect = canvas.getByTestId('peering-vpc-select')
    await expect(vpcSelect).toHaveValue('production-vpc')

    // Verify external prefixes can be managed
    const addPrefixButton = canvas.getByTestId('add-external-prefix')
    await userEvent.click(addPrefixButton)
    
    // Should add a new prefix input
    const newPrefixInput = canvas.getByTestId('external-prefix-2')
    await expect(newPrefixInput).toBeInTheDocument()
    await userEvent.type(newPrefixInput, '172.16.0.0/12')
  }
}

// Additional read-only variants
export const ReadOnlyVPCConfiguration: Story = {
  render: () => (
    <div>
      <h2>Read-Only VPC Configuration</h2>
      <p style={{ color: '#6c757d', marginBottom: '20px' }}>
        View-only mode for inspecting existing VPC configurations.
      </p>
      <VPCEditor 
        vpc={sampleVPCConfig}
        onChange={() => {}}
        readonly={true}
      />
    </div>
  ),
  args: {
    readonly: true
  }
}

// Empty state story
export const EmptyVPCConfiguration: Story = {
  render: () => {
    const [vpc, setVPC] = useState<VPCConfig | undefined>(undefined)
    
    return (
      <div>
        <h2>New VPC Configuration</h2>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Start with a blank VPC configuration and build from scratch.
        </p>
        <VPCEditor 
          vpc={vpc}
          onChange={setVPC}
          readonly={false}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should start with default values
    const vpcNameInput = canvas.getByTestId('vpc-name-input')
    await expect(vpcNameInput).toHaveValue('vpc-1')
    
    // Should have one default subnet
    const subnetsTab = canvas.getByText('Subnets')
    await userEvent.click(subnetsTab)
    await expect(canvas.getByText('default')).toBeInTheDocument()
  }
}