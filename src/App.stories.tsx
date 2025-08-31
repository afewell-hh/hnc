import type { Meta, StoryObj } from '@storybook/react'
import { within, userEvent, expect } from '@storybook/test'
import App from './App'

const meta: Meta<typeof App> = {
  title: 'HNC/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'HNC v0.2 multi-fabric workspace application. Routes between fabric list and individual fabric designer based on workspace state.'
      }
    }
  },
  tags: ['ci'],
}

export default meta
type Story = StoryObj<typeof meta>

// Workspace-level stories
export const EmptyWorkspace: Story = {
  name: 'Empty Workspace - No Fabrics',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show empty workspace state
    await expect(canvas.getByText('No fabrics created yet')).toBeInTheDocument()
    await expect(canvas.getByText('Create your first fabric to get started with network design')).toBeInTheDocument()
    
    // Should have create button available
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await expect(createButton).toBeInTheDocument()
    await expect(createButton).toBeEnabled()
  },
  parameters: {
    docs: {
      description: {
        story: 'Initial state when no fabrics exist. Shows empty workspace with create fabric prompt.'
      }
    }
  }
}

export const WithFabricsListing: Story = {
  name: 'Workspace with Multiple Fabrics',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create first fabric
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Production Network')
    
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    // Should show fabric list with the new fabric
    await expect(canvas.getByText('Your Fabrics (1)')).toBeInTheDocument()
    await expect(canvas.getByText('Production Network')).toBeInTheDocument()
    await expect(canvas.getByText('Draft')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Workspace showing fabric list with created fabrics. Demonstrates fabric creation flow and listing.'
      }
    }
  }
}

export const FabricDesignSelected: Story = {
  name: 'Single Fabric Design Mode',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create a fabric first
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Test Fabric')
    
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    // Select the fabric for design
    const selectButton = canvas.getByRole('button', { name: 'Select' })
    await userEvent.click(selectButton)
    
    // Should now be in fabric designer mode
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument()
    await expect(canvas.getByText('← Back to List')).toBeInTheDocument()
    // The fabric name input should be empty initially in designer mode
    const fabricNameInput = canvas.getByDisplayValue('')
    await expect(fabricNameInput).toBeInTheDocument()
    await expect(canvas.getByText('Compute Topology')).toBeEnabled()
  },
  parameters: {
    docs: {
      description: {
        story: 'Fabric designer mode showing single fabric configuration and compute interface. Includes navigation back to workspace.'
      }
    }
  }
}

export const CreateNewFabricFlow: Story = {
  name: 'Create New Fabric Workflow',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Start with create button
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    // Should show create form
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument()
    
    // Type fabric name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Development Environment')
    
    // Submit form
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    // Verify fabric appears in list
    await expect(canvas.getByText('Development Environment')).toBeInTheDocument()
    await expect(canvas.getByText('Draft')).toBeInTheDocument()
    
    // Should have action buttons
    await expect(canvas.getByRole('button', { name: 'Select' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete workflow for creating a new fabric from empty workspace to fabric list.'
      }
    }
  }
}

export const NavigationFlow: Story = {
  name: 'Workspace Navigation Flow',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create and select fabric
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Navigation Test')
    
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    // Select for design
    const selectButton = canvas.getByRole('button', { name: 'Select' })
    await userEvent.click(selectButton)
    
    // Should be in designer
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument()
    
    // Navigate back to list
    const backButton = canvas.getByText('← Back to List')
    await userEvent.click(backButton)
    
    // Should be back in workspace list
    await expect(canvas.getByText('Your Fabrics (1)')).toBeInTheDocument()
    await expect(canvas.getByText('Navigation Test')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates navigation between workspace fabric list and individual fabric designer.'
      }
    }
  }
}

export const DriftDetectionWorkflow: Story = {
  name: 'Workspace with Drift Detection',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create fabric and enter design mode
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Drift Test Fabric')
    
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    const selectButton = canvas.getByRole('button', { name: 'Select' })
    await userEvent.click(selectButton)
    
    // Should show drift section in designer
    await expect(canvas.getByText('HNC Fabric Designer v0.2')).toBeInTheDocument()
    await expect(canvas.getByText('Drift Status')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Check for Drift' })).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows drift detection functionality integrated into the fabric designer workflow.'
      }
    }
  }
}

