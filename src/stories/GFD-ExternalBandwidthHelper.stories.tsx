/**
 * External Bandwidth Helper Stories - WP-EXT1
 * Storybook stories for target bandwidth scenarios with auto-conversion
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import ExternalLinkEditor from '../components/gfd/ExternalLinkEditor'
import { createExternalLink, type ExternalLink } from '../domain/external-link'

const meta: Meta<typeof ExternalLinkEditor> = {
  title: 'GFD/External Bandwidth Helper',
  component: ExternalLinkEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Target bandwidth mode with intelligent port allocation and conversion helpers.'
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
      control: { type: 'number', min: 0, max: 16 },
      description: 'Number of spines for divisibility validation'
    }
  }
}

export default meta
type Story = StoryObj<typeof ExternalLinkEditor>

// Helper to create test scenarios
const createBandwidthScenario = (
  name: string,
  targetGbps: number,
  preferredSpeed?: string,
  category: 'vpc.external' | 'vpc.staticExternal' = 'vpc.external'
): ExternalLink => {
  const link = createExternalLink(name, category)
  link.targetGbps = targetGbps
  link.preferredSpeed = preferredSpeed as any
  return link
}

// Basic bandwidth scenarios
export const InternetUplink100G: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Internet Uplink', 100, '100G')
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show target bandwidth mode by default
    expect(canvas.getByDisplayValue('Internet Uplink')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('100')).toBeInTheDocument()
    
    // Should show computed allocation preview
    expect(canvas.getByText(/Configuration Preview/i)).toBeInTheDocument()
    expect(canvas.getByText(/100Gbps/i)).toBeInTheDocument()
  }
}

export const DatacenterInterconnect400G: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('DC Interconnect', 400, '400G', 'vpc.staticExternal')
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show static external category
    expect(canvas.getByDisplayValue('DC Interconnect')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('400')).toBeInTheDocument()
    
    // Should show VPC Static External category
    const categorySelect = canvas.getByDisplayValue('vpc.staticExternal')
    expect(categorySelect).toBeInTheDocument()
  }
}

export const MultipleUplinkScenario: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Primary Internet', 200, '100G'),
      createBandwidthScenario('Backup Internet', 100, '100G'),
      createBandwidthScenario('Private Peering', 50, '25G', 'vpc.staticExternal')
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show all three links in sidebar
    expect(canvas.getByText('Primary Internet')).toBeInTheDocument()
    expect(canvas.getByText('Backup Internet')).toBeInTheDocument()
    expect(canvas.getByText('Private Peering')).toBeInTheDocument()
    
    // Should show total port count across all links
    const targetElements = canvas.getAllByText(/Target:/i)
    expect(targetElements).toHaveLength(3)
  }
}

// Bandwidth helper scenarios
export const OptimalBandwidthHelper: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Smart Uplink', 250) // No preferred speed - should auto-optimize
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show auto-optimization in preferred speed
    const speedSelect = canvas.getByRole('combobox', { name: /preferred speed/i })
    expect(speedSelect).toHaveDisplayValue('Auto (Optimal)')
    
    // Should show efficient allocation in preview
    expect(canvas.getByText(/Configuration Preview/i)).toBeInTheDocument()
  }
}

export const BandwidthWithConversionWarning: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Overprovisioned Link', 150, '100G') // Will result in 200Gbps (2x100G)
    ],
    mode: 'guided',
    spineCount: 4
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show overprovisioning warning in allocation preview
    await expect(canvas.findByText(/Overprovisioned/i)).resolves.toBeInTheDocument()
    
    // Efficiency should be less than 100%
    const efficiencyText = await canvas.findByText(/75%/i) // 150/200 = 75%
    expect(efficiencyText).toBeInTheDocument()
  }
}

// Interactive bandwidth conversion
export const InteractiveBandwidthConversion: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Interactive Link', 300, '100G')
    ],
    mode: 'expert'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Initial target bandwidth mode', async () => {
      expect(canvas.getByDisplayValue('300')).toBeInTheDocument()
      expect(canvas.getByText('Target Bandwidth')).toBeInTheDocument()
    })
    
    await step('Convert to explicit ports mode', async () => {
      const explicitButton = canvas.getByRole('button', { name: /Explicit Ports/i })
      await userEvent.click(explicitButton)
      
      // Should now show explicit port configuration
      await expect(canvas.findByText('Port Configuration')).resolves.toBeInTheDocument()
    })
    
    await step('Verify computed ports are shown', async () => {
      // Should show 3x100G ports (300Gbps / 100G = 3)
      const countInput = canvas.getByDisplayValue('3')
      expect(countInput).toBeInTheDocument()
      
      const speedSelect = canvas.getByDisplayValue('100G')
      expect(speedSelect).toBeInTheDocument()
    })
  }
}

export const BandwidthModeToggling: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Toggle Test', 500, '100G')
    ],
    mode: 'expert'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Start in bandwidth mode', async () => {
      expect(canvas.getByDisplayValue('500')).toBeInTheDocument()
      expect(canvas.getByRole('button', { name: /Target Bandwidth/i })).toHaveClass('btn-primary')
    })
    
    await step('Switch to explicit mode', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /Explicit Ports/i }))
      
      // Should convert 500Gbps to 5x100G ports
      await expect(canvas.findByDisplayValue('5')).resolves.toBeInTheDocument()
    })
    
    await step('Switch back to bandwidth mode', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /Target Bandwidth/i }))
      
      // Should show achieved bandwidth (5x100G = 500Gbps)
      await expect(canvas.findByDisplayValue('500')).resolves.toBeInTheDocument()
    })
  }
}

// Advanced bandwidth scenarios
export const AdvancedBandwidthOptimization: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Optimize Me', 350, '100G')
    ],
    mode: 'expert'
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Show advanced options', async () => {
      const advancedCheckbox = canvas.getByRole('checkbox', { name: /show advanced/i })
      await userEvent.click(advancedCheckbox)
      
      // Should show advanced optimization button
      await expect(canvas.findByText('Advanced Conversion')).resolves.toBeInTheDocument()
    })
    
    await step('Apply advanced optimization', async () => {
      const optimizeButton = canvas.getByRole('button', { name: /Apply Advanced Optimization/i })
      await userEvent.click(optimizeButton)
      
      // Should convert to explicit mode with optimized allocation
      await expect(canvas.findByText('Port Configuration')).resolves.toBeInTheDocument()
    })
  }
}

export const BandwidthValidationErrors: Story = {
  args: {
    externalLinks: [
      {
        id: 'invalid-bandwidth',
        name: 'Invalid Link',
        mode: 'target-bandwidth' as const,
        targetGbps: 0, // Invalid - zero bandwidth
        category: 'vpc.external' as const
      }
    ],
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show validation error
    await expect(canvas.findByText(/must be greater than 0/i)).resolves.toBeInTheDocument()
    
    // Should show error indicator in link list
    const errorIndicator = canvas.getByText('✗')
    expect(errorIndicator).toBeInTheDocument()
  }
}

// Border capacity scenarios
export const BandwidthWithLimitedBorderCapacity: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Large Uplink', 1000, '100G')
    ],
    borderCapabilities: {
      maxPorts: 8, // Limited capacity
      availableSpeeds: ['25G', '100G'],
      breakoutCapability: {
        '100G': ['4x25G']
      },
      lagSupport: true,
      maxPortsPerLag: 4
    },
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show capacity warning or error
    await expect(
      canvas.findByText(/insufficient ports|capacity/i)
    ).resolves.toBeInTheDocument()
  }
}

export const BandwidthWithBreakoutSupport: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Breakout Link', 100, '25G')
    ],
    borderCapabilities: {
      maxPorts: 32,
      availableSpeeds: ['100G'], // Only 100G native, need breakout for 25G
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
    
    // Should still allocate successfully
    expect(canvas.getByText(/Configuration Preview/i)).toBeInTheDocument()
  }
}

// Spine divisibility scenarios
export const BandwidthWithSpineDivisibility: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Divisible Link', 300, '100G') // 3x100G ports
    ],
    spineCount: 3,
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Enable advanced view to see divisibility
    const advancedCheckbox = canvas.getByRole('checkbox', { name: /show advanced/i })
    await userEvent.click(advancedCheckbox)
    
    // Should show perfect spine distribution (1 port per spine)
    await expect(canvas.findByText(/1 per spine/i)).resolves.toBeInTheDocument()
  }
}

export const BandwidthWithDivisibilityWarning: Story = {
  args: {
    externalLinks: [
      createBandwidthScenario('Uneven Link', 250, '100G') // 3x100G ports, doesn't divide by 4 evenly
    ],
    spineCount: 4,
    mode: 'expert'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show divisibility warning in validation summary
    await expect(
      canvas.findByText(/uneven|distribution/i)
    ).resolves.toBeInTheDocument()
  }
}

// Real-world scenarios
export const CommonInternetProvider: Story = {
  name: 'Common ISP Configuration',
  args: {
    externalLinks: [
      createBandwidthScenario('ISP Primary', 100, '100G'),
      createBandwidthScenario('ISP Secondary', 100, '100G')
    ],
    spineCount: 4,
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show both uplinks
    expect(canvas.getByText('ISP Primary')).toBeInTheDocument()
    expect(canvas.getByText('ISP Secondary')).toBeInTheDocument()
    
    // Should show combined bandwidth consideration
    expect(canvas.getAllByText(/100Gbps/i).length).toBeGreaterThanOrEqual(2)
  }
}

export const HybridCloudConnectivity: Story = {
  name: 'AWS/Azure Hybrid Setup',
  args: {
    externalLinks: [
      createBandwidthScenario('AWS Direct Connect', 200, '100G', 'vpc.staticExternal'),
      createBandwidthScenario('Azure ExpressRoute', 200, '100G', 'vpc.staticExternal'),
      createBandwidthScenario('Internet Backup', 100, '100G')
    ],
    spineCount: 4,
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show mix of external and static external
    expect(canvas.getByText('AWS Direct Connect')).toBeInTheDocument()
    expect(canvas.getByText('Azure ExpressRoute')).toBeInTheDocument()
    expect(canvas.getByText('Internet Backup')).toBeInTheDocument()
    
    // Should handle different categories appropriately
    expect(canvas.getAllByDisplayValue('vpc.staticExternal')).toHaveLength(2)
    expect(canvas.getAllByDisplayValue('vpc.external')).toHaveLength(1)
  }
}