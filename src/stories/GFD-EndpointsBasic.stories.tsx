/**
 * GFD Endpoints Basic Stories - WP-GFD2
 * Basic endpoint profile configuration scenarios
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import React, { useState } from 'react'
import MultiProfileEndpointEditor, { 
  type EndpointProfile 
} from '../components/gfd/MultiProfileEndpointEditor'

const meta = {
  title: 'GFD/EndpointsBasic',
  component: MultiProfileEndpointEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Basic endpoint profile configuration - WP-GFD2'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof MultiProfileEndpointEditor>

export default meta
type Story = StoryObj<typeof meta>

const basicProfiles: EndpointProfile[] = [
  {
    id: 'web-servers',
    name: 'Web Servers',
    description: 'Frontend web servers',
    nicSpeed: '10G',
    nicCount: 2,
    serverCount: 20,
    lagConfig: {
      enabled: false,
      mode: 'lacp',
      loadBalancing: 'L3+L4'
    }
  },
  {
    id: 'app-servers',
    name: 'Application Servers',
    description: 'Backend application servers',
    nicSpeed: '25G',
    nicCount: 2,
    serverCount: 30,
    lagConfig: {
      enabled: true,
      mode: 'lacp',
      loadBalancing: 'L3+L4',
      lacpRate: 'slow',
      minLinks: 1
    }
  }
]

export const SingleProfileSimple: Story = {
  name: '1. Single Profile Simple',
  args: {
    profiles: [basicProfiles[0]],
    maxEndpoints: 100,
    leafCapacity: {
      portsPerLeaf: 48,
      speedsSupported: ['10G', '25G', '100G']
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify basic profile display
    expect(canvas.getByText('Web Servers')).toBeInTheDocument()
    expect(canvas.getByText('20 servers × 2 × 10G')).toBeInTheDocument()
    
    // Verify summary stats
    expect(canvas.getByText('Total Servers: 20')).toBeInTheDocument()
    expect(canvas.getByText('Total Ports: 40')).toBeInTheDocument()
    
    // Expand profile
    const expandBtn = canvas.getByText('+')
    await userEvent.click(expandBtn)
    
    // Verify configuration fields
    expect(canvas.getByDisplayValue('Web Servers')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('20')).toBeInTheDocument()
    
    // LAG should be disabled
    const lagCheckbox = canvas.getByLabelText(/Enable Link Aggregation/)
    expect(lagCheckbox).not.toBeChecked()
  }
}

export const DualProfileWithLAG: Story = {
  name: '2. Dual Profile with LAG',
  args: {
    profiles: basicProfiles,
    maxEndpoints: 100
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify both profiles
    expect(canvas.getByText('Web Servers')).toBeInTheDocument()
    expect(canvas.getByText('Application Servers')).toBeInTheDocument()
    
    // Check LAG indicator on app servers
    expect(canvas.getByText('30 servers × 2 × 25G (LAG)')).toBeInTheDocument()
    
    // Expand app servers profile
    const appServerCard = canvas.getByText('Application Servers').closest('.profile-card')
    if (appServerCard) {
      const expandBtn = within(appServerCard).getByText('+')
      await userEvent.click(expandBtn)
      
      // Verify LAG is enabled
      const lagSection = canvas.getByText('LAG Configuration').parentElement
      if (lagSection) {
        const lagCheckbox = within(lagSection).getByLabelText(/Enable Link Aggregation/)
        expect(lagCheckbox).toBeChecked()
        
        // Verify LAG mode
        expect(canvas.getByDisplayValue('LACP (802.3ad)')).toBeInTheDocument()
        expect(canvas.getByDisplayValue('Layer 3+4 (IP+Port)')).toBeInTheDocument()
      }
    }
    
    // Check totals
    expect(canvas.getByText('Total Servers: 50')).toBeInTheDocument()
    expect(canvas.getByText('Total Ports: 100')).toBeInTheDocument()
  }
}

export const AddNewProfile: Story = {
  name: '3. Add New Profile',
  args: {
    profiles: [basicProfiles[0]],
    maxEndpoints: 100
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Click add profile button
    const addBtn = canvas.getByText('+ Add Profile')
    await userEvent.click(addBtn)
    
    // Should show add profile form
    expect(canvas.getByText('Add New Profile')).toBeInTheDocument()
    
    // Click create
    const createBtn = canvas.getByText('Create Profile')
    await userEvent.click(createBtn)
    
    // Should add new profile
    expect(canvas.getByText('Profile 2')).toBeInTheDocument()
    expect(canvas.getByText('Profiles: 2')).toBeInTheDocument()
  }
}

export const ValidationErrors: Story = {
  name: '4. Validation Errors',
  args: {
    profiles: [
      {
        id: 'invalid-1',
        name: '', // Empty name
        nicSpeed: '25G',
        nicCount: 1,
        serverCount: 0, // Invalid count
        lagConfig: {
          enabled: true, // LAG with only 1 NIC
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      },
      {
        id: 'over-capacity',
        name: 'Over Capacity',
        nicSpeed: '100G',
        nicCount: 2,
        serverCount: 200, // Exceeds max
        lagConfig: {
          enabled: false,
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      }
    ],
    maxEndpoints: 100
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show validation errors
    expect(canvas.getByText(/Errors \(4\)/)).toBeInTheDocument()
    
    // Specific errors
    expect(canvas.getByText(/Profile requires a name/)).toBeInTheDocument()
    expect(canvas.getByText(/invalid server count/)).toBeInTheDocument()
    expect(canvas.getByText(/LAG enabled but only 1 NIC/)).toBeInTheDocument()
    expect(canvas.getByText(/exceeds maximum/)).toBeInTheDocument()
    
    // Profile cards should show error indicators
    const errorBadges = canvas.getAllByClassName('error-badge')
    expect(errorBadges.length).toBeGreaterThan(0)
  }
}

export const DuplicateProfile: Story = {
  name: '5. Duplicate Profile',
  render: () => {
    const [profiles, setProfiles] = useState<EndpointProfile[]>([basicProfiles[0]])
    
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
    
    // Click duplicate
    const duplicateBtn = canvas.getByText('Duplicate')
    await userEvent.click(duplicateBtn)
    
    // Should create copy
    expect(canvas.getByText('Web Servers Copy')).toBeInTheDocument()
    expect(canvas.getByText('Profiles: 2')).toBeInTheDocument()
    
    // Total servers should double
    expect(canvas.getByText('Total Servers: 40')).toBeInTheDocument()
  }
}

export const HighDensityConfiguration: Story = {
  name: '6. High Density Configuration',
  args: {
    profiles: [
      {
        id: 'gpu-servers',
        name: 'GPU Compute Nodes',
        description: 'High-performance GPU servers',
        nicSpeed: '100G',
        nicCount: 8,
        serverCount: 16,
        lagConfig: {
          enabled: false, // No LAG for RDMA
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        },
        rackDistribution: 'single'
      }
    ],
    maxEndpoints: 50
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify high-density display
    expect(canvas.getByText('GPU Compute Nodes')).toBeInTheDocument()
    expect(canvas.getByText('16 servers × 8 × 100G')).toBeInTheDocument()
    
    // Should show info message
    expect(canvas.getByText(/High-density configuration/)).toBeInTheDocument()
    
    // Verify total ports
    expect(canvas.getByText('Total Ports: 128')).toBeInTheDocument()
    
    // Expand to verify NIC count
    await userEvent.click(canvas.getByText('+'))
    
    const nicSelect = canvas.getByDisplayValue('8 NICs (Octa)')
    expect(nicSelect).toBeInTheDocument()
  }
}

export const RackDistributionOptions: Story = {
  name: '7. Rack Distribution Options',
  args: {
    profiles: [
      {
        id: 'distributed',
        name: 'Distributed Servers',
        nicSpeed: '25G',
        nicCount: 2,
        serverCount: 48,
        rackDistribution: 'distributed',
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      },
      {
        id: 'single-rack',
        name: 'Single Rack Cluster',
        nicSpeed: '25G',
        nicCount: 2,
        serverCount: 24,
        rackDistribution: 'single',
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      },
      {
        id: 'per-leaf',
        name: 'Per Leaf Pair',
        nicSpeed: '25G',
        nicCount: 2,
        serverCount: 24,
        rackDistribution: 'per-leaf',
        lagConfig: {
          enabled: true,
          mode: 'lacp',
          loadBalancing: 'L3+L4'
        }
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Expand first profile
    const distributedCard = canvas.getByText('Distributed Servers').closest('.profile-card')
    if (distributedCard) {
      await userEvent.click(within(distributedCard).getByText('+'))
      expect(canvas.getByDisplayValue('Distributed')).toBeInTheDocument()
    }
    
    // Expand second profile
    const singleCard = canvas.getByText('Single Rack Cluster').closest('.profile-card')
    if (singleCard) {
      await userEvent.click(within(singleCard).getByText('+'))
      expect(canvas.getByDisplayValue('Single Rack')).toBeInTheDocument()
    }
    
    // Expand third profile
    const perLeafCard = canvas.getByText('Per Leaf Pair').closest('.profile-card')
    if (perLeafCard) {
      await userEvent.click(within(perLeafCard).getByText('+'))
      expect(canvas.getByDisplayValue('Per Leaf Pair')).toBeInTheDocument()
    }
  }
}