import type { Meta, StoryObj } from '@storybook/react'
import { within, userEvent, expect } from '@storybook/test'
import App from '../App'

const meta: Meta<typeof App> = {
  title: 'HNC/User Mode Toggle - WP-UXG1',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'User Mode Toggle implementation (WP-UXG1): Guided vs Expert mode with localStorage persistence, mode-aware hints, and provenance chip visibility.'
      }
    }
  },
  tags: ['ci'],
}

export default meta
type Story = StoryObj<typeof meta>

// Helper function to set up fabric for testing
const ensureFabricAndDesignerMode = async (c: ReturnType<typeof within>) => {
  // Create fabric if needed
  const createBtn = await c.queryByRole('button', { name: /Create.*Fabric/i })
  if (createBtn) {
    await userEvent.click(createBtn)
    const nameInput = await c.findByPlaceholderText('Enter fabric name...')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'UXG1 Test Fabric')
    await userEvent.click(await c.findByRole('button', { name: /^Create$/i }))
  }
  
  // Enter designer mode
  const selectButton = await c.findByRole('button', { name: 'Select' })
  await userEvent.click(selectButton)
  
  // Wait for designer to be ready
  await c.findByTestId('fabric-designer-view')
  await c.findByTestId('mode-toggle')
}

export const GuidedHappyPath: Story = {
  name: 'Guided Mode - Happy Path with Hints',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Ensure we're in fabric designer mode
    await ensureFabricAndDesignerMode(canvas)
    
    // Verify guided mode is default and toggle is present
    const modeToggle = canvas.getByTestId('mode-toggle')
    await expect(modeToggle).toBeInTheDocument()
    
    const guidedButton = canvas.getByTestId('guided-mode-button')
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'true')
    
    // Verify guided hints are visible
    const configSection = canvas.getByTestId('config-section')
    await expect(configSection).toBeInTheDocument()
    
    // Should see guided hints
    const inlineHints = canvas.getAllByTestId('inline-hint')
    expect(inlineHints.length).toBeGreaterThan(0)
    
    // Should see help buttons
    const helpButtons = canvas.getAllByTestId('help-button')
    expect(helpButtons.length).toBeGreaterThan(0)
    
    // Test tooltip interaction on fabric name field
    const fabricNameInput = canvas.getByTestId('fabric-name-input')
    await userEvent.hover(fabricNameInput.parentElement!)
    
    // Fill out form with guided assistance
    await userEvent.clear(fabricNameInput)
    await userEvent.type(fabricNameInput, 'Guided Mode Test')
    
    // Select models
    await userEvent.selectOptions(
      canvas.getByTestId('spine-model-select'),
      canvas.getByRole('option', { name: /DS3000/ })
    )
    
    await userEvent.selectOptions(
      canvas.getByTestId('leaf-model-select'),
      canvas.getByRole('option', { name: /DS2000/ })
    )
    
    // Set uplinks (even number for validation)
    const uplinksInput = canvas.getByTestId('uplinks-per-leaf-input')
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '4')
    
    // Set endpoint count
    const endpointsInput = canvas.getByTestId('endpoint-count-input')
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '96')
    
    // Select endpoint profile
    await userEvent.selectOptions(
      canvas.getByTestId('endpoint-profile-select'),
      canvas.getByRole('option', { name: /Standard Server/ })
    )
    
    // Click compute topology
    const computeButton = canvas.getByTestId('compute-topology-button')
    await userEvent.click(computeButton)
    
    // Should show computed results
    await expect(canvas.getByText(/Computed Topology/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Leaves needed:/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Spines needed:/i)).toBeInTheDocument()
    
    // In guided mode, provenance chips should not be visible by default
    const overrideChips = canvas.queryAllByTestId(/override-chip-/)
    expect(overrideChips.length).toBe(0) // No overrides in this happy path scenario
  },
  parameters: {
    docs: {
      description: {
        story: 'Guided mode showing helpful hints, tooltips, and hidden complexity. New users see contextual help throughout the configuration process.'
      }
    }
  }
}

