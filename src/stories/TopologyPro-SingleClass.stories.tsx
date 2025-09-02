/**
 * TopologyPro/SingleClass Story
 * Demonstrates simple single leaf class configuration with the new CRD-aligned model
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { LeafClassBuilder } from '../components/LeafClassBuilder';
import type { TopologyConfig, LeafClassConfigUI } from '../types/leaf-class-builder.types';

const meta: Meta<typeof LeafClassBuilder> = {
  title: 'TopologyPro/SingleClass',
  component: LeafClassBuilder,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
**TopologyPro/SingleClass** demonstrates the simplest path through the Leaf Class Builder.

This story shows:
- Single leaf class creation with default settings
- Basic range and profile configuration
- CRD compliance validation
- Progressive disclosure from simple to advanced
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

// Mock single leaf class configuration
const createSingleClassConfig = (): TopologyConfig => ({
  name: 'Simple Compute Fabric',
  description: 'Single leaf class for standard compute workloads',
  leafClasses: [
    {
      id: 'compute-standard',
      name: 'Standard Compute',
      role: 'standard',
      uplinksPerLeaf: 2,
      count: 4,
      leafModelId: 'DS2000',
      assignableRanges: [
        {
          id: 'vlan-compute',
          name: 'Compute VLANs',
          type: 'vlan',
          range: { start: 100, end: 200 },
          description: 'VLANs for compute workloads',
          allocated: 25,
          available: 101,
          utilization: 25,
          conflicts: [],
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Created via Single Class Builder'
          }
        }
      ],
      endpointProfiles: [
        {
          id: 'standard-server',
          name: 'Standard Server',
          type: 'server',
          portsPerEndpoint: 2,
          vlanMode: 'access',
          count: 20,
          bandwidth: 1000,
          redundancy: true,
          isDefault: true,
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Default profile for standard servers'
          }
        }
      ],
      uplinkGroups: [
        {
          id: 'spine-uplinks',
          name: 'Spine Uplinks',
          mode: 'lacp',
          ports: ['uplink-1', 'uplink-2'],
          lacpConfig: {
            mode: 'active',
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
            loadBalancing: 'hash-based'
          },
          provenance: {
            source: 'user',
            timestamp: new Date().toISOString(),
            comment: 'Standard spine uplinks with LACP'
          }
        }
      ],
      validationState: 'valid',
      hasUnsavedChanges: false,
      isExpanded: true,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Single leaf class configuration'
      }
    }
  ],
  fabricSettings: {
    spineModel: 'DS3000',
    spineCount: 2,
    fabricASN: 65100,
    loopbackSubnet: '10.0.0.0/24',
    vtepSubnet: '10.1.0.0/24',
    fabricSubnet: '10.2.0.0/24'
  },
  globalSettings: {
    defaultUplinksPerLeaf: 2,
    breakoutEnabled: false,
    lacpEnabled: true,
    mclagEnabled: false
  },
  crdCompliant: true,
  crdVersion: 'v1beta1',
  lastValidated: new Date(),
  provenance: {
    source: 'user',
    timestamp: new Date().toISOString(),
    comment: 'Simple single class topology'
  }
});

export const Default: Story = {
  args: {
    initialConfig: createSingleClassConfig(),
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Config changed:', config);
    },
    onValidate: (context) => {
      // Basic validation for single class
      const errors = [];
      
      if (!context.leafClass.name.trim()) {
        errors.push({
          field: 'name',
          message: 'Leaf class name is required',
          severity: 'error' as const,
          remediation: 'Enter a descriptive name for this leaf class'
        });
      }
      
      if (context.leafClass.uplinksPerLeaf < 1) {
        errors.push({
          field: 'uplinksPerLeaf',
          message: 'At least one uplink per leaf is required',
          severity: 'error' as const,
          remediation: 'Set uplinks per leaf to at least 1'
        });
      }

      if (context.leafClass.endpointProfiles.length === 0) {
        errors.push({
          field: 'endpointProfiles',
          message: 'At least one endpoint profile is required',
          severity: 'warning' as const,
          remediation: 'Create an endpoint profile to define server connections'
        });
      }

      return errors;
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the component loads with single leaf class
    const leafClassBuilder = canvas.getByText('Leaf Class Builder');
    await expect(leafClassBuilder).toBeInTheDocument();

    // Check that the single leaf class is displayed
    const computeStandardCard = canvas.getByText('Standard Compute');
    await expect(computeStandardCard).toBeInTheDocument();

    // Verify the leaf class is selected by default
    const selectedClass = canvas.getByRole('region', { name: /Standard Compute/ });
    await expect(selectedClass).toHaveClass(/ring-2/);

    // Check basic configuration tab is active
    const basicTab = canvas.getByRole('tab', { name: /Basic/i });
    await expect(basicTab).toHaveAttribute('data-state', 'active');

    // Verify basic fields are populated
    const nameInput = canvas.getByLabelText('Leaf class name') as HTMLInputElement;
    await expect(nameInput.value).toBe('Standard Compute');

    const roleSelect = canvas.getByLabelText('Role');
    await expect(roleSelect).toHaveTextContent('Standard Leaf');

    const uplinksInput = canvas.getByLabelText('Uplinks Per Leaf') as HTMLInputElement;
    await expect(uplinksInput.value).toBe('2');

    // Test navigation to ranges tab
    const rangesTab = canvas.getByRole('tab', { name: /Ranges/i });
    await userEvent.click(rangesTab);
    
    // Verify ranges content is displayed
    const assignableRanges = canvas.getByText('Assignable Ranges');
    await expect(assignableRanges).toBeInTheDocument();

    // Check that VLAN range is displayed
    const vlanRange = canvas.getByText('Compute VLANs');
    await expect(vlanRange).toBeInTheDocument();

    // Test navigation to profiles tab
    const profilesTab = canvas.getByRole('tab', { name: /Profiles/i });
    await userEvent.click(profilesTab);

    // Verify profiles content is displayed
    const endpointProfiles = canvas.getByText('Endpoint Profiles');
    await expect(endpointProfiles).toBeInTheDocument();

    // Check that standard server profile is displayed with default badge
    const standardServerProfile = canvas.getByText('Standard Server');
    await expect(standardServerProfile).toBeInTheDocument();
    
    const defaultBadge = canvas.getByText('Default');
    await expect(defaultBadge).toBeInTheDocument();

    // Test navigation to uplinks tab
    const uplinksTab = canvas.getByRole('tab', { name: /Uplinks/i });
    await userEvent.click(uplinksTab);

    // Verify uplinks content is displayed
    const uplinkGroups = canvas.getByText('Uplink Groups');
    await expect(uplinkGroups).toBeInTheDocument();

    // Check that spine uplinks group is displayed
    const spineUplinks = canvas.getByText('Spine Uplinks');
    await expect(spineUplinks).toBeInTheDocument();

    // Test validation tab
    const validationTab = canvas.getByRole('tab', { name: /Validate/i });
    await userEvent.click(validationTab);

    // Since this is a valid config, we should see success message
    const validationButton = canvas.getByRole('button', { name: /Validate All Classes/i });
    await userEvent.click(validationButton);

    // Look for validation success (this might take a moment to appear)
    const validationSuccess = await canvas.findByText('All Validations Passed');
    await expect(validationSuccess).toBeInTheDocument();
  }
};

export const EmptyState: Story = {
  args: {
    initialConfig: {
      name: 'New Topology',
      leafClasses: [],
      fabricSettings: {
        spineModel: 'DS3000',
        spineCount: 2,
        fabricASN: 65100
      },
      crdCompliant: true,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Empty topology for new configuration'
      }
    },
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Config changed:', config);
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify empty state is displayed
    const noLeafClasses = canvas.getByText('No Leaf Classes');
    await expect(noLeafClasses).toBeInTheDocument();

    // Test creating a new leaf class
    const addClassButton = canvas.getByRole('button', { name: /Add Class/i });
    await userEvent.click(addClassButton);

    // Verify new leaf class appears in the list
    const newLeafClass = await canvas.findByText(/Leaf Class 1/);
    await expect(newLeafClass).toBeInTheDocument();

    // Verify it's automatically selected
    const basicTab = canvas.getByRole('tab', { name: /Basic/i });
    await expect(basicTab).toHaveAttribute('data-state', 'active');
  }
};

export const ValidationErrors: Story = {
  args: {
    initialConfig: {
      ...createSingleClassConfig(),
      leafClasses: [
        {
          ...createSingleClassConfig().leafClasses[0],
          name: '', // Invalid empty name
          uplinksPerLeaf: 0, // Invalid zero uplinks
          endpointProfiles: [], // Invalid empty profiles
          validationState: 'error'
        }
      ]
    },
    enableAdvancedFeatures: true,
    enableCRDExport: true,
    onConfigChange: (config) => {
      console.log('Config changed:', config);
    },
    onValidate: (context) => [
      {
        field: 'name',
        message: 'Leaf class name is required',
        severity: 'error' as const,
        remediation: 'Enter a descriptive name for this leaf class'
      },
      {
        field: 'uplinksPerLeaf',
        message: 'At least one uplink per leaf is required',
        severity: 'error' as const,
        remediation: 'Set uplinks per leaf to at least 1'
      },
      {
        field: 'endpointProfiles',
        message: 'At least one endpoint profile is required',
        severity: 'warning' as const,
        remediation: 'Create an endpoint profile to define server connections'
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the leaf class with validation errors (should have red border)
    const leafClassCard = canvas.getByRole('region', { name: /Leaf Class/ });
    await expect(leafClassCard).toHaveClass(/border-destructive/);

    // Test validation tab shows errors
    const validationTab = canvas.getByRole('tab', { name: /Validate/i });
    await userEvent.click(validationTab);

    const validationButton = canvas.getByRole('button', { name: /Validate All Classes/i });
    await userEvent.click(validationButton);

    // Should see validation errors
    const validationError = await canvas.findByText('Validation Error');
    await expect(validationError).toBeInTheDocument();

    const nameError = canvas.getByText('Leaf class name is required');
    await expect(nameError).toBeInTheDocument();

    const uplinksError = canvas.getByText('At least one uplink per leaf is required');
    await expect(uplinksError).toBeInTheDocument();
  }
};