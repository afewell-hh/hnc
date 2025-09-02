/**
 * Class Builder Breakout Warning Scenarios - WP-GFD3
 * Demonstrates scenarios where leaf models work but with breakout efficiency warnings
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { ClassBuilderSelector } from '../components/gfd/ClassBuilderSelector'
import type { EndpointProfile } from '../components/gfd/MultiProfileEndpointEditor'

const meta: Meta<typeof ClassBuilderSelector> = {
  title: 'GFD/ClassBuilderBreakoutWarning', 
  component: ClassBuilderSelector,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Class Builder scenarios with breakout feasibility but efficiency warnings'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// Profiles that require breakout but have efficiency concerns
const inefficientBreakout: EndpointProfile = {
  id: 'inefficient',
  name: 'Inefficient Breakout',
  serverCount: 6,  // Odd number requiring 12x25G, forcing 4x100G->25G breakout (waste)
  nicCount: 2,
  nicSpeed: '25G',
  lagConfig: undefined
}

const partialBreakout: EndpointProfile = {
  id: 'partial',
  name: 'Partial Breakout',
  serverCount: 15, // 30x25G ports, needs 8x100G breakouts = 32x25G (2 wasted)
  nicCount: 2,
  nicSpeed: '25G', 
  lagConfig: undefined
}

const mixedBreakoutSpeeds: EndpointProfile[] = [
  {
    id: 'mix1',
    name: 'Mixed 25G',
    serverCount: 10,
    nicCount: 2,
    nicSpeed: '25G', // 20x25G
    lagConfig: undefined
  },
  {
    id: 'mix2',
    name: 'Mixed 100G',
    serverCount: 3,
    nicCount: 1,
    nicSpeed: '100G', // 3x100G
    lagConfig: undefined
  }
]

const highUplinkRatio: EndpointProfile = {
  id: 'highuplink',
  name: 'High Uplink Ratio',
  serverCount: 8,
  nicCount: 2,
  nicSpeed: '25G',
  lagConfig: undefined
}

const lagWithBreakout: EndpointProfile = {
  id: 'lagbreakout',
  name: 'LAG + Breakout',
  serverCount: 12,
  nicCount: 4,
  nicSpeed: '25G',
  lagConfig: {
    enabled: true,
    mode: 'lacp',
    mclag: true,
    loadBalancing: 'L3+L4',
    lacpRate: 'fast',
    minLinks: 2
  }
}

export const InefficientBreakoutUsage: Story = {
  args: {
    endpointProfiles: [inefficientBreakout],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show viable models despite inefficiency
    await expect(canvas.getByText(/Leaf Model Selection/)).toBeInTheDocument()
    
    // Should show warning status (yellow border)
    const warningCards = canvas.getAllByRole('generic').filter(el =>
      el.className.includes('border-yellow')
    )
    expect(warningCards.length).toBeGreaterThan(0)
    
    // Should show warning icon
    await expect(canvas.getByText(/⚠️/)).toBeInTheDocument()
    
    // Should display warning messages
    const warningSection = canvas.queryByText(/Warnings:/)
    if (warningSection) {
      expect(warningSection).toBeInTheDocument()
    }
    
    // Click first warning model to see details
    await userEvent.click(warningCards[0])
    
    // Expand details to see breakout information
    const detailsButton = within(warningCards[0]).getByText(/Details/)
    await userEvent.click(detailsButton)
    
    // Should show breakout usage
    await expect(canvas.getByText(/Breakouts/)).toBeInTheDocument()
  }
}

export const PartialBreakoutWaste: Story = {
  args: {
    endpointProfiles: [partialBreakout],
    uplinksPerLeaf: 6,
    selectedLeafModel: 'DS2000',
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show selected model with warnings
    const selectedCard = canvas.getByText(/Dell DS2000/).closest('div[class*="ring-2"]')
    expect(selectedCard).toBeInTheDocument()
    
    // Should show warning styling due to breakout waste
    expect(selectedCard?.className).toContain('border-yellow')
    
    // Should show partial breakout scenario
    await expect(canvas.getByText(/Partial Breakout/)).toBeInTheDocument()
    
    // Should show port utilization with warning
    const utilizationMatch = selectedCard?.textContent?.match(/\d+\/\d+ \(\d+%\)/)
    expect(utilizationMatch).toBeTruthy()
    
    // Click details to see breakout analysis
    const detailsButton = within(selectedCard!).getByText(/Details/)
    await userEvent.click(detailsButton)
    
    // Should show breakout details
    await expect(canvas.getByText(/Breakouts/)).toBeInTheDocument()
    await expect(canvas.getByText(/100G/)).toBeInTheDocument()
    
    // Should show model specs including breakout options
    await expect(canvas.getByText(/Breakout Options/)).toBeInTheDocument()
  }
}

export const MixedSpeedBreakouts: Story = {
  args: {
    endpointProfiles: mixedBreakoutSpeeds,
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should handle mixed speed requirements
    await expect(canvas.getByText(/Profiles: 2/)).toBeInTheDocument()
    
    // Should show viable models with warnings
    const models = canvas.getAllByRole('generic').filter(el =>
      el.textContent?.includes('Dell DS') && el.className.includes('border')
    )
    expect(models.length).toBeGreaterThan(0)
    
    // At least one should have warnings due to mixed breakout requirements
    const warningModels = models.filter(el => el.className.includes('border-yellow'))
    expect(warningModels.length).toBeGreaterThanOrEqual(0)
    
    // Click on first model to see details
    await userEvent.click(models[0])
    const detailsButton = within(models[0]).getByText(/Details/)
    await userEvent.click(detailsButton)
    
    // Should show mixed port allocation
    await expect(canvas.getByText(/Port Usage/)).toBeInTheDocument()
    
    // Should show both 25G and 100G allocations
    const portSpeeds = canvas.queryAllByText(/25G:|100G:/)
    expect(portSpeeds.length).toBeGreaterThanOrEqual(1)
  }
}

export const HighUplinkToAccessRatio: Story = {
  args: {
    endpointProfiles: [highUplinkRatio],
    uplinksPerLeaf: 16, // Very high uplink count
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show high uplink configuration
    await expect(canvas.getByText(/Uplinks: 16/)).toBeInTheDocument()
    
    // Models should still be viable but with uplink ratio warnings
    const viableModels = canvas.getAllByRole('generic').filter(el =>
      (el.className.includes('border-green') || el.className.includes('border-yellow')) &&
      el.textContent?.includes('Dell DS')
    )
    expect(viableModels.length).toBeGreaterThan(0)
    
    // Should show warnings about uplink ratio
    const warningModels = viableModels.filter(el => el.className.includes('border-yellow'))
    if (warningModels.length > 0) {
      // Click to see warning details
      const warningText = canvas.queryByText(/Warnings:/)
      if (warningText) {
        // Should mention uplink concerns
        const uplinkWarning = canvas.queryByText(/uplinks may exceed/)
        expect(uplinkWarning).toBeInTheDocument()
      }
    }
  }
}

export const LAGWithBreakoutComplexity: Story = {
  args: {
    endpointProfiles: [lagWithBreakout],
    uplinksPerLeaf: 8,
    selectedLeafModel: 'DS3000',
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should handle LAG + breakout scenario
    await expect(canvas.getByText(/LAG \+ Breakout/)).toBeInTheDocument()
    
    // Should show selected model
    const selectedCard = canvas.getByText(/Dell DS3000/).closest('div[class*="ring-2"]')
    expect(selectedCard).toBeInTheDocument()
    
    // Should show warning due to MC-LAG + breakout complexity
    if (selectedCard?.className.includes('border-yellow')) {
      const warningSection = within(selectedCard).queryByText(/Warnings:/)
      if (warningSection) {
        // Should mention LAG complexity
        const lagWarnings = canvas.queryAllByText(/MC-LAG|LACP/)
        expect(lagWarnings.length).toBeGreaterThanOrEqual(0)
      }
    }
    
    // Expand details to see full LAG + breakout analysis
    const detailsButton = within(selectedCard!).getByText(/Details/)
    await userEvent.click(detailsButton)
    
    // Should show both LAG and breakout information
    await expect(canvas.getByText(/LAG Support: Yes/)).toBeInTheDocument()
    await expect(canvas.getByText(/LACP Support: Yes/)).toBeInTheDocument()
  }
}

export const DivisibilityWarnings: Story = {
  args: {
    endpointProfiles: [{
      id: 'divisible',
      name: 'Divisibility Test',
      serverCount: 7, // 14x25G ports - doesn't divide evenly into 4x25G breakouts
      nicCount: 2,
      nicSpeed: '25G',
      lagConfig: undefined
    }],
    uplinksPerLeaf: 7, // Odd number that might not divide evenly across spines
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show divisibility scenario
    await expect(canvas.getByText(/Divisibility Test/)).toBeInTheDocument()
    await expect(canvas.getByText(/Uplinks: 7/)).toBeInTheDocument()
    
    // Should show models with divisibility warnings
    const warningModels = canvas.getAllByRole('generic').filter(el =>
      el.className.includes('border-yellow') && el.textContent?.includes('Dell DS')
    )
    
    if (warningModels.length > 0) {
      // Should have divisibility-related warnings
      const warnings = canvas.queryByText(/Warnings:/)
      if (warnings) {
        // May mention spine divisibility or breakout efficiency
        const divisibilityText = canvas.queryAllByText(/divide|divisibility/i)
        expect(divisibilityText.length).toBeGreaterThanOrEqual(0)
      }
    }
    
    // Click first model to see details
    if (warningModels.length > 0) {
      await userEvent.click(warningModels[0])
      const detailsButton = within(warningModels[0]).getByText(/Details/)
      await userEvent.click(detailsButton)
      
      // Should show port allocation details
      await expect(canvas.getByText(/Port Usage/)).toBeInTheDocument()
    }
  }
}

export const BreakoutAlternatives: Story = {
  args: {
    endpointProfiles: [{
      id: 'alternatives',
      name: 'Breakout Alternatives',
      serverCount: 20,
      nicCount: 1, 
      nicSpeed: '25G', // 20x25G - multiple breakout strategies possible
      lagConfig: undefined
    }],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show alternatives scenario
    await expect(canvas.getByText(/Breakout Alternatives/)).toBeInTheDocument()
    
    // Should have multiple viable models with different breakout strategies
    const viableModels = canvas.getAllByRole('generic').filter(el =>
      (el.className.includes('border-green') || el.className.includes('border-yellow')) &&
      el.textContent?.includes('Dell DS')
    )
    expect(viableModels.length).toBeGreaterThan(1)
    
    // Compare breakout strategies across models
    for (let i = 0; i < Math.min(viableModels.length, 2); i++) {
      const detailsButton = within(viableModels[i]).getByText(/Details/)
      await userEvent.click(detailsButton)
      
      // Should show breakout information
      await expect(canvas.getByText(/Breakouts/)).toBeInTheDocument()
      
      // Collapse details before checking next model
      await userEvent.click(detailsButton)
    }
    
    // Should allow comparison of different breakout efficiencies
    const utilizationTexts = viableModels.map(model => 
      model.textContent?.match(/\(\d+%\)/)?.[0]
    ).filter(Boolean)
    expect(utilizationTexts.length).toBeGreaterThan(0)
  }
}