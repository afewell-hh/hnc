/**
 * GFD Endpoints Mixed LAG Stories - WP-GFD2
 * Advanced LAG configuration scenarios with MC-LAG and mixed profiles
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import React, { useState } from 'react'
import MultiProfileEndpointEditor, { 
  type EndpointProfile,
  type LAGConfiguration 
} from '../components/gfd/MultiProfileEndpointEditor'

const meta = {
  title: 'GFD/EndpointsMixedLAG',
  component: MultiProfileEndpointEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Mixed LAG configuration scenarios - WP-GFD2'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof MultiProfileEndpointEditor>

export default meta
type Story = StoryObj<typeof meta>

const mixedLAGProfiles: EndpointProfile[] = [
  {
    id: 'no-lag',
    name: 'Management Servers',
    description: 'Out-of-band management',
    nicSpeed: '10G',
    nicCount: 1,
    serverCount: 4,
    lagConfig: {
      enabled: false,
      mode: 'lacp',
      loadBalancing: 'L3+L4'
    }
  },
  {
    id: 'basic-lag',
    name: 'Database Servers',
    description: 'Database cluster with basic LAG',
    nicSpeed: '25G',
    nicCount: 2,
    serverCount: 12,
    lagConfig: {
      enabled: true,
      mode: 'lacp',
      loadBalancing: 'L3+L4',
      lacpRate: 'slow',
      minLinks: 1
    }
  },
  {
    id: 'mclag',
    name: 'Storage Servers',
    description: 'Storage cluster with MC-LAG',
    nicSpeed: '25G',
    nicCount: 4,
    serverCount: 8,
    lagConfig: {
      enabled: true,
      mode: 'lacp',
      loadBalancing: 'L3+L4',
      lacpRate: 'fast',
      minLinks: 2,
      mclag: true
    }
  },
  {
    id: 'active-standby',
    name: 'Legacy Application',
    description: 'Active-standby for legacy compatibility',
    nicSpeed: '10G',
    nicCount: 2,
    serverCount: 6,
    lagConfig: {
      enabled: true,
      mode: 'active-standby',
      loadBalancing: 'L2'
    }
  }
]

export const MixedLAGModes: Story = {
  name: '1. Mixed LAG Modes',
  args: {
    profiles: mixedLAGProfiles,
    maxEndpoints: 100,
    leafCapacity: {
      portsPerLeaf: 48,
      speedsSupported: ['10G', '25G', '100G']
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify all profiles present
    expect(canvas.getByText('Management Servers')).toBeInTheDocument()
    expect(canvas.getByText('Database Servers')).toBeInTheDocument()
    expect(canvas.getByText('Storage Servers')).toBeInTheDocument()
    expect(canvas.getByText('Legacy Application')).toBeInTheDocument()
    
    // Check LAG indicators
    expect(canvas.getByText('4 servers × 1 × 10G')).toBeInTheDocument() // No LAG
    expect(canvas.getByText('12 servers × 2 × 25G (LAG)')).toBeInTheDocument()
    expect(canvas.getByText('8 servers × 4 × 25G (LAG)')).toBeInTheDocument()
    expect(canvas.getByText('6 servers × 2 × 10G (LAG)')).toBeInTheDocument()
    
    // Expand storage servers to check MC-LAG
    const storageCard = canvas.getByText('Storage Servers').closest('.profile-card')
    if (storageCard) {
      await userEvent.click(within(storageCard).getByText('+'))
      
      // Verify MC-LAG is enabled
      const mclagCheckbox = canvas.getByLabelText(/Enable MC-LAG/)
      expect(mclagCheckbox).toBeChecked()
      
      // Verify LACP fast rate
      expect(canvas.getByDisplayValue('Fast (1s)')).toBeInTheDocument()
      
      // Verify min links
      const minLinksInput = canvas.getByDisplayValue('2')
      expect(minLinksInput).toBeInTheDocument()
    }
  }
}

export const ConfigureMCLAG: Story = {
  name: '2. Configure MC-LAG',
  render: () => {
    const [profiles, setProfiles] = useState<EndpointProfile[]>([
      {
        id: 'test-mclag',
        name: 'Test MC-LAG',
        nicSpeed: '100G',
        nicCount: 4,
        serverCount: 10,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4',
          lacpRate: 'slow',
          minLinks: 1,
          mclag: false
        }
      }
    ])
    
    return (
      <MultiProfileEndpointEditor
        profiles={profiles}
        onChange={setProfiles}
        maxEndpoints={100}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Expand profile
    await userEvent.click(canvas.getByText('+'))
    
    // Enable MC-LAG
    const mclagCheckbox = canvas.getByLabelText(/Enable MC-LAG/)
    expect(mclagCheckbox).not.toBeChecked()
    await userEvent.click(mclagCheckbox)
    
    // Should now be enabled
    expect(mclagCheckbox).toBeChecked()
    
    // Check LAG summary updates
    expect(canvas.getByText(/MC-LAG: Links split across leaf pairs/)).toBeInTheDocument()
    
    // Change to fast LACP
    const lacpRateSelect = canvas.getByLabelText('LACP Rate:')
    await userEvent.selectOptions(lacpRateSelect, 'fast')
    
    // Update min links
    const minLinksInput = canvas.getByLabelText('Min Links:')
    await userEvent.clear(minLinksInput)
    await userEvent.type(minLinksInput, '2')
    
    // Verify redundancy calculation
    expect(canvas.getByText('Redundancy: 2 link fault tolerance')).toBeInTheDocument()
  }
}

export const LAGValidationScenarios: Story = {
  name: '3. LAG Validation Scenarios',
  args: {
    profiles: [
      {
        id: 'invalid-lag-1',
        name: 'Invalid: LAG with 1 NIC',
        nicSpeed: '25G',
        nicCount: 1,
        serverCount: 5,
        lagConfig: {
          enabled: true, // Error: needs 2+ NICs
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      },
      {
        id: 'invalid-lag-2',
        name: 'Invalid: Min Links > NICs',
        nicSpeed: '25G',
        nicCount: 2,
        serverCount: 5,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4',
          minLinks: 3 // Error: only 2 NICs
        }
      },
      {
        id: 'warning-mclag',
        name: 'Warning: MC-LAG with 2 NICs',
        nicSpeed: '25G',
        nicCount: 2,
        serverCount: 5,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4',
          mclag: true // Warning: low NIC count for MC-LAG
        }
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show validation errors
    expect(canvas.getByText(/Errors \(2\)/)).toBeInTheDocument()
    expect(canvas.getByText(/Warnings \(1\)/)).toBeInTheDocument()
    
    // Specific validation messages
    expect(canvas.getByText(/LAG enabled but only 1 NIC/)).toBeInTheDocument()
    expect(canvas.getByText(/Min links \(3\) exceeds NIC count \(2\)/)).toBeInTheDocument()
    expect(canvas.getByText(/MC-LAG with only 2 NICs may limit redundancy/)).toBeInTheDocument()
    
    // Check error badges on profiles
    const errorBadges = canvas.getAllByClassName('error-badge')
    expect(errorBadges.length).toBe(2)
    
    const warningBadges = canvas.getAllByClassName('warning-badge')
    expect(warningBadges.length).toBe(1)
  }
}

export const LoadBalancingOptions: Story = {
  name: '4. Load Balancing Options',
  render: () => {
    const [profiles, setProfiles] = useState<EndpointProfile[]>([
      {
        id: 'lb-test',
        name: 'Load Balancing Test',
        nicSpeed: '25G',
        nicCount: 4,
        serverCount: 10,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L2',
          lacpRate: 'slow'
        }
      }
    ])
    
    return (
      <MultiProfileEndpointEditor
        profiles={profiles}
        onChange={setProfiles}
        maxEndpoints={100}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Expand profile
    await userEvent.click(canvas.getByText('+'))
    
    // Test all load balancing modes
    const lbSelect = canvas.getByLabelText('Load Balancing:')
    
    // Layer 2
    expect(canvas.getByDisplayValue('Layer 2 (MAC)')).toBeInTheDocument()
    
    // Change to Layer 3
    await userEvent.selectOptions(lbSelect, 'L3')
    expect(canvas.getByDisplayValue('Layer 3 (IP)')).toBeInTheDocument()
    
    // Change to Layer 4
    await userEvent.selectOptions(lbSelect, 'L4')
    expect(canvas.getByDisplayValue('Layer 4 (Port)')).toBeInTheDocument()
    
    // Change to Layer 3+4
    await userEvent.selectOptions(lbSelect, 'L3+L4')
    expect(canvas.getByDisplayValue('Layer 3+4 (IP+Port)')).toBeInTheDocument()
    
    // Verify LAG summary shows current mode
    expect(canvas.getByText('Mode: LACP')).toBeInTheDocument()
    expect(canvas.getByText('Total Bandwidth: 100G per server')).toBeInTheDocument()
  }
}

export const ActiveStandbyConfiguration: Story = {
  name: '5. Active-Standby Configuration',
  args: {
    profiles: [
      {
        id: 'active-standby',
        name: 'HA Critical Services',
        nicSpeed: '10G',
        nicCount: 2,
        serverCount: 8,
        lagConfig: {
          enabled: true,
          mode: 'active-standby',
          loadBalancing: 'L2' // Only L2 for active-standby
        }
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Expand profile
    await userEvent.click(canvas.getByText('+'))
    
    // Verify active-standby mode
    expect(canvas.getByDisplayValue('Active-Standby')).toBeInTheDocument()
    
    // LACP-specific options should not be visible
    expect(canvas.queryByLabelText('LACP Rate:')).not.toBeInTheDocument()
    
    // MC-LAG should not be available for active-standby
    const lagSection = canvas.getByText('LAG Configuration').parentElement
    if (lagSection) {
      expect(within(lagSection).queryByLabelText(/Enable MC-LAG/)).not.toBeInTheDocument()
    }
    
    // Verify LAG summary
    expect(canvas.getByText('Mode: ACTIVE-STANDBY')).toBeInTheDocument()
    expect(canvas.getByText('Total Bandwidth: 20G per server')).toBeInTheDocument()
    expect(canvas.getByText('Redundancy: 1 link fault tolerance')).toBeInTheDocument()
  }
}

export const ComplexMixedEnvironment: Story = {
  name: '6. Complex Mixed Environment',
  args: {
    profiles: [
      {
        id: 'compute-gpu',
        name: 'GPU Compute (No LAG/RDMA)',
        nicSpeed: '100G',
        nicCount: 8,
        serverCount: 16,
        lagConfig: {
          enabled: false, // No LAG for RDMA
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        },
        rackDistribution: 'single'
      },
      {
        id: 'storage-ceph',
        name: 'Ceph Storage (MC-LAG)',
        nicSpeed: '25G',
        nicCount: 4,
        serverCount: 24,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4',
          lacpRate: 'fast',
          minLinks: 2,
          mclag: true
        },
        rackDistribution: 'distributed'
      },
      {
        id: 'database-oracle',
        name: 'Oracle RAC (LACP)',
        nicSpeed: '100G',
        nicCount: 2,
        serverCount: 8,
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3',
          lacpRate: 'slow',
          minLinks: 1
        },
        rackDistribution: 'per-leaf'
      },
      {
        id: 'web-frontend',
        name: 'Web Frontend (Active-Active)',
        nicSpeed: '10G',
        nicCount: 2,
        serverCount: 40,
        lagConfig: {
          enabled: true,
          mode: 'active-active',
          loadBalancing: 'L3+L4'
        },
        rackDistribution: 'distributed'
      },
      {
        id: 'management',
        name: 'Management (Single NIC)',
        nicSpeed: '10G',
        nicCount: 1,
        serverCount: 6,
        lagConfig: {
          enabled: false,
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        },
        rackDistribution: 'single'
      }
    ],
    maxEndpoints: 200,
    leafCapacity: {
      portsPerLeaf: 48,
      speedsSupported: ['10G', '25G', '100G']
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify all profiles
    expect(canvas.getByText('GPU Compute (No LAG/RDMA)')).toBeInTheDocument()
    expect(canvas.getByText('Ceph Storage (MC-LAG)')).toBeInTheDocument()
    expect(canvas.getByText('Oracle RAC (LACP)')).toBeInTheDocument()
    expect(canvas.getByText('Web Frontend (Active-Active)')).toBeInTheDocument()
    expect(canvas.getByText('Management (Single NIC)')).toBeInTheDocument()
    
    // Check totals
    expect(canvas.getByText('Total Servers: 94')).toBeInTheDocument()
    expect(canvas.getByText('Total Ports: 376')).toBeInTheDocument()
    expect(canvas.getByText('Profiles: 5')).toBeInTheDocument()
    
    // Verify no errors with this complex config
    expect(canvas.getByText('✅ All endpoint profiles are valid')).toBeInTheDocument()
    
    // Expand Ceph storage to verify MC-LAG config
    const cephCard = canvas.getByText('Ceph Storage (MC-LAG)').closest('.profile-card')
    if (cephCard) {
      await userEvent.click(within(cephCard).getByText('+'))
      
      // Verify MC-LAG settings
      const mclagCheckbox = canvas.getByLabelText(/Enable MC-LAG/)
      expect(mclagCheckbox).toBeChecked()
      
      // Verify fast LACP
      expect(canvas.getByDisplayValue('Fast (1s)')).toBeInTheDocument()
      
      // Verify min links = 2
      expect(canvas.getByDisplayValue('2')).toBeInTheDocument()
      
      // Check LAG summary
      expect(canvas.getByText('MC-LAG: Links split across leaf pairs')).toBeInTheDocument()
      expect(canvas.getByText('Total Bandwidth: 100G per server')).toBeInTheDocument()
      expect(canvas.getByText('Redundancy: 2 link fault tolerance')).toBeInTheDocument()
    }
  }
}