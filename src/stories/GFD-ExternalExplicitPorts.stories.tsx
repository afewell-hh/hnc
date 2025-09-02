/**
 * External Explicit Ports Stories - WP-EXT1
 * Storybook stories for manual port specification scenarios
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import ExternalLinkEditor from '../components/gfd/ExternalLinkEditor'
import type { ExternalLink } from '../domain/external-link'

const meta: Meta<typeof ExternalLinkEditor> = {
  title: 'GFD/External Explicit Ports',
  component: ExternalLinkEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Explicit port mode for precise control over external connectivity specifications.'
      }
    }
  },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['guided', 'expert'],
      description: 'Editor mode - guided for simplified interface, expert for advanced features'
    },
    spineCount: {
      control: { type: number, min: 0, max: 16 },
      description: 'Number of spines for divisibility validation'
    }
  }
}

export default meta
type Story = StoryObj<typeof ExternalLinkEditor>

// Helper to create explicit port scenarios
const createExplicitLink = (
  name: string,
  ports: Array<{ speed: '10G' | '25G' | '100G' | '400G'; count: number }>,
  category: 'vpc.external' | 'vpc.staticExternal' = 'vpc.external'
): ExternalLink => ({
  id: `explicit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name,
  mode: 'explicit-ports',
  explicitPorts: ports,
  category,
  enabled: true
})

// Basic explicit port scenarios
export const SingleSpeedConfiguration: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Single Speed Uplink', [
        { speed: '100G', count: 2 }
      ])
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show explicit ports mode
    expect(canvas.getByText('Explicit Ports')).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: /Explicit Ports/i })).toHaveClass('btn-primary')
    
    // Should show port configuration
    expect(canvas.getByText('Port Configuration')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('100G')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('2')).toBeInTheDocument()
    
    // Should show total bandwidth in preview
    expect(canvas.getByText(/200Gbps/i)).toBeInTheDocument()
  }
}

export const MultiSpeedConfiguration: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Multi Speed Uplink', [
        { speed: '400G', count: 1 },
        { speed: '100G', count: 2 },
        { speed: '25G', count: 4 }
      ])
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show all port groups
    expect(canvas.getByDisplayValue('400G')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('100G')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('25G')).toBeInTheDocument()
    
    // Should show combined bandwidth (400 + 200 + 100 = 700Gbps)
    expect(canvas.getByText(/700Gbps/i)).toBeInTheDocument()
    
    // Should show total port count (1 + 2 + 4 = 7)
    expect(canvas.getByText(/7/)).toBeInTheDocument()
  }
}

export const EmptyPortConfiguration: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Empty Link', [])
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show empty state
    expect(canvas.getByText(/No ports configured/i)).toBeInTheDocument()
    expect(canvas.getByText(/Add a port group/i)).toBeInTheDocument()
    
    // Should show validation error
    await expect(
      canvas.findByText(/at least one port/i)
    ).resolves.toBeInTheDocument()
  }
}

// Interactive port management
export const InteractivePortManagement: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Interactive Link', [
        { speed: '100G', count: 1 }
      ])
    ],
    mode: 'expert'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Initial single port group', async () => {
      expect(canvas.getByDisplayValue('100G')).toBeInTheDocument()
      expect(canvas.getByDisplayValue('1')).toBeInTheDocument()
    })
    
    await step('Add another port group', async () => {
      const addButton = canvas.getByRole('button', { name: /Add Port Group/i })
      await userEvent.click(addButton)
      
      // Should now have two port groups
      const speedSelects = canvas.getAllByDisplayValue('100G')
      expect(speedSelects).toHaveLength(2)
    })
    
    await step('Modify second port group', async () => {
      const countInputs = canvas.getAllByDisplayValue('1')
      await userEvent.clear(countInputs[1])
      await userEvent.type(countInputs[1], '3')
      
      // Should update total bandwidth
      await expect(canvas.findByText(/400Gbps/i)).resolves.toBeInTheDocument()
    })
    
    await step('Change speed of second group', async () => {
      const speedSelects = canvas.getAllByRole('combobox', { name: /speed/i })
      await userEvent.selectOptions(speedSelects[1], '25G')
      
      // Should update total bandwidth (100 + 75 = 175Gbps)
      await expect(canvas.findByText(/175Gbps/i)).resolves.toBeInTheDocument()
    })
    
    await step('Remove first port group', async () => {
      const removeButtons = canvas.getAllByRole('button', { name: /Remove/i })
      await userEvent.click(removeButtons[0])
      
      // Should only show second group
      expect(canvas.getByDisplayValue('25G')).toBeInTheDocument()
      expect(canvas.getByDisplayValue('3')).toBeInTheDocument()
      
      // Should show only 75Gbps now
      await expect(canvas.findByText(/75Gbps/i)).resolves.toBeInTheDocument()
    })
  }
}

export const PortGroupValidation: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Validation Test', [
        { speed: '100G', count: 0 } // Invalid count
      ])
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Invalid count validation', async () => {
      expect(canvas.getByDisplayValue('0')).toBeInTheDocument()
      
      // Should show validation error for zero count
      await expect(
        canvas.findByText(/error|invalid/i)
      ).resolves.toBeInTheDocument()
    })
    
    await step('Fix count validation', async () => {
      const countInput = canvas.getByDisplayValue('0')
      await userEvent.clear(countInput)
      await userEvent.type(countInput, '2')
      
      // Should clear validation error and show bandwidth
      await expect(canvas.findByText(/200Gbps/i)).resolves.toBeInTheDocument()
    })
  }
}

// Advanced explicit port scenarios
export const HighDensityConfiguration: Story = {
  args: {
    externalLinks: [
      createExplicitLink('High Density Border', [
        { speed: '400G', count: 8 },
        { speed: '100G', count: 16 },
        { speed: '25G', count: 32 }
      ])
    ],
    borderCapabilities: {
      maxPorts: 64,
      availableSpeeds: ['25G', '100G', '400G'],
      breakoutCapability: {
        '100G': ['4x25G'],
        '400G': ['4x100G', '16x25G']
      },
      lagSupport: true,
      maxPortsPerLag: 8
    },
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show massive bandwidth total
    expect(canvas.getByText(/5600Gbps/i)).toBeInTheDocument() // 3200 + 1600 + 800
    
    // Should show total port count
    expect(canvas.getByText(/56/)).toBeInTheDocument() // 8 + 16 + 32
    
    // Should show high utilization warning
    await expect(
      canvas.findByText(/utilization|capacity/i)
    ).resolves.toBeInTheDocument()
  }
}

export const BreakoutRequiredConfiguration: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Breakout Required', [
        { speed: '25G', count: 12 }
      ])
    ],
    borderCapabilities: {
      maxPorts: 32,
      availableSpeeds: ['100G'], // No native 25G - requires breakout
      breakoutCapability: {
        '100G': ['4x25G']
      },
      lagSupport: true
    },
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show that breakout is required
    await expect(canvas.findByText(/breakout/i)).resolves.toBeInTheDocument()
    
    // Should still calculate bandwidth correctly
    expect(canvas.getByText(/300Gbps/i)).toBeInTheDocument()
    
    // Might show warnings about breakout efficiency
    const warningSection = canvas.queryByText(/warning/i)
    if (warningSection) {
      expect(warningSection).toBeInTheDocument()
    }
  }
}

// Spine divisibility with explicit ports
export const ExplicitPortsDivisibility: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Divisible Ports', [
        { speed: '100G', count: 8 } // Divides evenly by 2, 4, 8
      ])
    ],
    spineCount: 4,
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Enable advanced view
    const advancedCheckbox = canvas.getByRole('checkbox', { name: /show advanced/i })
    await userEvent.click(advancedCheckbox)
    
    // Should show perfect spine distribution (2 ports per spine)
    await expect(canvas.findByText(/2 per spine/i)).resolves.toBeInTheDocument()
    
    // No divisibility warnings
    expect(canvas.queryByText(/uneven/i)).not.toBeInTheDocument()
  }
}

export const ExplicitPortsDivisibilityWarning: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Uneven Ports', [
        { speed: '100G', count: 7 } // Doesn't divide by 4 evenly
      ])
    ],
    spineCount: 4,
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show divisibility warning
    await expect(
      canvas.findByText(/uneven|distribution/i)
    ).resolves.toBeInTheDocument()
  }
}

// Conversion scenarios
export const ConvertFromBandwidthMode: Story = {
  args: {
    externalLinks: [{
      id: 'convert-test',
      name: 'Convert Test',
      mode: 'target-bandwidth' as const,
      targetGbps: 300,
      preferredSpeed: '100G' as const,
      category: 'vpc.external' as const
    }],
    mode: 'expert'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Start in bandwidth mode', async () => {
      expect(canvas.getByDisplayValue('300')).toBeInTheDocument()
      expect(canvas.getByRole('button', { name: /Target Bandwidth/i })).toHaveClass('btn-primary')
    })
    
    await step('Convert to explicit ports', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /Explicit Ports/i }))
      
      // Should convert 300Gbps to 3x100G
      await expect(canvas.findByDisplayValue('3')).resolves.toBeInTheDocument()
      expect(canvas.getByDisplayValue('100G')).toBeInTheDocument()
    })
    
    await step('Modify explicit configuration', async () => {
      // Change to mixed speeds
      const addButton = canvas.getByRole('button', { name: /Add Port Group/i })
      await userEvent.click(addButton)
      
      // Change second group to 25G x 4 (100Gbps)
      const speedSelects = canvas.getAllByRole('combobox', { name: /speed/i })
      await userEvent.selectOptions(speedSelects[1], '25G')
      
      const countInputs = canvas.getAllByRole('spinbutton', { name: /port count/i })
      await userEvent.clear(countInputs[1])
      await userEvent.type(countInputs[1], '4')
      
      // Total should now be 400Gbps (3x100G + 4x25G)
      await expect(canvas.findByText(/400Gbps/i)).resolves.toBeInTheDocument()
    })
  }
}

// Real-world explicit scenarios
export const CarrierNeutralFacilityUplinks: Story = {
  name: 'Carrier Neutral Facility',
  args: {
    externalLinks: [
      createExplicitLink('Tier 1 Carrier A', [
        { speed: '100G', count: 2 }
      ]),
      createExplicitLink('Tier 1 Carrier B', [
        { speed: '100G', count: 2 }
      ]),
      createExplicitLink('Regional ISP', [
        { speed: '25G', count: 4 }
      ], 'vpc.staticExternal')
    ],
    spineCount: 4,
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show all three carriers
    expect(canvas.getByText('Tier 1 Carrier A')).toBeInTheDocument()
    expect(canvas.getByText('Tier 1 Carrier B')).toBeInTheDocument()
    expect(canvas.getByText('Regional ISP')).toBeInTheDocument()
    
    // Should show appropriate bandwidth totals
    expect(canvas.getAllByText(/200Gbps/i)).toHaveLength(2) // Two 2x100G links
    expect(canvas.getByText(/100Gbps/i)).toBeInTheDocument() // One 4x25G link
  }
}

export const HighFrequencyTradingSetup: Story = {
  name: 'HFT Low Latency Setup',
  args: {
    externalLinks: [
      createExplicitLink('NYSE Direct', [
        { speed: '10G', count: 4 }
      ], 'vpc.staticExternal'),
      createExplicitLink('NASDAQ Direct', [
        { speed: '10G', count: 4 }
      ], 'vpc.staticExternal'),
      createExplicitLink('Microwave Backup', [
        { speed: '25G', count: 2 }
      ], 'vpc.staticExternal')
    ],
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show all specialized links
    expect(canvas.getByText('NYSE Direct')).toBeInTheDocument()
    expect(canvas.getByText('NASDAQ Direct')).toBeInTheDocument()
    expect(canvas.getByText('Microwave Backup')).toBeInTheDocument()
    
    // Should show precise port counts for low-latency applications
    expect(canvas.getAllByText(/40Gbps/i)).toHaveLength(2) // Two 4x10G links
    expect(canvas.getByText(/50Gbps/i)).toBeInTheDocument() // One 2x25G link
  }
}

export const ContentDeliveryNetworkPeering: Story = {
  name: 'CDN Peering Points',
  args: {
    externalLinks: [
      createExplicitLink('Akamai Peering', [
        { speed: '100G', count: 1 }
      ], 'vpc.staticExternal'),
      createExplicitLink('Cloudflare Peering', [
        { speed: '100G', count: 1 }
      ], 'vpc.staticExternal'),
      createExplicitLink('AWS CloudFront', [
        { speed: '100G', count: 2 }
      ], 'vpc.staticExternal'),
      createExplicitLink('Internet Transit', [
        { speed: '100G', count: 4 }
      ])
    ],
    spineCount: 4,
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show mix of peering and transit
    expect(canvas.getByText('Akamai Peering')).toBeInTheDocument()
    expect(canvas.getByText('Cloudflare Peering')).toBeInTheDocument()
    expect(canvas.getByText('AWS CloudFront')).toBeInTheDocument()
    expect(canvas.getByText('Internet Transit')).toBeInTheDocument()
    
    // Should show correct categories (3 static external, 1 external)
    expect(canvas.getAllByDisplayValue('vpc.staticExternal')).toHaveLength(3)
    expect(canvas.getAllByDisplayValue('vpc.external')).toHaveLength(1)
  }
}

// Error scenarios
export const ExplicitPortsCapacityError: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Too Many Ports', [
        { speed: '25G', count: 100 } // Exceeds typical border capacity
      ])
    ],
    borderCapabilities: {
      maxPorts: 48,
      availableSpeeds: ['25G', '100G', '400G'],
      breakoutCapability: {
        '100G': ['4x25G'],
        '400G': ['16x25G']
      },
      lagSupport: true
    },
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show capacity exceeded error
    await expect(
      canvas.findByText(/exceeds.*capacity|insufficient ports/i)
    ).resolves.toBeInTheDocument()
    
    // Should show error indicator
    const errorIndicator = canvas.getByText('✗')
    expect(errorIndicator).toBeInTheDocument()
  }
}

export const UnsupportedSpeedError: Story = {
  args: {
    externalLinks: [
      createExplicitLink('Unsupported Speed', [
        { speed: '400G', count: 2 }
      ])
    ],
    borderCapabilities: {
      maxPorts: 48,
      availableSpeeds: ['25G', '100G'], // No 400G support
      breakoutCapability: {
        '100G': ['4x25G']
      },
      lagSupport: true
    },
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show unsupported speed error
    await expect(
      canvas.findByText(/400G.*not supported/i)
    ).resolves.toBeInTheDocument()
  }
}