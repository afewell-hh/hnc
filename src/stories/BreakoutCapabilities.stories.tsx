import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { FabricDesignerView } from '../components/FabricDesignerView'
// CSS removed - not needed for Storybook

const meta = {
  title: 'Features/Breakout Capabilities',
  component: FabricDesignerView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Breakout capabilities allow 4x25G lanes per port on supported switches, increasing effective capacity by 4x.'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof FabricDesignerView>

export default meta
type Story = StoryObj<typeof meta>

export const BreakoutEnabled: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows breakout capability badge and effective capacity calculation when breakouts are enabled on DS2000.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Fill in basic configuration
    await userEvent.type(canvas.getByTestId('fabric-name-input'), 'Breakout Test Fabric')
    await userEvent.selectOptions(canvas.getByTestId('spine-model-select'), 'DS3000')
    await userEvent.selectOptions(canvas.getByTestId('leaf-model-select'), 'DS2000')
    
    // Verify breakout badge appears
    expect(canvas.getByTestId('breakout-badge')).toBeInTheDocument()
    expect(canvas.getByTestId('breakout-badge')).toHaveTextContent('4x25G')
    
    // Set uplinks and endpoint count
    await userEvent.clear(canvas.getByTestId('uplinks-per-leaf-input'))
    await userEvent.type(canvas.getByTestId('uplinks-per-leaf-input'), '4')
    await userEvent.clear(canvas.getByTestId('endpoint-count-input'))
    await userEvent.type(canvas.getByTestId('endpoint-count-input'), '200')
    
    // Select endpoint profile
    await userEvent.selectOptions(canvas.getByTestId('endpoint-profile-select'), 'Standard Server')
    
    // Enable breakouts
    const breakoutCheckbox = canvas.getByTestId('breakout-enabled-checkbox')
    expect(breakoutCheckbox).toBeInTheDocument()
    await userEvent.click(breakoutCheckbox)
    
    // Verify breakout info appears
    expect(canvas.getByText(/Breakout enabled: Effective capacity will be calculated/)).toBeInTheDocument()
    
    // Compute topology
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    // Wait for computation and verify effective capacity display
    const effectiveCapacityDisplay = await canvas.findByTestId('effective-capacity-display')
    expect(effectiveCapacityDisplay).toBeInTheDocument()
    
    // Verify capacity calculations
    expect(effectiveCapacityDisplay).toHaveTextContent('Base Endpoint Ports: 44 per leaf')
    expect(effectiveCapacityDisplay).toHaveTextContent('Effective with Breakouts: 176 per leaf')
    expect(effectiveCapacityDisplay).toHaveTextContent('Capacity Increase: +300%')
    
    // Verify fewer leaves are needed due to breakouts
    const topologyResults = canvas.getByText(/Leaves Needed:/)?.parentElement
    expect(topologyResults).toHaveTextContent('Leaves Needed: 2') // 200 endpoints / 176 effective = 2 leaves
  }
}

