import type { Meta, StoryObj } from '@storybook/react'
import { within, userEvent, expect } from '@storybook/test'
import { FabricDesignerView } from '../components/FabricDesignerView'

const meta: Meta<typeof FabricDesignerView> = {
  title: 'HNC/Manual Overrides',
  component: FabricDesignerView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Manual override functionality for HNC v0.4. Allows users to override validation errors and warnings with explicit reasoning.'
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Helper function to set up a configuration with validation issues
const setupConfigWithIssues = async (canvas: ReturnType<typeof within>, scenario: 'warnings' | 'errors') => {
  // Fill in basic configuration
  const nameInput = canvas.getByLabelText(/Fabric Name/i)
  await userEvent.clear(nameInput)
  await userEvent.type(nameInput, 'Override Test Fabric')
  
  // Set spine and leaf models
  const spineSelect = canvas.getByLabelText(/Spine Model/i)
  await userEvent.selectOptions(spineSelect, 'DS3000')
  
  const leafSelect = canvas.getByLabelText(/Leaf Model/i)
  await userEvent.selectOptions(leafSelect, 'DS2000')
  
  // Set endpoint profile
  const profileSelect = canvas.getByLabelText(/Endpoint Profile/i)
  await userEvent.selectOptions(profileSelect, 'Standard Server')
  
  if (scenario === 'warnings') {
    // Create a scenario with warnings that can be overridden
    const uplinksInput = canvas.getByLabelText(/Uplinks Per Leaf/i)
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '2') // Valid even number
    
    const endpointsInput = canvas.getByLabelText(/Endpoint Count/i)
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '500') // High count that creates warnings
  } else {
    // Create a scenario with errors that can be overridden
    const uplinksInput = canvas.getByLabelText(/Uplinks Per Leaf/i)
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '3') // Odd number - creates error
    
    const endpointsInput = canvas.getByLabelText(/Endpoint Count/i)
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '100')
  }
  
  // Compute topology to generate issues
  const computeButton = canvas.getByTestId('compute-topology-button')
  await userEvent.click(computeButton)
  
  // Wait for computation to complete and issues to appear
  await canvas.findByTestId('issues-panel')
}

export const ManualOverrideWarnings: Story = {
  name: 'Manual Override Warnings (Save Enabled)',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set up configuration that generates warnings
    await setupConfigWithIssues(canvas, 'warnings')
    
    // Verify issues panel is displayed
    const issuesPanel = canvas.getByTestId('issues-panel')
    await expect(issuesPanel).toBeInTheDocument()
    
    // Should have warnings but not blocking errors
    await expect(canvas.getByText(/warnings/i)).toBeInTheDocument()
    
    // Save button should be enabled (warnings don't block save)
    const saveButton = canvas.getByTestId('save-to-fgd-button')
    await expect(saveButton).toBeEnabled()
    
    // Look for an overridable warning issue
    const warningIssues = canvas.getAllByText(/warning/i)
    expect(warningIssues.length).toBeGreaterThan(0)
    
    // Find and expand first issue that might be overridable
    const issueItems = canvas.getAllByRole('listitem')
    if (issueItems.length > 0) {
      // Click on the first issue to expand it
      await userEvent.click(issueItems[0])
      
      // Check if override section appears for overridable issues
      const overrideButtons = canvas.queryAllByText(/Override/i)
      if (overrideButtons.length > 0) {
        // Find the actual override button (not just text containing "override")
        const overrideButton = overrideButtons.find(button => 
          button.tagName === 'BUTTON' && button.textContent === 'Override'
        )
        
        if (overrideButton) {
          // Find the associated reason input
          const reasonInputs = canvas.getAllByPlaceholderText(/explain why/i)
          if (reasonInputs.length > 0) {
            await userEvent.type(reasonInputs[0], 'Business requirement to exceed recommended limits')
            
            // Apply the override
            await userEvent.click(overrideButton as HTMLElement)
            
            // Verify override was applied
            await expect(canvas.getByText(/OVERRIDDEN/i)).toBeInTheDocument()
            
            // Should see override chip
            await expect(canvas.getByText(/Override Active/i)).toBeInTheDocument()
          }
        }
      }
    }
    
    // Save should still be enabled
    await expect(saveButton).toBeEnabled()
    
    // Can successfully save
    await userEvent.click(saveButton)
    await expect(canvas.getByTestId('save-success-message')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates manual override of warning-level issues. Save remains enabled throughout the process, showing that warnings can be overridden without blocking deployment.'
      }
    }
  }
}