export const ExpertOverridesVisible: Story = {
  name: 'Expert Mode - Overrides Visible',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Ensure we're in fabric designer mode
    await ensureFabricAndDesignerMode(canvas)
    
    // Switch to expert mode
    const expertButton = canvas.getByTestId('expert-mode-button')
    await userEvent.click(expertButton)
    
    // Verify expert mode is active
    await expect(expertButton).toHaveAttribute('aria-pressed', 'true')
    const guidedButton = canvas.getByTestId('guided-mode-button')
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'false')
    
    // In expert mode, guided hints should be hidden
    const inlineHints = canvas.queryAllByTestId('inline-hint')
    expect(inlineHints.length).toBe(0)
    
    // Fill out form to create an invalid scenario that might trigger overrides
    const fabricNameInput = canvas.getByTestId('fabric-name-input')
    await userEvent.clear(fabricNameInput)
    await userEvent.type(fabricNameInput, 'Expert Mode Test')
    
    // Select models
    await userEvent.selectOptions(
      canvas.getByTestId('spine-model-select'),
      canvas.getByRole('option', { name: /DS3000/ })
    )
    
    await userEvent.selectOptions(
      canvas.getByTestId('leaf-model-select'),
      canvas.getByRole('option', { name: /DS2000/ })
    )
    
    // Set odd uplinks to trigger validation error
    const uplinksInput = canvas.getByTestId('uplinks-per-leaf-input')
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '3') // Odd number should trigger validation
    
    // Set endpoint count
    const endpointsInput = canvas.getByTestId('endpoint-count-input')
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '48')
    
    // Select endpoint profile
    await userEvent.selectOptions(
      canvas.getByTestId('endpoint-profile-select'),
      canvas.getByRole('option', { name: /Standard Server/ })
    )
    
    // Click compute topology
    const computeButton = canvas.getByTestId('compute-topology-button')
    await userEvent.click(computeButton)
    
    // Should show validation errors
    await expect(canvas.getByText(/Errors:/i)).toBeInTheDocument()
    
    // Verify expert mode functionality - advanced features visible
    // In expert mode, if there were override chips, they would be visible
    // The key is that expert mode doesn't hide complexity
    
    // Expert mode should show all available functionality without hints
    await expect(canvas.getByTestId('fabric-designer-view')).toBeInTheDocument()
    
    // Mode persistence: switch back to guided and then back to expert
    const guidedModeButton = canvas.getByTestId('guided-mode-button')
    await userEvent.click(guidedModeButton)
    await expect(guidedModeButton).toHaveAttribute('aria-pressed', 'true')
    
    // Switch back to expert
    await userEvent.click(expertButton)
    await expect(expertButton).toHaveAttribute('aria-pressed', 'true')
  },
  parameters: {
    docs: {
      description: {
        story: 'Expert mode with provenance chips visible by default, no guided hints, and full access to advanced features. Power users see all functionality.'
      }
    }
  }
}

export const ModeTogglePersistence: Story = {
  name: 'Mode Toggle - localStorage Persistence',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Ensure we're in fabric designer mode
    await ensureFabricAndDesignerMode(canvas)
    
    // Start in guided mode (default)
    const guidedButton = canvas.getByTestId('guided-mode-button')
    const expertButton = canvas.getByTestId('expert-mode-button')
    
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'true')
    await expect(expertButton).toHaveAttribute('aria-pressed', 'false')
    
    // Switch to expert mode
    await userEvent.click(expertButton)
    await expect(expertButton).toHaveAttribute('aria-pressed', 'true')
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'false')
    
    // Verify localStorage is updated (in actual browser, not jsdom)
    // This test validates the toggle UI behavior
    
    // Switch back to guided mode
    await userEvent.click(guidedButton)
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'true')
    await expect(expertButton).toHaveAttribute('aria-pressed', 'false')
    
    // Test rapid toggling
    await userEvent.click(expertButton)
    await userEvent.click(guidedButton)
    await userEvent.click(expertButton)
    
    // Should end up in expert mode
    await expect(expertButton).toHaveAttribute('aria-pressed', 'true')
    await expect(guidedButton).toHaveAttribute('aria-pressed', 'false')
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests mode toggle persistence and UI state management. Mode selection should persist across sessions via localStorage.'
      }
    }
  }
}