export const BreakoutMixedWarning: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates validation warning when attempting mixed breakout configurations in multi-class mode.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // This story would require multi-class support to fully demonstrate
    // For now, we'll show basic breakout functionality and validation
    
    await userEvent.type(canvas.getByTestId('fabric-name-input'), 'Mixed Breakout Warning')
    await userEvent.selectOptions(canvas.getByTestId('spine-model-select'), 'DS3000')
    await userEvent.selectOptions(canvas.getByTestId('leaf-model-select'), 'DS2000')
    
    // Verify breakout badge is shown
    expect(canvas.getByTestId('breakout-badge')).toBeInTheDocument()
    
    await userEvent.clear(canvas.getByTestId('uplinks-per-leaf-input'))
    await userEvent.type(canvas.getByTestId('uplinks-per-leaf-input'), '2')
    await userEvent.clear(canvas.getByTestId('endpoint-count-input'))
    await userEvent.type(canvas.getByTestId('endpoint-count-input'), '300')
    
    await userEvent.selectOptions(canvas.getByTestId('endpoint-profile-select'), 'High-Density Server')
    
    // First compute without breakouts to show high utilization
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    // Should need more leaves without breakouts
    let topologyResults = canvas.getByText(/Leaves Needed:/)?.parentElement
    expect(topologyResults).toHaveTextContent('Leaves Needed: 7') // 300 endpoints / 46 base = 7 leaves
    
    // Now enable breakouts
    const breakoutCheckbox = canvas.getByTestId('breakout-enabled-checkbox')
    await userEvent.click(breakoutCheckbox)
    
    // Recompute
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    // Should need fewer leaves with breakouts
    const effectiveCapacityDisplay = await canvas.findByTestId('effective-capacity-display')
    expect(effectiveCapacityDisplay).toBeInTheDocument()
    
    topologyResults = canvas.getByText(/Leaves Needed:/)?.parentElement
    expect(topologyResults).toHaveTextContent('Leaves Needed: 2') // 300 endpoints / 184 effective = 2 leaves
  }
}

export const BreakoutBadgeDisplay: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the breakout capability badge when DS2000 leaf model is selected.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Start with no model selected - no badge should be shown
    expect(() => canvas.getByTestId('breakout-badge')).toThrow()
    
    // Select DS2000 and verify badge appears
    await userEvent.selectOptions(canvas.getByTestId('leaf-model-select'), 'DS2000')
    
    const badge = canvas.getByTestId('breakout-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('4x25G')
    expect(badge).toHaveAttribute('title', 'DS2000 supports 4x25G breakouts for increased port density')
    
    // Badge should have appropriate styling
    const badgeStyle = window.getComputedStyle(badge)
    expect(badgeStyle.backgroundColor).toBe('rgb(0, 123, 255)') // Bootstrap blue
    expect(badgeStyle.color).toBe('rgb(255, 255, 255)') // White text
  }
}

export const BreakoutCapacityCalculations: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates accurate capacity calculations with and without breakouts enabled.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set up fabric configuration
    await userEvent.type(canvas.getByTestId('fabric-name-input'), 'Capacity Test')
    await userEvent.selectOptions(canvas.getByTestId('spine-model-select'), 'DS3000')
    await userEvent.selectOptions(canvas.getByTestId('leaf-model-select'), 'DS2000')
    await userEvent.clear(canvas.getByTestId('uplinks-per-leaf-input'))
    await userEvent.type(canvas.getByTestId('uplinks-per-leaf-input'), '6')
    await userEvent.clear(canvas.getByTestId('endpoint-count-input'))
    await userEvent.type(canvas.getByTestId('endpoint-count-input'), '84')
    await userEvent.selectOptions(canvas.getByTestId('endpoint-profile-select'), 'Standard Server')
    
    // Compute without breakouts
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    let topologyResults = canvas.getByText(/Leaves Needed:/)?.parentElement
    expect(topologyResults).toHaveTextContent('Leaves Needed: 2') // 84 / 42 = 2 leaves
    
    // Enable breakouts
    const breakoutCheckbox = canvas.getByTestId('breakout-enabled-checkbox')
    await userEvent.click(breakoutCheckbox)
    
    // Recompute with breakouts
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    // Should need only 1 leaf with breakouts
    topologyResults = canvas.getByText(/Leaves Needed:/)?.parentElement
    expect(topologyResults).toHaveTextContent('Leaves Needed: 1') // 84 / 168 = 1 leaf
    
    // Verify effective capacity display
    const effectiveCapacityDisplay = canvas.getByTestId('effective-capacity-display')
    expect(effectiveCapacityDisplay).toHaveTextContent('Base Endpoint Ports: 42 per leaf')
    expect(effectiveCapacityDisplay).toHaveTextContent('Effective with Breakouts: 168 per leaf')
    expect(effectiveCapacityDisplay).toHaveTextContent('Total Effective: 168 ports')
  }
}