export const ErrorStatesWorkspace: Story = {
  name: 'Workspace Error States',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Try to create fabric with empty name
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    // Submit button should be disabled when input is empty
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await expect(submitButton).toBeDisabled()
    
    // Try with valid name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Valid Name')
    
    // Button should now be enabled
    await expect(submitButton).toBeEnabled()
    await userEvent.click(submitButton)
    
    // Fabric should be created and appear in list
    await expect(canvas.getByText('Valid Name')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error handling in the workspace, including validation errors and recovery.'
      }
    }
  }
}

// Helper function for robust fabric setup and navigation
const ensureFabricAndConfig = async (c: ReturnType<typeof within>) => {
  const createBtn = await c.queryByRole('button', { name: /Create.*Fabric/i })
  if (createBtn) {
    await userEvent.click(createBtn)
    const nameInput = await c.findByPlaceholderText('Enter fabric name...')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'v01')
    await userEvent.click(await c.findByRole('button', { name: /^Create$/i }))
  }
  
  // Select fabric for design (navigate to FabricDesigner)
  const selectButton = await c.findByRole('button', { name: 'Select' })
  await userEvent.click(selectButton)

  // Wait for all anchors to be ready - deterministic mounting
  await c.findByRole('combobox', { name: /Leaf model/i })  // catalog mounted
  await userEvent.selectOptions(
    await c.findByRole('combobox', { name: /Leaf model/i }),
    await c.findByRole('option', { name: /^DS2000$/i })
  )
  await c.findByRole('spinbutton', { name: /Uplinks per leaf/i })  // form mounted
  await c.findByRole('button', { name: /Compute/i }) // screen ready
  
  // Wait for form fields to be available using semantic selectors
  await c.findByLabelText(/Fabric Name:/i)
  await c.findByLabelText(/Uplinks Per Leaf:/i) 
  await c.findByLabelText(/Endpoint Count:/i)
}

// Legacy v0.1 compatibility stories (updated for workspace context)
export const LegacyComputedPreview: Story = {
  name: 'v0.1 Compatibility - Computed Preview',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    await ensureFabricAndConfig(c)

    const upl = await c.findByLabelText(/Uplinks Per Leaf:/i)
    await userEvent.clear(upl)
    await userEvent.type(upl, '4')

    const count = await c.findByLabelText(/Endpoint Count:/i)
    await userEvent.clear(count)
    await userEvent.type(count, '100')

    await userEvent.click(await c.findByRole('button', { name: /Compute/i }))
    await expect(await c.findByText(/leaves needed:/i)).toBeInTheDocument()
    await expect(await c.findByText(/spines needed:/i)).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 compute workflow with stable selectors and proper navigation.'
      }
    }
  }
}

export const LegacyInvalidUplinks: Story = {
  name: 'v0.1 Compatibility - Invalid Uplinks',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Setup fabric in workspace
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'Validation Test')
    
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await userEvent.click(submitButton)
    
    const selectButton = canvas.getByRole('button', { name: 'Select' })
    await userEvent.click(selectButton)
    
    // Test validation - set invalid uplinks (odd number)
    const uplinksInput = canvas.getByDisplayValue('2')
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '5')
    
    await userEvent.click(canvas.getByText('Compute Topology'))
    
    // Should show validation error (use getAllBy since there might be multiple)
    const errorElements = canvas.getAllByText(/uplinks per leaf must be/i)
    await expect(errorElements.length).toBeGreaterThan(0)
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 validation error handling in v0.2 workspace context.'
      }
    }
  }
}

export const LegacySaveAfterCompute: Story = {
  name: 'v0.1 Compatibility - Save After Compute',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    await ensureFabricAndConfig(c)

    await userEvent.clear(await c.findByLabelText(/Uplinks Per Leaf:/i))
    await userEvent.type(await c.findByLabelText(/Uplinks Per Leaf:/i), '4')
    await userEvent.clear(await c.findByLabelText(/Endpoint Count:/i))
    await userEvent.type(await c.findByLabelText(/Endpoint Count:/i), '100')

    await userEvent.click(await c.findByRole('button', { name: /Compute/i }))
    await expect(await c.findByText(/leaves needed:/i)).toBeInTheDocument()
    await expect(await c.findByText(/spines needed:/i)).toBeInTheDocument()
    await userEvent.click(await c.findByRole('button', { name: /Save.*FGD/i }))
    await expect(await c.findByText(/saved to fgd successfully/i)).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy v0.1 save workflow with stable selectors and proper save verification.'
      }
    }
  }
}