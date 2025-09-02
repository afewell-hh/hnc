/**
 * Class Builder Filter OK Scenarios - WP-GFD3
 * Demonstrates successful leaf model filtering with various endpoint configurations
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { ClassBuilderSelector } from '../components/gfd/ClassBuilderSelector'
import type { EndpointProfile } from '../components/gfd/MultiProfileEndpointEditor'

const meta: Meta<typeof ClassBuilderSelector> = {
  title: 'GFD/ClassBuilderFilterOk',
  component: ClassBuilderSelector,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Class Builder scenarios where leaf model filtering succeeds with viable options'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// Test data
const smallProfile: EndpointProfile = {
  id: 'small',
  name: 'Small Servers',
  serverCount: 12,
  nicCount: 2,
  nicSpeed: '25G',
  lagConfig: undefined
}

const mediumProfile: EndpointProfile = {
  id: 'medium', 
  name: 'Medium Servers',
  serverCount: 16,
  nicCount: 4,
  nicSpeed: '25G',
  lagConfig: {
    enabled: true,
    mode: 'lacp',
    mclag: false,
    loadBalancing: 'L3+L4',
    lacpRate: 'fast',
    minLinks: 2
  }
}

const highDensityProfile: EndpointProfile = {
  id: 'highdensity',
  name: 'High Density',
  serverCount: 24,
  nicCount: 1,
  nicSpeed: '100G',
  lagConfig: undefined
}

const mixedSpeedProfile: EndpointProfile = {
  id: 'mixed',
  name: 'Mixed Speed',
  serverCount: 8,
  nicCount: 2,
  nicSpeed: '100G',
  lagConfig: {
    enabled: true,
    mode: 'lacp',
    mclag: true,
    loadBalancing: 'L2+L3',
    lacpRate: 'slow',
    minLinks: 2
  }
}

export const BasicFiltering: Story = {
  args: {
    endpointProfiles: [smallProfile],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show viable models section
    await expect(canvas.getByText(/Leaf Model Selection/)).toBeInTheDocument()
    await expect(canvas.getByText(/viable/)).toBeInTheDocument()
    
    // Should have at least one viable model for small profile
    const viableCards = canvas.getAllByRole('generic').filter(el => 
      el.className.includes('border-green') || el.className.includes('border-yellow')
    )
    expect(viableCards.length).toBeGreaterThan(0)
    
    // Should show port utilization information
    await expect(canvas.getByText(/ports • /)).toBeInTheDocument()
    
    // Click on first viable model
    const firstModel = viableCards[0]
    await userEvent.click(firstModel)
    
    // Should show selection feedback (ring border)
    expect(firstModel.className).toContain('ring-2')
  }
}

export const MultipleViableModels: Story = {
  args: {
    endpointProfiles: [mediumProfile],
    uplinksPerLeaf: 6,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show multiple viable options
    await expect(canvas.getByText(/Leaf Model Selection/)).toBeInTheDocument()
    
    // Check that we have multiple model options
    const modelCards = canvas.getAllByRole('generic').filter(el =>
      el.textContent?.includes('Dell DS') && el.className.includes('border')
    )
    expect(modelCards.length).toBeGreaterThanOrEqual(2)
    
    // Should display port utilization percentages
    const utilizationElements = canvas.getAllByText(/\d+%\)/)
    expect(utilizationElements.length).toBeGreaterThan(0)
    
    // Test expanding details on second model
    const detailsButtons = canvas.getAllByText(/Details/)
    if (detailsButtons.length > 1) {
      await userEvent.click(detailsButtons[1])
      
      // Should show detailed specifications
      await expect(canvas.getByText(/Port Usage/)).toBeInTheDocument()
      await expect(canvas.getByText(/Model Specifications/)).toBeInTheDocument()
    }
  }
}

export const HighDensityScenario: Story = {
  args: {
    endpointProfiles: [highDensityProfile],
    uplinksPerLeaf: 4,
    selectedLeafModel: 'DS3000',
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should handle high-density 100G scenario
    await expect(canvas.getByText(/High Density/)).toBeInTheDocument()
    
    // Should show selected model with ring highlight
    const selectedCard = canvas.getByText(/Dell DS3000/).closest('div[class*="ring-2"]')
    expect(selectedCard).toBeInTheDocument()
    
    // Should show appropriate port utilization for 100G
    const portInfo = canvas.getByText(/100G/)
    expect(portInfo).toBeInTheDocument()
    
    // Expand details to verify 100G compatibility
    const detailsButton = canvas.getAllByText(/Details/)[0]
    await userEvent.click(detailsButton)
    
    // Should show breakout information if applicable
    await expect(canvas.getByText(/Breakouts/)).toBeInTheDocument()
  }
}

export const LAGCompatibility: Story = {
  args: {
    endpointProfiles: [mixedSpeedProfile],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should handle MC-LAG profile successfully
    await expect(canvas.getByText(/Mixed Speed/)).toBeInTheDocument()
    
    // May show warnings for MC-LAG but still be viable
    const warningCards = canvas.queryAllByRole('generic').filter(el =>
      el.className.includes('border-yellow')
    )
    
    if (warningCards.length > 0) {
      // Should show warning details
      const warningText = canvas.queryByText(/Warnings:/)
      if (warningText) {
        expect(warningText).toBeInTheDocument()
      }
    }
    
    // Should still have viable models despite LAG requirements
    const viableModels = canvas.getAllByRole('generic').filter(el =>
      el.className.includes('border-green') || el.className.includes('border-yellow')
    )
    expect(viableModels.length).toBeGreaterThan(0)
  }
}

export const MultipleProfilesSuccess: Story = {
  args: {
    endpointProfiles: [smallProfile, mediumProfile],
    uplinksPerLeaf: 8,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should handle multiple profiles successfully
    await expect(canvas.getByText(/Profiles: 2/)).toBeInTheDocument()
    await expect(canvas.getByText(/Uplinks: 8/)).toBeInTheDocument()
    
    // Should calculate combined port requirements
    const viableModels = canvas.getAllByRole('generic').filter(el =>
      (el.className.includes('border-green') || el.className.includes('border-yellow')) &&
      el.textContent?.includes('Dell DS')
    )
    
    expect(viableModels.length).toBeGreaterThan(0)
    
    // Verify port allocation for combined profiles
    if (viableModels.length > 0) {
      const detailsButton = within(viableModels[0]).getByText(/Details/)
      await userEvent.click(detailsButton)
      
      // Should show combined port usage calculations
      await expect(canvas.getByText(/Port Usage/)).toBeInTheDocument()
    }
  }
}

export const OptimalSelection: Story = {
  args: {
    endpointProfiles: [smallProfile],
    uplinksPerLeaf: 4,
    selectedLeafModel: 'DS2000',
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show optimal model selection for small profile
    const selectedModel = canvas.getByText(/Dell DS2000/).closest('div[class*="ring-2"]')
    expect(selectedModel).toBeInTheDocument()
    
    // Should show green (optimal) status
    expect(selectedModel?.className).toContain('border-green')
    
    // Should show good utilization percentage
    const utilizationText = selectedModel?.textContent?.match(/\d+%/)
    if (utilizationText) {
      const percentage = parseInt(utilizationText[0])
      expect(percentage).toBeLessThan(80) // Should not be over-utilized
      expect(percentage).toBeGreaterThan(30) // Should not be under-utilized
    }
    
    // Expand details to verify efficiency
    const detailsButton = within(selectedModel!).getByText(/Details/)
    await userEvent.click(detailsButton)
    
    // Should show efficient port allocation
    await expect(canvas.getByText(/25G:/)).toBeInTheDocument()
  }
}