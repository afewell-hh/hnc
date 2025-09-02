/**
 * TopologyPro/MultiClass Story
 * Demonstrates complex multi-class topology scenario with diverse leaf types
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { LeafClassBuilder } from '../components/LeafClassBuilder';
import type { TopologyConfig, LeafClassConfigUI } from '../types/leaf-class-builder.types';

const meta: Meta<typeof LeafClassBuilder> = {
  title: 'TopologyPro/MultiClass',
  component: LeafClassBuilder,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
**TopologyPro/MultiClass** demonstrates the full power of the multi-class topology builder.

This story showcases:
- Multiple leaf classes with different roles and configurations
- Complex range assignments and profile management
- Inter-class validation and conflict resolution
- Advanced uplink configurations with different LAG modes
- CRD compliance across heterogeneous classes
        `
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', minHeight: '100vh' }}>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof meta>;

// Create complex multi-class configuration
const createMultiClassConfig = (): TopologyConfig => ({
  name: 'Enterprise Multi-Tier Fabric',
  description: 'Complex fabric with compute, storage, and edge leaf classes',
  leafClasses: [
    // Compute leaf class
    {
      id: 'compute-standard',
      name: 'Compute Standard',
      role: 'standard',
      uplinksPerLeaf: 4,
      count: 8,
      leafModelId: 'DS2000',
      assignableRanges: [
        {
          id: 'vlan-compute',
          name: 'Compute VLANs',
          type: 'vlan',
          range: { start: 100, end: 299 },
          description: 'VLANs for compute workloads',
          allocated: 50,
          available: 200,
          utilization: 25,
          conflicts: [],
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Compute VLAN allocation'
          }
        },
        {
          id: 'ports-compute',
          name: 'Compute Ports',
          type: 'port',
          range: { start: 1, end: 44 },
          description: 'Endpoint ports for compute servers',
          allocated: 32,
          available: 44,
          utilization: 73,
          conflicts: [],
          provenance: {
            source: 'auto',
            timestamp: new Date().toISOString(),
            comment: 'Auto-calculated based on uplinks'
          }
        }
      ],
      endpointProfiles: [
        {
          id: 'high-compute',
          name: 'High Compute Server',
          type: 'compute',
          portsPerEndpoint: 4,
          vlanMode: 'trunk',
          count: 8,
          bandwidth: 10000,
          redundancy: true,
          esLag: true,
          isDefault: true,
          qos: {
            trustMode: 'dscp',
            defaultCos: 3,
            queues: [
              { id: 0, weight: 25, priority: 'low' },
              { id: 1, weight: 50, priority: 'medium' },
              { id: 2, weight: 25, priority: 'high' }
            ]
          },
          security: {
            dhcpSnooping: true,
            arpInspection: true,
            bpduGuard: true
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'High-performance compute profile'
          }
        },
        {
          id: 'standard-compute',
          name: 'Standard Compute Server',
          type: 'server',
          portsPerEndpoint: 2,
          vlanMode: 'access',
          count: 12,
          bandwidth: 1000,
          redundancy: false,
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Standard compute profile'
          }
        }
      ],
      uplinkGroups: [
        {
          id: 'compute-uplinks-primary',
          name: 'Primary Uplinks',
          mode: 'lacp',
          ports: ['uplink-1', 'uplink-2'],
          lacpConfig: {
            mode: 'active',
            rate: 'fast',
            systemPriority: 16384,
            portPriority: 16384
          },
          redundancy: {
            minLinks: 1,
            maxLinks: 2,
            failoverDelay: 500
          },
          monitoring: {
            linkDetection: true,
            loadBalancing: 'hash-based'
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Primary LACP uplinks'
          }
        },
        {
          id: 'compute-uplinks-secondary',
          name: 'Secondary Uplinks',
          mode: 'lacp',
          ports: ['uplink-3', 'uplink-4'],
          lacpConfig: {
            mode: 'passive',
            rate: 'slow',
            systemPriority: 32768,
            portPriority: 32768
          },
          redundancy: {
            minLinks: 1,
            maxLinks: 2,
            failoverDelay: 1000
          },
          monitoring: {
            linkDetection: true,
            loadBalancing: 'bandwidth'
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Secondary LACP uplinks'
          }
        }
      ],
      validationState: 'valid',
      hasUnsavedChanges: false,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Compute leaf class'
      }
    },
    // Storage leaf class
    {
      id: 'storage-high-perf',
      name: 'High-Performance Storage',
      role: 'standard',
      uplinksPerLeaf: 2,
      count: 4,
      leafModelId: 'DS2000',
      assignableRanges: [
        {
          id: 'vlan-storage',
          name: 'Storage VLANs',
          type: 'vlan',
          range: { start: 300, end: 399 },
          description: 'VLANs for storage networks',
          allocated: 20,
          available: 100,
          utilization: 20,
          conflicts: [],
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Storage VLAN allocation'
          }
        }
      ],
      endpointProfiles: [
        {
          id: 'storage-array',
          name: 'Storage Array',
          type: 'storage',
          portsPerEndpoint: 8,
          vlanMode: 'hybrid',
          count: 2,
          bandwidth: 25000,
          redundancy: true,
          esLag: true,
          isDefault: true,
          qos: {
            trustMode: 'cos',
            defaultCos: 5,
            rateLimit: {
              ingress: 20000,
              egress: 20000
            }
          },
          security: {
            portSecurity: {
              enabled: true,
              maxMac: 2,
              violation: 'restrict'
            }
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'High-performance storage arrays'
          }
        }
      ],
      uplinkGroups: [
        {
          id: 'storage-uplinks',
          name: 'Storage Uplinks',
          mode: 'static',
          ports: ['uplink-1', 'uplink-2'],
          redundancy: {
            minLinks: 2,
            maxLinks: 2,
            failoverDelay: 100
          },
          monitoring: {
            linkDetection: true,
            loadBalancing: 'round-robin'
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Static LAG for storage'
          }
        }
      ],
      validationState: 'valid',
      hasUnsavedChanges: false,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Storage leaf class'
      }
    },
    // Border/Edge leaf class
    {
      id: 'edge-border',
      name: 'Edge Border',
      role: 'border',
      uplinksPerLeaf: 2,
      count: 2,
      leafModelId: 'DS2000',
      assignableRanges: [
        {
          id: 'vlan-dmz',
          name: 'DMZ VLANs',
          type: 'vlan',
          range: { start: 400, end: 499 },
          description: 'VLANs for DMZ and edge services',
          allocated: 15,
          available: 100,
          utilization: 15,
          conflicts: [],
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'DMZ VLAN allocation'
          }
        },
        {
          id: 'asn-external',
          name: 'External ASNs',
          type: 'asn',
          range: { start: 65200, end: 65299 },
          description: 'ASNs for external BGP peering',
          allocated: 5,
          available: 100,
          utilization: 5,
          conflicts: [],
          provenance: {
            source: 'import',
            timestamp: new Date().toISOString(),
            comment: 'Imported from network team'
          }
        }
      ],
      endpointProfiles: [
        {
          id: 'edge-firewall',
          name: 'Edge Firewall',
          type: 'network',
          portsPerEndpoint: 2,
          vlanMode: 'trunk',
          count: 4,
          bandwidth: 10000,
          redundancy: true,
          isDefault: true,
          security: {
            dhcpSnooping: false,
            arpInspection: false,
            bpduGuard: false,
            portSecurity: {
              enabled: false
            }
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Edge firewall configuration'
          }
        }
      ],
      uplinkGroups: [
        {
          id: 'border-uplinks',
          name: 'Border Uplinks',
          mode: 'active-backup',
          ports: ['uplink-1', 'uplink-2'],
          redundancy: {
            minLinks: 1,
            maxLinks: 2,
            failoverDelay: 2000
          },
          monitoring: {
            linkDetection: true,
            loadBalancing: 'round-robin'
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Active-backup for border connectivity'
          }
        }
      ],
      validationState: 'warning',
      hasUnsavedChanges: true,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Border leaf class - under configuration'
      }
    }
  ],
  fabricSettings: {
    spineModel: 'DS3000',
    spineCount: 4,
    fabricASN: 65000,
    loopbackSubnet: '10.0.0.0/24',
    vtepSubnet: '10.1.0.0/24',
    fabricSubnet: '10.2.0.0/24'
  },
  globalSettings: {
    defaultUplinksPerLeaf: 2,
    breakoutEnabled: true,
    lacpEnabled: true,
    mclagEnabled: true
  },
  crdCompliant: true,
  crdVersion: 'v1beta1',
  lastValidated: new Date(),
  provenance: {
    source: 'user',
    timestamp: new Date().toISOString(),
    comment: 'Multi-class enterprise topology'
  }
});

export const Default: Story = {
  args: {
    initialConfig: createMultiClassConfig(),
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Multi-class config changed:', config);
    },
    onValidate: (context) => {
      const errors = [];
      
      // Check for VLAN range conflicts across classes
      const allVlanRanges = context.siblingClasses
        .concat([context.leafClass])
        .flatMap(lc => lc.assignableRanges.filter(r => r.type === 'vlan'));
      
      for (const range of context.leafClass.assignableRanges.filter(r => r.type === 'vlan')) {
        const conflicts = allVlanRanges.filter(r => 
          r.id !== range.id &&
          ((r.range.start <= range.range.end && r.range.end >= range.range.start))
        );
        
        if (conflicts.length > 0) {
          errors.push({
            field: 'assignableRanges',
            message: `VLAN range ${range.name} conflicts with ${conflicts.map(c => c.name).join(', ')}`,
            severity: 'error' as const,
            remediation: 'Adjust VLAN ranges to avoid overlaps'
          });
        }
      }

      // Validate border leaf specific requirements
      if (context.leafClass.role === 'border') {
        const hasExternalAsn = context.leafClass.assignableRanges.some(r => r.type === 'asn');
        if (!hasExternalAsn) {
          errors.push({
            field: 'assignableRanges',
            message: 'Border leaf classes should have ASN ranges for external peering',
            severity: 'warning' as const,
            remediation: 'Add an ASN range for external BGP peering'
          });
        }
      }

      // Check uplink capacity across all classes
      const totalUplinks = context.siblingClasses
        .concat([context.leafClass])
        .reduce((sum, lc) => sum + (lc.uplinksPerLeaf * (lc.count || 1)), 0);
      
      const spineCapacity = context.fabricSettings.spineCount * 32; // DS3000 has 32 ports
      
      if (totalUplinks > spineCapacity) {
        errors.push({
          field: 'uplinksPerLeaf',
          message: `Total uplinks (${totalUplinks}) exceed spine capacity (${spineCapacity})`,
          severity: 'error' as const,
          remediation: 'Reduce uplinks per leaf or increase spine count'
        });
      }

      return errors;
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify multi-class topology loads
    const leafClassBuilder = canvas.getByText('Leaf Class Builder');
    await expect(leafClassBuilder).toBeInTheDocument();

    // Check all three leaf classes are displayed
    const computeClass = canvas.getByText('Compute Standard');
    await expect(computeClass).toBeInTheDocument();
    
    const storageClass = canvas.getByText('High-Performance Storage');
    await expect(storageClass).toBeInTheDocument();
    
    const edgeClass = canvas.getByText('Edge Border');
    await expect(edgeClass).toBeInTheDocument();

    // Verify class differentiation badges
    const standardBadges = canvas.getAllByText('standard');
    await expect(standardBadges).toHaveLength(2); // Compute and Storage

    const borderBadge = canvas.getByText('border');
    await expect(borderBadge).toBeInTheDocument();

    // Test switching between classes
    await userEvent.click(storageClass);
    
    // Verify storage class details
    const profilesTab = canvas.getByRole('tab', { name: /Profiles/i });
    await userEvent.click(profilesTab);
    
    const storageArray = canvas.getByText('Storage Array');
    await expect(storageArray).toBeInTheDocument();

    // Check storage-specific configuration
    const hybridVlan = canvas.getByText(/hybrid/i);
    await expect(hybridVlan).toBeInTheDocument();

    // Test edge/border class
    await userEvent.click(edgeClass);
    
    const rangesTab = canvas.getByRole('tab', { name: /Ranges/i });
    await userEvent.click(rangesTab);

    // Verify DMZ VLANs and ASN ranges
    const dmzVlans = canvas.getByText('DMZ VLANs');
    await expect(dmzVlans).toBeInTheDocument();

    const externalAsns = canvas.getByText('External ASNs');
    await expect(externalAsns).toBeInTheDocument();

    // Test validation across multiple classes
    const validationTab = canvas.getByRole('tab', { name: /Validate/i });
    await userEvent.click(validationTab);

    const validateButton = canvas.getByRole('button', { name: /Validate All Classes/i });
    await userEvent.click(validateButton);

    // Should show validation results for multi-class scenario
    const validationResults = await canvas.findByText(/validation/i);
    await expect(validationResults).toBeInTheDocument();
  }
};

export const ConflictResolution: Story = {
  args: {
    initialConfig: {
      ...createMultiClassConfig(),
      leafClasses: [
        // Create conflicting VLAN ranges
        {
          ...createMultiClassConfig().leafClasses[0],
          assignableRanges: [
            {
              id: 'vlan-compute-conflict',
              name: 'Compute VLANs',
              type: 'vlan',
              range: { start: 100, end: 200 },
              description: 'VLANs for compute workloads',
              allocated: 25,
              available: 101,
              utilization: 25,
              conflicts: ['vlan-storage-conflict'],
              provenance: {
                source: 'user',
                timestamp: new Date().toISOString(),
                comment: 'Conflicting range'
              }
            }
          ],
          validationState: 'error'
        },
        {
          ...createMultiClassConfig().leafClasses[1],
          assignableRanges: [
            {
              id: 'vlan-storage-conflict',
              name: 'Storage VLANs',
              type: 'vlan',
              range: { start: 150, end: 250 }, // Overlaps with compute
              description: 'VLANs for storage networks',
              allocated: 20,
              available: 101,
              utilization: 20,
              conflicts: ['vlan-compute-conflict'],
              provenance: {
                source: 'user',
                timestamp: new Date().toISOString(),
                comment: 'Conflicting range'
              }
            }
          ],
          validationState: 'error'
        }
      ]
    },
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Config with conflicts changed:', config);
    },
    onValidate: (context) => [
      {
        field: 'assignableRanges',
        message: 'VLAN range conflicts detected between Compute and Storage classes',
        severity: 'error' as const,
        remediation: 'Adjust VLAN ranges to avoid overlaps between 150-200'
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify conflict indicators are shown
    const errorCards = canvas.getAllByRole('region', { name: /border-destructive/ });
    await expect(errorCards.length).toBeGreaterThan(0);

    // Test validation shows conflicts
    const validationTab = canvas.getByRole('tab', { name: /Validate/i });
    await userEvent.click(validationTab);

    const validateButton = canvas.getByRole('button', { name: /Validate All Classes/i });
    await userEvent.click(validateButton);

    const conflictError = await canvas.findByText(/VLAN range conflicts detected/);
    await expect(conflictError).toBeInTheDocument();

    const remediation = canvas.getByText(/Adjust VLAN ranges to avoid overlaps/);
    await expect(remediation).toBeInTheDocument();
  }
};

export const CapacityPlanning: Story = {
  args: {
    initialConfig: {
      ...createMultiClassConfig(),
      leafClasses: createMultiClassConfig().leafClasses.map(lc => ({
        ...lc,
        count: 20, // High count to test capacity limits
        uplinksPerLeaf: 8 // Max uplinks to stress-test
      }))
    },
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Capacity planning config:', config);
    },
    onValidate: (context) => {
      const totalUplinks = context.siblingClasses
        .concat([context.leafClass])
        .reduce((sum, lc) => sum + (lc.uplinksPerLeaf * (lc.count || 1)), 0);
      
      const spineCapacity = 4 * 32; // 4 spines × 32 ports each
      
      return totalUplinks > spineCapacity ? [{
        field: 'capacity',
        message: `Total uplinks (${totalUplinks}) exceed spine capacity (${spineCapacity})`,
        severity: 'error' as const,
        remediation: 'Reduce leaf count, uplinks per leaf, or increase spine count'
      }] : [];
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test capacity validation
    const validationTab = canvas.getByRole('tab', { name: /Validate/i });
    await userEvent.click(validationTab);

    const validateButton = canvas.getByRole('button', { name: /Validate All Classes/i });
    await userEvent.click(validateButton);

    // Should show capacity error
    const capacityError = await canvas.findByText(/exceed spine capacity/);
    await expect(capacityError).toBeInTheDocument();

    const capacityRemediation = canvas.getByText(/Reduce leaf count, uplinks per leaf, or increase spine count/);
    await expect(capacityRemediation).toBeInTheDocument();
  }
};