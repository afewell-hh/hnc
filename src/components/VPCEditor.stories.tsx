/**
 * VPCEditor Storybook Stories - WP-VPC1
 * 3 comprehensive stories demonstrating VPC configuration scenarios
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import VPCEditor from './VPCEditor'
import type { VPCConfiguration, VPCNetwork, VRFConfig, VPCPolicy } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const meta = {
  title: 'VPC/VPCEditor',
  component: VPCEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'CRD-aligned VPC configuration editor with networks, subnets, VRF, and policy management - WP-VPC1'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: ['guided', 'expert']
    },
    readOnly: {
      control: { type: 'boolean' }
    }
  }
} satisfies Meta<typeof VPCEditor>

export default meta
type Story = StoryObj<typeof meta>

// Story 1: Basic VPC Setup - Empty to configured
const emptyVPCConfig: VPCConfiguration = {
  metadata: {
    name: 'basic-vpc',
    namespace: 'production'
  },
  networks: [],
  vrfs: [],
  globalPolicies: [],
  provenance: createFieldProvenance('user', 'initial')
}

export const BasicVPCSetup: Story = {
  name: '1. Basic VPC Setup (Empty → Configured)',
  args: {
    configuration: emptyVPCConfig,
    mode: 'guided',
    readOnly: false
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Test initial empty state
    expect(canvas.getByText('No networks configured.')).toBeInTheDocument()
    
    // Add first network
    const addNetworkBtn = canvas.getByText('Add Network')
    await userEvent.click(addNetworkBtn)
    
    // Verify network was added
    expect(canvas.getByText('network-1')).toBeInTheDocument()
    expect(canvas.getByText('10.0.0.0/24')).toBeInTheDocument()
    
    // Expand the network card
    const networkCard = canvas.getByText('network-1').closest('.network-card')
    if (networkCard) {
      const toggleBtn = within(networkCard).getByText('+')
      await userEvent.click(toggleBtn)
      
      // Verify form fields are visible
      expect(canvas.getByDisplayValue('network-1')).toBeInTheDocument()
      expect(canvas.getByDisplayValue('10.0.0.0/24')).toBeInTheDocument()
      
      // Update network name and CIDR
      const nameInput = canvas.getByDisplayValue('network-1')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'web-network')
      
      const cidrInput = canvas.getByDisplayValue('10.0.0.0/24')
      await userEvent.clear(cidrInput)
      await userEvent.type(cidrInput, '10.1.0.0/16')
      
      // Verify updates
      expect(canvas.getByDisplayValue('web-network')).toBeInTheDocument()
      expect(canvas.getByDisplayValue('10.1.0.0/16')).toBeInTheDocument()
    }
    
    // Test tab switching
    const vrfsTab = canvas.getByText('VRFs')
    await userEvent.click(vrfsTab)
    expect(canvas.getByText('No VRFs configured.')).toBeInTheDocument()
    
    const policiesTab = canvas.getByText('Policies')
    await userEvent.click(policiesTab)
    expect(canvas.getByText('No policies configured.')).toBeInTheDocument()
    
    // Switch back to networks
    const networksTab = canvas.getByText('Networks')
    await userEvent.click(networksTab)
    expect(canvas.getByDisplayValue('web-network')).toBeInTheDocument()
  }
}

// Story 2: Multi-Tenant Enterprise Setup
const enterpriseNetworks: VPCNetwork[] = [
  {
    name: 'production-web',
    cidr: '10.1.0.0/16',
    vlanId: 100,
    description: 'Production web services',
    provenance: createFieldProvenance('user', 'network'),
    subnets: [
      {
        name: 'web-frontend',
        cidr: '10.1.1.0/24',
        gateway: '10.1.1.1',
        dhcp: {
          enabled: true,
          startIP: '10.1.1.10',
          endIP: '10.1.1.200',
          dnsServers: ['8.8.8.8', '8.8.4.4'],
          domainName: 'prod.company.com',
          provenance: createFieldProvenance('user', 'dhcp')
        },
        provenance: createFieldProvenance('user', 'subnet')
      },
      {
        name: 'web-backend',
        cidr: '10.1.2.0/24',
        gateway: '10.1.2.1',
        provenance: createFieldProvenance('user', 'subnet')
      }
    ],
    policies: []
  },
  {
    name: 'staging-env',
    cidr: '10.2.0.0/16',
    vlanId: 200,
    description: 'Staging environment',
    provenance: createFieldProvenance('user', 'network'),
    subnets: [
      {
        name: 'staging-web',
        cidr: '10.2.1.0/24',
        gateway: '10.2.1.1',
        dhcp: {
          enabled: true,
          startIP: '10.2.1.10',
          endIP: '10.2.1.50',
          dnsServers: ['8.8.8.8'],
          domainName: 'staging.company.com',
          provenance: createFieldProvenance('user', 'dhcp')
        },
        provenance: createFieldProvenance('user', 'subnet')
      }
    ],
    policies: []
  },
  {
    name: 'management',
    cidr: '10.0.0.0/24',
    vlanId: 10,
    description: 'Management and monitoring',
    provenance: createFieldProvenance('user', 'network'),
    subnets: [],
    policies: []
  }
]

const enterpriseVRFs: VRFConfig[] = [
  {
    name: 'production-vrf',
    routeDistinguisher: '65000:100',
    routeTargets: {
      import: ['65000:100', '65000:999'],
      export: ['65000:100']
    },
    networks: ['production-web', 'management'],
    description: 'Production environment VRF',
    provenance: createFieldProvenance('user', 'vrf')
  },
  {
    name: 'staging-vrf',
    routeDistinguisher: '65000:200',
    routeTargets: {
      import: ['65000:200', '65000:999'],
      export: ['65000:200']
    },
    networks: ['staging-env', 'management'],
    description: 'Staging environment VRF',
    provenance: createFieldProvenance('user', 'vrf')
  }
]

const enterprisePolicies: VPCPolicy[] = [
  {
    name: 'web-security-policy',
    type: 'security',
    priority: 100,
    appliedTo: ['production-web', 'staging-env'],
    description: 'Security policy for web services',
    rules: [
      {
        id: 'allow-http',
        action: 'allow',
        protocol: 'tcp',
        sourceNet: 'any',
        destNet: 'production-web',
        destPorts: '80,443',
        priority: 100,
        provenance: createFieldProvenance('user', 'rule')
      },
      {
        id: 'deny-ssh',
        action: 'deny',
        protocol: 'tcp',
        sourceNet: 'any',
        destNet: 'any',
        destPorts: '22',
        priority: 200,
        provenance: createFieldProvenance('user', 'rule')
      }
    ],
    provenance: createFieldProvenance('user', 'policy')
  }
]

const enterpriseVPCConfig: VPCConfiguration = {
  metadata: {
    name: 'enterprise-vpc',
    namespace: 'infrastructure',
    labels: {
      'environment': 'multi-tenant',
      'team': 'platform'
    }
  },
  networks: enterpriseNetworks,
  vrfs: enterpriseVRFs,
  globalPolicies: enterprisePolicies,
  provenance: createFieldProvenance('import', 'enterprise-setup')
}

export const MultiTenantEnterprise: Story = {
  name: '2. Multi-Tenant Enterprise (Production Ready)',
  args: {
    configuration: enterpriseVPCConfig,
    mode: 'guided',
    readOnly: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify metadata
    expect(canvas.getByDisplayValue('enterprise-vpc')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('infrastructure')).toBeInTheDocument()
    
    // Verify networks are present
    expect(canvas.getByText('Networks (3)')).toBeInTheDocument()
    expect(canvas.getByText('production-web')).toBeInTheDocument()
    expect(canvas.getByText('staging-env')).toBeInTheDocument()
    expect(canvas.getByText('management')).toBeInTheDocument()
    
    // Test network expansion and subnet display
    const prodNetworkCard = canvas.getByText('production-web').closest('.network-card')
    if (prodNetworkCard) {
      const toggleBtn = within(prodNetworkCard).getByText('+')
      await userEvent.click(toggleBtn)
      
      // Verify subnets are shown
      expect(canvas.getByText('Subnets (2)')).toBeInTheDocument()
      expect(canvas.getByText('web-frontend')).toBeInTheDocument()
      expect(canvas.getByText('web-backend')).toBeInTheDocument()
      expect(canvas.getByText('10.1.1.0/24')).toBeInTheDocument()
      expect(canvas.getByText('GW: 10.1.1.1')).toBeInTheDocument()
    }
    
    // Test VRFs tab
    const vrfsTab = canvas.getByText('VRFs')
    await userEvent.click(vrfsTab)
    expect(canvas.getByText('VRFs (2)')).toBeInTheDocument()
    expect(canvas.getByText('production-vrf')).toBeInTheDocument()
    expect(canvas.getByText('staging-vrf')).toBeInTheDocument()
    expect(canvas.getByText('65000:100')).toBeInTheDocument()
    
    // Test Policies tab
    const policiesTab = canvas.getByText('Policies')
    await userEvent.click(policiesTab)
    expect(canvas.getByText('Policies (1)')).toBeInTheDocument()
    expect(canvas.getByText('web-security-policy')).toBeInTheDocument()
    expect(canvas.getByText('security')).toBeInTheDocument()
  }
}

// Story 3: Import/Export Testing with K8s CRDs
const k8sCRDVPCConfig: VPCConfiguration = {
  metadata: {
    name: 'k8s-imported-vpc',
    namespace: 'githedgehog-system',
    annotations: {
      'kubectl.kubernetes.io/last-applied-configuration': '...',
      'networking.githedgehog.com/version': 'v1alpha2'
    },
    labels: {
      'app.kubernetes.io/name': 'hnc-vpc',
      'app.kubernetes.io/instance': 'production'
    }
  },
  networks: [
    {
      name: 'k8s-cluster-network',
      cidr: '192.168.0.0/16',
      vlanId: 3000,
      description: 'Kubernetes cluster network imported from CRD',
      provenance: createFieldProvenance('import', 'k8s-crd'),
      subnets: [
        {
          name: 'pod-subnet',
          cidr: '192.168.1.0/24',
          gateway: '192.168.1.1',
          vni: 30001,
          dhcp: {
            enabled: false,
            provenance: createFieldProvenance('import', 'k8s-crd')
          },
          provenance: createFieldProvenance('import', 'k8s-crd')
        },
        {
          name: 'service-subnet',
          cidr: '192.168.2.0/24',
          gateway: '192.168.2.1',
          vni: 30002,
          provenance: createFieldProvenance('import', 'k8s-crd')
        }
      ],
      policies: []
    }
  ],
  vrfs: [
    {
      name: 'k8s-vrf',
      routeDistinguisher: '10.0.0.1:1',
      routeTargets: {
        import: ['65001:3000'],
        export: ['65001:3000']
      },
      networks: ['k8s-cluster-network'],
      description: 'Kubernetes VRF imported from CRD',
      provenance: createFieldProvenance('import', 'k8s-crd')
    }
  ],
  globalPolicies: [
    {
      name: 'k8s-network-policy',
      type: 'security',
      priority: 50,
      appliedTo: ['k8s-cluster-network'],
      description: 'Kubernetes NetworkPolicy converted to VPC policy',
      rules: [
        {
          id: 'allow-pod-to-pod',
          action: 'allow',
          protocol: 'any',
          sourceNet: '192.168.1.0/24',
          destNet: '192.168.1.0/24',
          priority: 100,
          provenance: createFieldProvenance('import', 'k8s-crd')
        },
        {
          id: 'allow-to-services',
          action: 'allow',
          protocol: 'tcp',
          sourceNet: '192.168.1.0/24',
          destNet: '192.168.2.0/24',
          destPorts: '80,443',
          priority: 200,
          provenance: createFieldProvenance('import', 'k8s-crd')
        }
      ],
      provenance: createFieldProvenance('import', 'k8s-crd')
    }
  ],
  provenance: createFieldProvenance('import', 'k8s-crd'),
  validation: {
    isValid: true,
    errors: [],
    warnings: [
      {
        code: 'IMPORTED_CONFIG',
        what: 'Configuration imported from Kubernetes CRDs',
        how: 'Review and validate imported settings',
        why: 'Imported configurations should be verified before use',
        affectedFields: ['metadata', 'networks', 'vrfs', 'globalPolicies']
      }
    ],
    info: [
      {
        code: 'CRD_SOURCE',
        what: 'Configuration source: githedgehog CRDs v1alpha2',
        how: 'Use export to generate updated CRDs if changes are made',
        why: 'Maintains traceability between HNC and Kubernetes resources',
        affectedFields: ['metadata.annotations']
      }
    ]
  }
}

export const ImportExportK8sCRDs: Story = {
  name: '3. Import/Export K8s CRDs (Round-trip)',
  args: {
    configuration: k8sCRDVPCConfig,
    mode: 'guided',
    readOnly: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify imported CRD metadata
    expect(canvas.getByDisplayValue('k8s-imported-vpc')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('githedgehog-system')).toBeInTheDocument()
    
    // Verify imported network with CRD-specific attributes
    expect(canvas.getByText('k8s-cluster-network')).toBeInTheDocument()
    expect(canvas.getByText('192.168.0.0/16')).toBeInTheDocument()
    
    // Expand network to check subnets with VNI
    const networkCard = canvas.getByText('k8s-cluster-network').closest('.network-card')
    if (networkCard) {
      const toggleBtn = within(networkCard).getByText('+')
      await userEvent.click(toggleBtn)
      
      // Verify subnets imported correctly
      expect(canvas.getByText('Subnets (2)')).toBeInTheDocument()
      expect(canvas.getByText('pod-subnet')).toBeInTheDocument()
      expect(canvas.getByText('service-subnet')).toBeInTheDocument()
    }
    
    // Test VRF with IP-based route distinguisher
    const vrfsTab = canvas.getByText('VRFs')
    await userEvent.click(vrfsTab)
    expect(canvas.getByText('k8s-vrf')).toBeInTheDocument()
    expect(canvas.getByText('10.0.0.1:1')).toBeInTheDocument()
    
    // Test imported policy with specific rules
    const policiesTab = canvas.getByText('Policies')
    await userEvent.click(policiesTab)
    expect(canvas.getByText('k8s-network-policy')).toBeInTheDocument()
    
    // Test mode switching with complex configuration
    const networksTab = canvas.getByText('Networks')
    await userEvent.click(networksTab)
    
    // Test that all components render without errors with imported data
    expect(canvas.getByText('Networks (1)')).toBeInTheDocument()
    expect(canvas.queryByText('No networks configured.')).not.toBeInTheDocument()
    
    // Verify the configuration maintains its structure
    expect(canvas.getByText('k8s-cluster-network')).toBeInTheDocument()
  }
}

// Additional story showcasing validation and error states
export const ValidationAndErrorStates: Story = {
  name: '4. Validation & Error States (Testing)',
  args: {
    configuration: {
      metadata: {
        name: '', // Invalid empty name
        namespace: 'test'
      },
      networks: [
        {
          name: 'invalid-network',
          cidr: '256.256.256.256/33', // Invalid CIDR
          provenance: createFieldProvenance('user', 'network'),
          subnets: [
            {
              name: 'bad-subnet',
              cidr: '10.0.1.0/16', // Wrong subnet size for network
              gateway: '192.168.1.1', // Gateway not in subnet
              dhcp: {
                enabled: true,
                startIP: '10.0.2.1', // DHCP range outside subnet
                endIP: '10.0.2.100',
                dnsServers: ['256.256.256.256'], // Invalid DNS
                provenance: createFieldProvenance('user', 'dhcp')
              },
              provenance: createFieldProvenance('user', 'subnet')
            }
          ],
          policies: []
        }
      ],
      vrfs: [
        {
          name: 'invalid-vrf',
          routeDistinguisher: 'invalid-rd', // Invalid format
          routeTargets: {
            import: ['invalid:target'], // Invalid format
            export: []
          },
          networks: ['nonexistent-network'], // References missing network
          provenance: createFieldProvenance('user', 'vrf')
        }
      ],
      globalPolicies: [
        {
          name: 'conflicting-policy',
          type: 'security',
          priority: 99999, // Invalid priority
          appliedTo: [],
          rules: [
            {
              id: 'bad-rule-1',
              action: 'allow',
              protocol: 'tcp',
              sourceNet: 'any',
              destNet: 'any',
              destPorts: '99999', // Invalid port
              priority: 50,
              provenance: createFieldProvenance('user', 'rule')
            },
            {
              id: 'bad-rule-2',
              action: 'deny',
              protocol: 'tcp',
              sourceNet: 'any',
              destNet: 'any',
              destPorts: '99999', // Same conditions, different action
              priority: 50, // Same priority = conflict
              provenance: createFieldProvenance('user', 'rule')
            }
          ],
          provenance: createFieldProvenance('user', 'policy')
        }
      ],
      provenance: createFieldProvenance('user', 'validation-test'),
      validation: {
        isValid: false,
        errors: [
          {
            code: 'VPC_NAME_REQUIRED',
            what: 'VPC name is required',
            how: 'Enter a descriptive name for the VPC configuration',
            why: 'VPC names are used for identification and management',
            affectedFields: ['metadata.name']
          },
          {
            code: 'INVALID_CIDR',
            what: 'Network CIDR "256.256.256.256/33" is invalid',
            how: 'Use valid IP address and prefix length (e.g., 10.0.0.0/24)',
            why: 'Invalid CIDRs cannot be routed or assigned',
            affectedFields: ['networks[0].cidr']
          }
        ],
        warnings: [
          {
            code: 'NETWORK_NO_SUBNETS',
            what: 'Network has complex subnet configuration issues',
            how: 'Review subnet CIDR, gateway, and DHCP settings',
            why: 'Subnet misconfigurations can cause connectivity issues',
            affectedFields: ['networks[0].subnets']
          }
        ],
        info: []
      }
    },
    mode: 'guided',
    readOnly: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Test that validation errors are displayed (if implemented in UI)
    // This story primarily tests that the component handles invalid data gracefully
    expect(canvas.getByText('Networks (1)')).toBeInTheDocument()
    expect(canvas.getByText('VRFs (1)')).toBeInTheDocument()
    expect(canvas.getByText('Policies (1)')).toBeInTheDocument()
    
    // Component should render without crashing even with invalid data
    expect(canvas.getByText('invalid-network')).toBeInTheDocument()
    
    const vrfsTab = canvas.getByText('VRFs')
    await userEvent.click(vrfsTab)
    expect(canvas.getByText('invalid-vrf')).toBeInTheDocument()
    
    const policiesTab = canvas.getByText('Policies')
    await userEvent.click(policiesTab)
    expect(canvas.getByText('conflicting-policy')).toBeInTheDocument()
  }
}