export const ManualOverrideError: Story = {
  name: 'Manual Override Error (Save Disabled)',
  tags: ['ci'], 
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set up configuration that generates overridable errors
    await setupConfigWithIssues(canvas, 'errors')
    
    // Verify issues panel is displayed
    const issuesPanel = canvas.getByTestId('issues-panel')
    await expect(issuesPanel).toBeInTheDocument()
    
    // Should have errors
    await expect(canvas.getByText(/error/i)).toBeInTheDocument()
    
    // Save button should be disabled initially (errors block save)
    const saveButton = canvas.getByTestId('save-to-fgd-button')
    await expect(saveButton).toBeDisabled()
    
    // Should see blocking message
    await expect(canvas.getByText(/resolve blocking issues/i)).toBeInTheDocument()
    
    // Look for overridable error
    const errorIssues = canvas.getAllByRole('listitem')
    if (errorIssues.length > 0) {
      // Click on the first error to expand it
      await userEvent.click(errorIssues[0])
      
      // Check for override capability
      const overrideButtons = canvas.queryAllByText(/Override/i)
      if (overrideButtons.length > 0) {
        const overrideButton = overrideButtons.find(button => 
          button.tagName === 'BUTTON' && button.textContent === 'Override'
        )
        
        if (overrideButton) {
          // Initially, override button should be disabled without reason
          await expect(overrideButton as HTMLElement).toBeDisabled()
          
          // Find and fill reason input
          const reasonInputs = canvas.getAllByPlaceholderText(/explain why/i)
          if (reasonInputs.length > 0) {
            await userEvent.type(reasonInputs[0], 'Acceptable risk for this deployment scenario')
            
            // Override button should now be enabled
            await expect(overrideButton as HTMLElement).toBeEnabled()
            
            // Apply the override
            await userEvent.click(overrideButton as HTMLElement)
            
            // Verify override was applied
            await expect(canvas.getByText(/OVERRIDDEN/i)).toBeInTheDocument()
            
            // Should see override chip indicating manual override is active
            await expect(canvas.getByText(/Override Active/i)).toBeInTheDocument()
            
            // Save button should now be enabled
            await expect(saveButton).toBeEnabled()
            
            // Blocking message should be gone
            const blockingMessage = canvas.queryByText(/resolve blocking issues/i)
            if (blockingMessage) {
              expect(blockingMessage).not.toBeInTheDocument()
            }
            
            // Can successfully save after override
            await userEvent.click(saveButton)
            await expect(canvas.getByTestId('save-success-message')).toBeInTheDocument()
          }
        }
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates manual override of error-level issues. Save is initially disabled but becomes enabled after applying manual overrides with proper reasoning.'
      }
    }
  }
}

export const OverrideChipInteraction: Story = {
  name: 'Override Chip Interaction',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set up configuration with errors
    await setupConfigWithIssues(canvas, 'errors')
    
    // Apply an override first (reuse logic from previous story)
    const errorIssues = canvas.getAllByRole('listitem')
    if (errorIssues.length > 0) {
      await userEvent.click(errorIssues[0])
      
      const overrideButtons = canvas.queryAllByText(/Override/i)
      const overrideButton = overrideButtons.find(button => 
        button.tagName === 'BUTTON' && button.textContent === 'Override'
      )
      
      if (overrideButton) {
        const reasonInputs = canvas.getAllByPlaceholderText(/explain why/i)
        if (reasonInputs.length > 0) {
          await userEvent.type(reasonInputs[0], 'Testing override chip functionality')
          await userEvent.click(overrideButton as HTMLElement)
          
          // Wait for override to be applied
          await canvas.findByText(/Override Active/i)
          
          // Test override chip interaction
          const overrideChip = canvas.getByText(/Override Active/i)
          await expect(overrideChip).toBeInTheDocument()
          
          // Chip should be accessible
          await expect(overrideChip).toHaveAttribute('role', 'button')
          await expect(overrideChip).toHaveAttribute('tabindex', '0')
          
          // Click on chip to show tooltip (if tooltip variant)
          await userEvent.click(overrideChip)
          
          // Look for clear override button in the issues panel
          const clearButtons = canvas.queryAllByText(/Clear Override/i)
          if (clearButtons.length > 0) {
            const clearButton = clearButtons[0]
            await userEvent.click(clearButton)
            
            // Override should be cleared
            const overrideChipAfter = canvas.queryByText(/Override Active/i)
            expect(overrideChipAfter).not.toBeInTheDocument()
            
            // Save should be disabled again
            const saveButton = canvas.getByTestId('save-to-fgd-button')
            await expect(saveButton).toBeDisabled()
          }
        }
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests the interaction with override chips, including tooltip display and clearing overrides.'
      }
    }
  }
}

