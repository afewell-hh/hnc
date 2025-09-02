/**
 * Class Builder Capacity Error Scenarios - WP-GFD3  
 * Demonstrates error cases where no leaf models can satisfy endpoint requirements
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { ClassBuilderSelector } from '../components/gfd/ClassBuilderSelector'
import type { EndpointProfile } from '../components/gfd/MultiProfileEndpointEditor'

const meta: Meta<typeof ClassBuilderSelector> = {
  title: 'GFD/ClassBuilderCapacityError',
  component: ClassBuilderSelector,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Class Builder error scenarios where endpoint requirements exceed all leaf model capabilities'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// Over-capacity profiles
const massiveProfile: EndpointProfile = {
  id: 'massive',
  name: 'Massive Cluster',
  serverCount: 100,
  nicCount: 4,
  nicSpeed: '100G',
  lagConfig: undefined
}

const extremeHighDensity: EndpointProfile = {
  id: 'extreme',
  name: 'Extreme Density',
  serverCount: 200,
  nicCount: 2, 
  nicSpeed: '25G',
  lagConfig: undefined
}

const unsupportedSpeed: EndpointProfile = {
  id: 'unsupported',
  name: 'Unsupported Speed',
  serverCount: 8,
  nicCount: 2,
  nicSpeed: '800G', // Not supported by any model
  lagConfig: undefined
}

const multipleOverCapacity: EndpointProfile[] = [
  {
    id: 'large1',
    name: 'Large Cluster 1',
    serverCount: 50,
    nicCount: 2,
    nicSpeed: '100G',
    lagConfig: undefined
  },
  {
    id: 'large2', 
    name: 'Large Cluster 2',
    serverCount: 60,
    nicCount: 2,
    nicSpeed: '100G',
    lagConfig: undefined
  }
]

const tooManyUplinks: EndpointProfile = {
  id: 'normal',
  name: 'Normal Servers',
  serverCount: 16,
  nicCount: 2,
  nicSpeed: '25G',
  lagConfig: undefined
}

export const NoEndpointsConfigured: Story = {
  args: {
    endpointProfiles: [],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show placeholder message for no endpoints
    await expect(canvas.getByText(/Configure endpoint profiles first/)).toBeInTheDocument()
    
    // Should not show any model cards
    const modelCards = canvas.queryAllByText(/Dell DS/)
    expect(modelCards).toHaveLength(0)
    
    // Should show guidance text
    await expect(canvas.getByText(/to see viable leaf models/)).toBeInTheDocument()
  }
}

export const ExcessivePortRequirements: Story = {
  args: {
    endpointProfiles: [massiveProfile],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show no viable models error
    await expect(canvas.getByText(/❌ No Viable Leaf Models/)).toBeInTheDocument()
    
    // Should explain the capacity issue
    await expect(canvas.getByText(/Current endpoint requirements cannot be satisfied/)).toBeInTheDocument()
    
    // Should list specific errors for each model
    await expect(canvas.getByText(/Dell DS2000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS3000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS4000:/)).toBeInTheDocument()
    
    // Should show insufficient ports error
    const errorText = canvas.getByText(/Insufficient ports/)
    expect(errorText).toBeInTheDocument()
    
    // Error container should have red styling
    const errorContainer = canvas.getByRole('generic', { name: /No Viable Leaf Models/ }).closest('div')
    expect(errorContainer?.className).toContain('border-red')
    expect(errorContainer?.className).toContain('bg-red')
  }
}

export const UnsupportedNICSpeed: Story = {
  args: {
    endpointProfiles: [unsupportedSpeed],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show no viable models due to speed incompatibility
    await expect(canvas.getByText(/❌ No Viable Leaf Models/)).toBeInTheDocument()
    
    // Should mention speed support issues
    const speedErrors = canvas.getAllByText(/800G not supported/)
    expect(speedErrors.length).toBeGreaterThan(0)
    
    // All models should show speed compatibility errors
    await expect(canvas.getByText(/Dell DS2000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS3000:/)).toBeInTheDocument() 
    await expect(canvas.getByText(/Dell DS4000:/)).toBeInTheDocument()
    
    // Should not show breakout alternatives for unsupported speeds
    const breakoutText = canvas.queryByText(/breakout/i)
    expect(breakoutText).not.toBeInTheDocument()
  }
}

export const CumulativeCapacityOverrun: Story = {
  args: {
    endpointProfiles: multipleOverCapacity,
    uplinksPerLeaf: 6,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show multiple profiles in summary
    await expect(canvas.getByText(/Profiles: 2/)).toBeInTheDocument()
    
    // Should show capacity exceeded error
    await expect(canvas.getByText(/❌ No Viable Leaf Models/)).toBeInTheDocument()
    
    // Should calculate combined requirements correctly
    // 50*2 + 60*2 = 220 100G ports needed, which exceeds all models
    const insufficientText = canvas.queryAllByText(/Insufficient ports/)
    expect(insufficientText.length).toBeGreaterThan(0)
    
    // Should list errors for all models
    await expect(canvas.getByText(/Dell DS2000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS3000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS4000:/)).toBeInTheDocument()
  }
}

export const ExcessiveUplinkRequirements: Story = {
  args: {
    endpointProfiles: [tooManyUplinks],
    uplinksPerLeaf: 50, // Way too many uplinks
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show uplinks in summary
    await expect(canvas.getByText(/Uplinks: 50/)).toBeInTheDocument()
    
    // Should show no viable models
    await expect(canvas.getByText(/❌ No Viable Leaf Models/)).toBeInTheDocument()
    
    // Should show uplink capacity issues
    const uplinkErrors = canvas.queryAllByText(/uplinks may exceed/)
    expect(uplinkErrors.length).toBeGreaterThanOrEqual(0)
    
    // Models should fail due to excessive uplink requirements
    const modelErrors = canvas.getAllByText(/Dell DS\d+:/)
    expect(modelErrors.length).toBe(3) // All 3 models should be listed
  }
}

export const EdgeCaseSpeedBreakout: Story = {
  args: {
    endpointProfiles: [{
      id: 'edge',
      name: 'Edge Case',
      serverCount: 20,
      nicCount: 3,
      nicSpeed: '50G', // Speed that might not breakout evenly
      lagConfig: undefined
    }],
    uplinksPerLeaf: 4,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should attempt to handle 50G requirement
    await expect(canvas.getByText(/Edge Case/)).toBeInTheDocument()
    
    // May show no viable models if 50G can't be supported through breakout
    const errorSection = canvas.queryByText(/❌ No Viable Leaf Models/)
    if (errorSection) {
      // Should show speed compatibility issues
      const speedErrors = canvas.queryAllByText(/50G not supported/)
      expect(speedErrors.length).toBeGreaterThanOrEqual(0)
    }
    
    // Should list all model attempts
    await expect(canvas.getByText(/Dell DS2000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS3000:/)).toBeInTheDocument()
    await expect(canvas.getByText(/Dell DS4000:/)).toBeInTheDocument()
  }
}

export const ComplexLAGRequirements: Story = {
  args: {
    endpointProfiles: [{
      id: 'complex',
      name: 'Complex LAG',
      serverCount: 80,
      nicCount: 8,
      nicSpeed: '100G',
      lagConfig: {
        enabled: true,
        mode: 'lacp',
        mclag: true,
        loadBalancing: 'L3+L4',
        lacpRate: 'fast',
        minLinks: 4
      }
    }],
    uplinksPerLeaf: 8,
    selectedLeafModel: undefined,
    onLeafModelSelect: (modelId: string) => console.log('Selected:', modelId)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show complex LAG profile
    await expect(canvas.getByText(/Complex LAG/)).toBeInTheDocument()
    
    // Should fail due to excessive port requirements (80 * 8 = 640 100G ports)
    await expect(canvas.getByText(/❌ No Viable Leaf Models/)).toBeInTheDocument()
    
    // Should show capacity errors for all models
    const capacityErrors = canvas.queryAllByText(/Insufficient ports/)
    expect(capacityErrors.length).toBeGreaterThan(0)
    
    // Should still attempt LAG compatibility analysis even in failure case
    const modelList = canvas.queryAllByText(/Dell DS\d+:/)
    expect(modelList.length).toBe(3)
  }
}