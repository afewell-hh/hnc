import type { Meta, StoryObj } from '@storybook/react'
import { within, userEvent, expect } from '@storybook/test'
import App from './App'

const meta: Meta<typeof App> = {
  title: 'HNC/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const ReadyConfig: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify initial state
    expect(canvas.getByDisplayValue('test-fabric')).toBeInTheDocument()
    expect(canvas.getByDisplayValue('48')).toBeInTheDocument()
    expect(canvas.getByText('Compute Topology')).toBeEnabled()
  },
}

export const ComputedPreview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set configuration
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i))
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '24')
    
    // Click compute
    await userEvent.click(canvas.getByText('Compute Topology'))
    
    // Verify computed state
    await expect(canvas.getByText(/topology computed/i)).toBeInTheDocument()
    await expect(canvas.getByText('Save to FGD')).toBeEnabled()
  },
}

export const InvalidUplinks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set invalid uplinks
    await userEvent.clear(canvas.getByLabelText(/uplinks per leaf/i))
    await userEvent.type(canvas.getByLabelText(/uplinks per leaf/i), '5')
    
    // Try to compute
    await userEvent.click(canvas.getByText('Compute Topology'))
    
    // Verify validation error
    await expect(canvas.getByText(/uplinks per leaf must be/i)).toBeInTheDocument()
  },
}

export const SaveAfterCompute: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Configure and compute
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i))
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '16')
    await userEvent.click(canvas.getByText('Compute Topology'))
    
    // Save
    await userEvent.click(canvas.getByText('Save to FGD'))
    
    // Verify save success
    await expect(canvas.getByText(/saved to fgd/i)).toBeInTheDocument()
  },
}

export const InvalidEndpointCount: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set invalid endpoint count
    await userEvent.clear(canvas.getByLabelText(/endpoint count/i))
    await userEvent.type(canvas.getByLabelText(/endpoint count/i), '0')
    
    // Try to compute
    await userEvent.click(canvas.getByText('Compute Topology'))
    
    // Verify validation error
    await expect(canvas.getByText(/endpoint count must be/i)).toBeInTheDocument()
  },
}