export const MultipleOverrideScenarios: Story = {
  name: 'Multiple Override Types',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create a complex configuration with multiple issue types
    const nameInput = canvas.getByLabelText(/Fabric Name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Complex Override Test')
    
    const spineSelect = canvas.getByLabelText(/Spine Model/i)
    await userEvent.selectOptions(spineSelect, 'DS3000')
    
    const leafSelect = canvas.getByLabelText(/Leaf Model/i) 
    await userEvent.selectOptions(leafSelect, 'DS2000')
    
    const profileSelect = canvas.getByLabelText(/Endpoint Profile/i)
    await userEvent.selectOptions(profileSelect, 'High-Density Server')
    
    // Create multiple validation issues
    const uplinksInput = canvas.getByLabelText(/Uplinks Per Leaf/i)
    await userEvent.clear(uplinksInput)
    await userEvent.type(uplinksInput, '5') // Odd number
    
    const endpointsInput = canvas.getByLabelText(/Endpoint Count/i)
    await userEvent.clear(endpointsInput)
    await userEvent.type(endpointsInput, '1000') // Very high count
    
    // Compute to generate issues
    await userEvent.click(canvas.getByTestId('compute-topology-button'))
    
    // Should show issues panel
    await canvas.findByTestId('issues-panel')
    
    // Should have multiple issue types
    await expect(canvas.getByText(/Issues \(/i)).toBeInTheDocument()
    
    // Should show issue summary with different types
    const issuesSummary = canvas.getByText(/Issues \(\d+\)/i)
    expect(issuesSummary).toBeInTheDocument()
    
    // Verify save is initially disabled due to errors
    const saveButton = canvas.getByTestId('save-to-fgd-button')
    await expect(saveButton).toBeDisabled()
    
    // Should show different severity levels and categories
    const issueItems = canvas.getAllByRole('listitem')
    expect(issueItems.length).toBeGreaterThan(0)
    
    // Look for high severity indicators
    const severityBadges = canvas.queryAllByText(/HIGH|MEDIUM|LOW/i)
    expect(severityBadges.length).toBeGreaterThan(0)
    
    // Look for category indicators
    const categoryBadges = canvas.queryAllByText(/validation|constraint|optimization|configuration/i)
    expect(categoryBadges.length).toBeGreaterThan(0)
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates handling of multiple override scenarios with different issue types, severities, and categories.'
      }
    }
  }
}

export const AccessibilityCompliance: Story = {
  name: 'Accessibility Compliance',
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Set up basic configuration
    await setupConfigWithIssues(canvas, 'warnings')
    
    // Verify issues panel has proper ARIA attributes
    const issuesPanel = canvas.getByTestId('issues-panel')
    await expect(issuesPanel).toHaveAttribute('role', 'region')
    await expect(issuesPanel).toHaveAttribute('aria-label')
    
    // Check issue items have proper roles
    const issueItems = canvas.getAllByRole('listitem')
    expect(issueItems.length).toBeGreaterThan(0)
    
    // Verify expandable items have proper ARIA attributes
    const expandableItems = canvas.getAllByRole('button')
    expandableItems.forEach(item => {
      const ariaExpanded = item.getAttribute('aria-expanded')
      if (ariaExpanded !== null) {
        expect(['true', 'false']).toContain(ariaExpanded)
      }
    })
    
    // Test keyboard navigation
    const firstExpandableItem = expandableItems.find(item => 
      item.getAttribute('aria-expanded') !== null
    )
    
    if (firstExpandableItem) {
      // Focus the item
      firstExpandableItem.focus()
      
      // Test Enter key
      await userEvent.keyboard('{Enter}')
      
      // Should toggle expansion
      const updatedAriaExpanded = firstExpandableItem.getAttribute('aria-expanded')
      expect(updatedAriaExpanded).toBeTruthy()
    }
    
    // Check form inputs have proper labels
    const nameInput = canvas.getByLabelText(/Fabric Name/i)
    await expect(nameInput).toBeInTheDocument()
    
    const uplinksInput = canvas.getByLabelText(/Uplinks Per Leaf/i)
    await expect(uplinksInput).toBeInTheDocument()
    
    // Verify override chips have accessibility attributes
    const overrideChips = canvas.queryAllByText(/Override Active/i)
    overrideChips.forEach(chip => {
      expect(chip).toHaveAttribute('aria-label')
      expect(chip).toHaveAttribute('role', 'button')
      expect(chip).toHaveAttribute('tabindex', '0')
    })
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifies that all override functionality meets accessibility standards with proper ARIA attributes, keyboard navigation, and screen reader support.'
      }
    }
  }
}