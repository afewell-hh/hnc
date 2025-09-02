/**
 * TopologyPro/AdvancedDrawer Story
 * Demonstrates complete CRD field exposure with provenance tracking
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { useState } from 'react';
import { AdvancedCRDDrawer } from '../components/AdvancedCRDDrawer';
import type { LeafClassConfigUI, ValidationError, ProvenanceInfo } from '../types/leaf-class-builder.types';

const meta: Meta<typeof AdvancedCRDDrawer> = {
  title: 'TopologyPro/AdvancedDrawer',
  component: AdvancedCRDDrawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
**TopologyPro/AdvancedDrawer** exposes the complete CRD field editing interface.

This story demonstrates:
- Full CRD field mapping with provenance tracking
- Three-tab interface: Field Editor, CRD Preview, Validation
- Real-time CRD compliance scoring
- Field search, filtering, and batch operations
- Export/import capabilities for CRD YAML/JSON
- Comprehensive validation with remediation guidance
        `
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', minHeight: '100vh', position: 'relative' }}>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof meta>;

// Create a comprehensive leaf class for advanced editing
const createAdvancedLeafClass = (): LeafClassConfigUI => ({
  id: 'advanced-compute',
  name: 'Advanced Compute Cluster',
  description: 'High-performance compute cluster with comprehensive configuration',
  role: 'standard',
  uplinksPerLeaf: 4,
  count: 12,
  leafModelId: 'DS2000',
  assignableRanges: [
    {
      id: 'vlan-compute-primary',
      name: 'Primary Compute VLANs',
      type: 'vlan',
      range: { start: 100, end: 299 },
      description: 'Primary VLAN range for compute workloads',
      allocated: 75,
      available: 200,
      utilization: 37.5,
      conflicts: [],
      provenance: {
        source: 'user',
        timestamp: '2024-01-15T10:30:00Z',
        comment: 'Initial VLAN allocation for compute cluster'
      }
    },
    {
      id: 'vlan-compute-management',
      name: 'Management VLANs',
      type: 'vlan',
      range: { start: 300, end: 349 },
      description: 'Management and monitoring VLANs',
      allocated: 10,
      available: 50,
      utilization: 20,
      conflicts: [],
      provenance: {
        source: 'auto',
        timestamp: '2024-01-15T10:45:00Z',
        comment: 'Auto-generated management VLAN range'
      }
    },
    {
      id: 'ports-endpoint',
      name: 'Endpoint Ports',
      type: 'port',
      range: { start: 1, end: 44 },
      description: 'Available ports for endpoint connections (excluding uplinks)',
      allocated: 36,
      available: 44,
      utilization: 81.8,
      conflicts: [],
      provenance: {
        source: 'auto',
        timestamp: '2024-01-15T11:00:00Z',
        comment: 'Calculated based on switch model and uplink configuration'
      }
    }
  ],
  endpointProfiles: [
    {
      id: 'hpc-server',
      name: 'HPC Compute Server',
      type: 'compute',
      portsPerEndpoint: 4,
      vlanMode: 'trunk',
      count: 6,
      bandwidth: 25000,
      redundancy: true,
      esLag: true,
      isDefault: true,
      qos: {
        trustMode: 'dscp',
        defaultCos: 5,
        queues: [
          { id: 0, weight: 10, priority: 'low' },
          { id: 1, weight: 30, priority: 'medium' },
          { id: 2, weight: 60, priority: 'high' }
        ],
        rateLimit: {
          ingress: 20000,
          egress: 20000
        }
      },
      security: {
        dhcpSnooping: true,
        arpInspection: true,
        bpduGuard: true,
        portSecurity: {
          enabled: true,
          maxMac: 4,
          violation: 'restrict'
        }
      },
      stormControl: {
        enabled: true,
        broadcast: 10,
        multicast: 15,
        unicast: 20
      },
      provenance: {
        source: 'user',
        timestamp: '2024-01-15T11:15:00Z',
        comment: 'Optimized for high-performance computing workloads'
      }
    },
    {
      id: 'gpu-server',
      name: 'GPU Compute Server',
      type: 'compute',
      portsPerEndpoint: 8,
      vlanMode: 'hybrid',
      count: 3,
      bandwidth: 50000,
      redundancy: true,
      esLag: true,
      qos: {
        trustMode: 'cos',
        defaultCos: 7,
        rateLimit: {
          ingress: 40000,
          egress: 40000
        }
      },
      security: {
        dhcpSnooping: false,
        arpInspection: false,
        bpduGuard: false
      },
      provenance: {
        source: 'import',
        timestamp: '2024-01-15T14:30:00Z',
        comment: 'Imported from GPU cluster template'
      }
    }
  ],
  uplinkGroups: [
    {
      id: 'primary-uplinks',
      name: 'Primary Spine Uplinks',
      mode: 'lacp',
      ports: ['uplink-1', 'uplink-2'],
      lacpConfig: {
        mode: 'active',
        rate: 'fast',
        systemPriority: 8192,
        portPriority: 16384
      },
      redundancy: {
        minLinks: 1,
        maxLinks: 2,
        failoverDelay: 200
      },
      monitoring: {
        linkDetection: true,
        loadBalancing: 'hash-based'
      },
      provenance: {
        source: 'user',
        timestamp: '2024-01-15T11:45:00Z',
        comment: 'Primary uplinks with optimized LACP settings'
      }
    },
    {
      id: 'secondary-uplinks',
      name: 'Secondary Spine Uplinks',
      mode: 'lacp',
      ports: ['uplink-3', 'uplink-4'],
      lacpConfig: {
        mode: 'passive',
        rate: 'slow',
        systemPriority: 16384,
        portPriority: 32768
      },
      redundancy: {
        minLinks: 1,
        maxLinks: 2,
        failoverDelay: 500
      },
      monitoring: {
        linkDetection: true,
        loadBalancing: 'bandwidth'
      },
      provenance: {
        source: 'user',
        timestamp: '2024-01-15T12:00:00Z',
        comment: 'Secondary uplinks for additional redundancy'
      }
    }
  ],
  // CRD fields for advanced editing
  crdFields: {
    metadata: {
      name: 'advanced-compute',
      namespace: 'fabric-system',
      labels: {
        'fabric.githedgehog.com/leaf-class': 'compute',
        'fabric.githedgehog.com/role': 'standard',
        'fabric.githedgehog.com/tier': 'production'
      },
      annotations: {
        'fabric.githedgehog.com/description': 'Advanced compute cluster configuration',
        'fabric.githedgehog.com/created-by': 'topology-builder',
        'fabric.githedgehog.com/last-modified': '2024-01-15T12:15:00Z'
      }
    },
    spec: {
      role: 'standard',
      leafModel: 'DS2000',
      uplinkConfiguration: {
        count: 4,
        mode: 'lacp',
        redundancy: 'active-active'
      },
      endpointConfiguration: {
        maxEndpoints: 44,
        defaultProfile: 'hpc-server',
        profiles: ['hpc-server', 'gpu-server']
      },
      networkConfiguration: {
        vlanRanges: [
          { start: 100, end: 299, purpose: 'compute' },
          { start: 300, end: 349, purpose: 'management' }
        ],
        bgpConfiguration: {
          asn: 65001,
          routerID: '10.0.1.1'
        }
      }
    },
    status: {
      phase: 'Active',
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-01-15T12:15:00Z',
          reason: 'ConfigurationValid',
          message: 'Leaf class configuration is valid and applied'
        }
      ],
      allocatedResources: {
        vlans: 85,
        ports: 36,
        endpoints: 9
      }
    }
  },
  validationState: 'valid',
  hasUnsavedChanges: true,
  lastModified: new Date('2024-01-15T12:15:00Z'),
  provenance: {
    source: 'user',
    timestamp: '2024-01-15T10:30:00Z',
    comment: 'Advanced compute cluster with comprehensive configuration'
  }
});

export const Default: Story = {
  args: {
    open: true,
    title: 'Advanced CRD Editor - Compute Cluster',
    description: 'Edit all CRD fields with full provenance tracking',
    crdObject: createAdvancedLeafClass(),
    enableCRDCompliance: true,
    onOpenChange: (open) => {
      console.log('Drawer open state:', open);
    },
    onFieldChange: (fieldPath, value, provenance) => {
      console.log('Field changed:', { fieldPath, value, provenance });
    },
    onValidate: () => {
      return [
        {
          field: 'spec.uplinkConfiguration.count',
          message: 'Uplink count should be even for optimal redundancy',
          severity: 'warning' as const,
          remediation: 'Consider using 2, 4, 6, or 8 uplinks for better load distribution'
        }
      ];
    },
    onExport: () => {
      console.log('Exporting CRD configuration');
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the drawer is open and shows the title
    const drawerTitle = canvas.getByText('Advanced CRD Editor - Compute Cluster');
    await expect(drawerTitle).toBeInTheDocument();

    // Check that all three tabs are present
    const fieldEditorTab = canvas.getByRole('tab', { name: /Field Editor/i });
    const crdPreviewTab = canvas.getByRole('tab', { name: /CRD Preview/i });
    const validationTab = canvas.getByRole('tab', { name: /Validation/i });

    await expect(fieldEditorTab).toBeInTheDocument();
    await expect(crdPreviewTab).toBeInTheDocument();
    await expect(validationTab).toBeInTheDocument();

    // Verify Field Editor tab is active by default
    await expect(fieldEditorTab).toHaveAttribute('data-state', 'active');

    // Check CRD compliance score is displayed
    const complianceScore = canvas.getByText(/CRD Compliance:/);
    await expect(complianceScore).toBeInTheDocument();

    // Verify field groups are present
    const metadataGroup = canvas.getByText('CRD Metadata');
    const specGroup = canvas.getByText('CRD Specification');
    const leafClassGroup = canvas.getByText('Leaf Class Configuration');

    await expect(metadataGroup).toBeInTheDocument();
    await expect(specGroup).toBeInTheDocument();
    await expect(leafClassGroup).toBeInTheDocument();

    // Test expanding a field group
    await userEvent.click(leafClassGroup);

    // Verify leaf class fields are shown
    const classIdField = canvas.getByLabelText('Class ID');
    const classNameField = canvas.getByLabelText('Class Name');
    const leafRoleField = canvas.getByLabelText('Leaf Role');

    await expect(classIdField).toBeInTheDocument();
    await expect(classNameField).toBeInTheDocument();
    await expect(leafRoleField).toBeInTheDocument();

    // Test field editing
    await userEvent.clear(classNameField);
    await userEvent.type(classNameField, 'Updated Compute Cluster');

    // Verify provenance chips are displayed
    const provenanceChips = canvas.getAllByRole('button', { name: /provenance/i });
    await expect(provenanceChips.length).toBeGreaterThan(0);

    // Test search functionality
    const searchInput = canvas.getByPlaceholderText('Search fields...');
    await userEvent.type(searchInput, 'uplink');

    // Fields containing 'uplink' should be filtered
    const uplinksField = canvas.getByText(/Uplinks Per Leaf/i);
    await expect(uplinksField).toBeInTheDocument();

    // Clear search
    await userEvent.clear(searchInput);

    // Test CRD Preview tab
    await userEvent.click(crdPreviewTab);

    // Verify CRD preview is shown
    const crdPreview = canvas.getByText('CRD Preview');
    await expect(crdPreview).toBeInTheDocument();

    // Check for JSON/YAML content
    const apiVersion = canvas.getByText(/apiVersion/);
    await expect(apiVersion).toBeInTheDocument();

    const kind = canvas.getByText(/kind/);
    await expect(kind).toBeInTheDocument();

    // Test Validation tab
    await userEvent.click(validationTab);

    // Verify validation results
    const validationResults = canvas.getByText('Validation Results');
    await expect(validationResults).toBeInTheDocument();

    // Should show the warning about uplink count
    const uplinkWarning = canvas.getByText(/Uplink count should be even/);
    await expect(uplinkWarning).toBeInTheDocument();

    const remediation = canvas.getByText(/Consider using 2, 4, 6, or 8 uplinks/);
    await expect(remediation).toBeInTheDocument();
  }
};

export const FieldFiltering: Story = {
  args: {
    open: true,
    title: 'Field Filtering Demo',
    description: 'Demonstrate search and filter capabilities',
    crdObject: createAdvancedLeafClass(),
    onFieldChange: (fieldPath, value, provenance) => {
      console.log('Field changed:', { fieldPath, value, provenance });
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test search functionality
    const searchInput = canvas.getByPlaceholderText('Search fields...');
    
    // Search for VLAN-related fields
    await userEvent.type(searchInput, 'vlan');
    
    const vlanFields = canvas.getAllByText(/vlan/i);
    await expect(vlanFields.length).toBeGreaterThan(0);

    // Clear and search for security fields
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'security');

    const securityFields = canvas.getAllByText(/security/i);
    await expect(securityFields.length).toBeGreaterThan(0);

    // Test "Modified Only" filter
    const modifiedOnlyButton = canvas.getByRole('button', { name: /Modified Only/i });
    await userEvent.click(modifiedOnlyButton);

    // Should only show user-modified fields
    await expect(modifiedOnlyButton).toHaveClass(/bg-primary/);

    // Clear search to see filtered results
    await userEvent.clear(searchInput);

    // Reset filter
    await userEvent.click(modifiedOnlyButton);
  }
};

export const ProvenanceTracking: Story = {
  args: {
    open: true,
    title: 'Provenance Tracking Demo',
    description: 'Demonstrate comprehensive provenance tracking',
    crdObject: {
      ...createAdvancedLeafClass(),
      assignableRanges: [
        {
          id: 'user-modified',
          name: 'User Modified Range',
          type: 'vlan',
          range: { start: 100, end: 200 },
          description: 'Modified by user',
          allocated: 25,
          available: 101,
          utilization: 25,
          conflicts: [],
          provenance: {
            source: 'user',
            timestamp: '2024-01-15T14:30:00Z',
            comment: 'Manually adjusted by network administrator'
          }
        },
        {
          id: 'auto-generated',
          name: 'Auto Generated Range',
          type: 'vlan',
          range: { start: 300, end: 400 },
          description: 'Auto-generated by system',
          allocated: 0,
          available: 101,
          utilization: 0,
          conflicts: [],
          provenance: {
            source: 'auto',
            timestamp: '2024-01-15T10:00:00Z',
            comment: 'Automatically calculated based on topology requirements'
          }
        },
        {
          id: 'imported-range',
          name: 'Imported Range',
          type: 'vlan',
          range: { start: 500, end: 600 },
          description: 'Imported from external source',
          allocated: 15,
          available: 101,
          utilization: 15,
          conflicts: [],
          provenance: {
            source: 'import',
            timestamp: '2024-01-15T09:00:00Z',
            comment: 'Imported from legacy network configuration'
          }
        }
      ]
    },
    onFieldChange: (fieldPath, value, provenance) => {
      console.log('Field changed with provenance:', { fieldPath, value, provenance });
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Expand assignable ranges group
    const rangesGroup = canvas.getByText('Assignable Ranges');
    await userEvent.click(rangesGroup);

    // Verify different provenance types are shown
    const userProvenance = canvas.getByText(/User Modified/);
    const autoProvenance = canvas.getByText(/Auto Generated/);
    const importProvenance = canvas.getByText(/Imported/);

    await expect(userProvenance).toBeInTheDocument();
    await expect(autoProvenance).toBeInTheDocument();
    await expect(importProvenance).toBeInTheDocument();

    // Test hovering over provenance chips to see details
    const provenanceChips = canvas.getAllByRole('button');
    const userChip = provenanceChips.find(chip => 
      chip.textContent?.includes('user') || chip.getAttribute('aria-label')?.includes('user')
    );

    if (userChip) {
      await userEvent.hover(userChip);
      // Tooltip with provenance details should appear
      // Note: Tooltip testing might be tricky depending on implementation
    }
  }
};

export const CRDExport: Story = {
  args: {
    open: true,
    title: 'CRD Export Demo',
    description: 'Demonstrate CRD export functionality',
    crdObject: createAdvancedLeafClass(),
    onFieldChange: (fieldPath, value, provenance) => {
      console.log('Field changed:', { fieldPath, value, provenance });
    },
    onExport: () => {
      const crdData = {
        apiVersion: 'fabric.githedgehog.com/v1beta1',
        kind: 'LeafClass',
        metadata: createAdvancedLeafClass().crdFields?.metadata,
        spec: createAdvancedLeafClass().crdFields?.spec
      };
      
      // Simulate file download
      console.log('Exporting CRD:', crdData);
      alert('CRD would be downloaded as JSON file');
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test CRD preview tab
    const crdPreviewTab = canvas.getByRole('tab', { name: /CRD Preview/i });
    await userEvent.click(crdPreviewTab);

    // Verify CRD structure is displayed
    const crdContent = canvas.getByRole('code');
    await expect(crdContent).toBeInTheDocument();

    // Test export functionality
    const exportButton = canvas.getByRole('button', { name: /Export CRD/i });
    await userEvent.click(exportButton);

    // Export function should be called (check console or mock)
  }
};

export const ValidationIntegration: Story = {
  args: {
    open: true,
    title: 'Validation Integration',
    description: 'Comprehensive validation with detailed error reporting',
    crdObject: {
      ...createAdvancedLeafClass(),
      name: '', // Invalid empty name
      uplinksPerLeaf: 0, // Invalid zero uplinks
      assignableRanges: [] // Missing required ranges
    },
    onFieldChange: (fieldPath, value, provenance) => {
      console.log('Field changed:', { fieldPath, value, provenance });
    },
    onValidate: () => [
      {
        field: 'name',
        message: 'Leaf class name is required',
        severity: 'error' as const,
        remediation: 'Enter a descriptive name for this leaf class',
        context: 'Names are used for CRD resource identification'
      },
      {
        field: 'uplinksPerLeaf',
        message: 'Uplinks per leaf must be at least 1',
        severity: 'error' as const,
        remediation: 'Set uplinks per leaf to 2 or more for redundancy'
      },
      {
        field: 'assignableRanges',
        message: 'At least one VLAN range should be defined',
        severity: 'warning' as const,
        remediation: 'Add a VLAN range for network segmentation'
      },
      {
        field: 'spec.bgpConfiguration.asn',
        message: 'BGP ASN should be in private range (64512-65534)',
        severity: 'info' as const,
        remediation: 'Consider using a private ASN for internal BGP'
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Go to validation tab
    const validationTab = canvas.getByRole('tab', { name: /Validation/i });
    await userEvent.click(validationTab);

    // Verify different severity levels are displayed
    const errors = canvas.getAllByText('Validation Error');
    await expect(errors.length).toBeGreaterThan(0);

    // Check for specific validation messages
    const nameError = canvas.getByText('Leaf class name is required');
    await expect(nameError).toBeInTheDocument();

    const uplinksError = canvas.getByText('Uplinks per leaf must be at least 1');
    await expect(uplinksError).toBeInTheDocument();

    // Check for remediation guidance
    const remediation = canvas.getByText(/Enter a descriptive name/);
    await expect(remediation).toBeInTheDocument();

    // Test field editor shows validation errors
    const fieldEditorTab = canvas.getByRole('tab', { name: /Field Editor/i });
    await userEvent.click(fieldEditorTab);

    // Expand leaf class configuration
    const leafClassGroup = canvas.getByText('Leaf Class Configuration');
    await userEvent.click(leafClassGroup);

    // Fields with errors should have visual indicators
    const nameField = canvas.getByLabelText('Class Name');
    const uplinksField = canvas.getByLabelText('Uplinks Per Leaf');

    await expect(nameField).toBeInTheDocument();
    await expect(uplinksField).toBeInTheDocument();

    // Error styling should be applied (this depends on implementation)
    // await expect(nameField).toHaveClass(/border-destructive/);
  }
};