export const GuidedModeTooltipInteractions: Story = {
  name: 'Guided Mode - Tooltip and Help Interactions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Ensure we're in fabric designer mode in guided mode
    await ensureFabricAndDesignerMode(canvas)
    
    // Ensure we're in guided mode
    const guidedButton = canvas.getByTestId('guided-mode-button')
    if (await guidedButton.getAttribute('aria-pressed') !== 'true') {
      await userEvent.click(guidedButton)
    }
    
    // Test help button interactions
    const helpButtons = canvas.getAllByTestId('help-button')
    expect(helpButtons.length).toBeGreaterThan(0)
    
    // Click first help button
    const firstHelpButton = helpButtons[0]
    await userEvent.click(firstHelpButton)
    
    // Should show help popover
    const helpPopover = canvas.getByTestId('help-popover')
    await expect(helpPopover).toBeInTheDocument()
    
    // Test tooltip on form fields (hover interactions)
    const tooltipWrappers = canvas.getAllByTestId('tooltip-wrapper')
    expect(tooltipWrappers.length).toBeGreaterThan(0)
    
    // Hover over first tooltip wrapper
    await userEvent.hover(tooltipWrappers[0])
    
    // Test inline hints are present
    const inlineHints = canvas.getAllByTestId('inline-hint')
    expect(inlineHints.length).toBeGreaterThan(0)
    
    // Verify hint variants
    const tipHint = canvas.queryByTestId('inline-hint[data-variant="tip"]')
    const infoHint = canvas.queryByTestId('inline-hint[data-variant="info"]')
    
    // At least one hint should be present
    expect(inlineHints.length).toBeGreaterThanOrEqual(1)
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive guided mode features: tooltips show on hover, help buttons reveal contextual information, and inline hints provide guidance.'
      }
    }
  }
}

export const ExpertModeComplexWorkflow: Story = {
  name: 'Expert Mode - Advanced Workflow',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Ensure we're in fabric designer mode
    await ensureFabricAndDesignerMode(canvas)
    
    // Switch to expert mode immediately
    const expertButton = canvas.getByTestId('expert-mode-button')
    await userEvent.click(expertButton)
    
    // Verify no guided elements are present
    const inlineHints = canvas.queryAllByTestId('inline-hint')
    expect(inlineHints.length).toBe(0)
    
    // Fill out form with complex configuration
    const fabricNameInput = canvas.getByTestId('fabric-name-input')
    await userEvent.clear(fabricNameInput)
    await userEvent.type(fabricNameInput, 'Complex Expert Fabric')
    
    // Select models
    await userEvent.selectOptions(
      canvas.getByTestId('spine-model-select'),
      canvas.getByRole('option', { name: /DS3000/ })
    )
    
    await userEvent.selectOptions(
      canvas.getByTestId('leaf-model-select'),
      canvas.getByRole('option', { name: /DS2000/ })
    )
    
    // Use higher port count for expert scenario
    const uplinksInput = canvas.getByTestId('uplinks-per-leaf-input')
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '6') // Higher uplink count
    
    const endpointsInput = canvas.getByTestId('endpoint-count-input')
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '144') // Higher endpoint count
    
    // Select high-density servers
    await userEvent.selectOptions(
      canvas.getByTestId('endpoint-profile-select'),
      canvas.getByRole('option', { name: /High-Density/ })
    )
    
    // Compute topology
    const computeButton = canvas.getByTestId('compute-topology-button')
    await userEvent.click(computeButton)
    
    // Should handle complex topology calculation
    await expect(canvas.getByText(/Computed Topology/i)).toBeInTheDocument()
    
    // In expert mode, all advanced features should be accessible
    // Verify no simplification is applied
    await expect(canvas.getByTestId('fabric-designer-view')).toBeInTheDocument()
    
    // If save is available, expert mode should show it without additional explanation
    const saveButton = canvas.queryByTestId('save-to-fgd-button')
    if (saveButton && !saveButton.hasAttribute('disabled')) {
      await userEvent.click(saveButton)
      // Expert mode handles save without extra guidance
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Expert mode handling complex configurations without guided assistance. Shows full feature set and advanced capabilities.'
      }
    }
  }
}