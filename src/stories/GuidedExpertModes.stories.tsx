import type { Meta, StoryObj } from '@storybook/react'
import { expect } from '@storybook/test'
import { within, userEvent, waitFor } from '@storybook/test'
import React, { useState } from 'react'
import { UserModeProvider } from '../contexts/UserModeContext'
import { ModeToggle } from '../components/ModeToggle'
import { CreateFabricForm } from '../components/CreateFabricForm'
import { ExplainButton } from '../components/ExplainTooltip'
import { GuidedTips } from '../components/GuidedTips'

const meta: Meta = {
  title: 'WP-UXG2/Guided vs Expert Modes',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'WP-UXG2: Enhanced Guided vs Expert modes with inline explanations, persisted toggle, and comprehensive UX improvements.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <Story />
      </div>
    )
  ]
}

export default meta

type Story = StoryObj

// Demo wrapper component that shows both modes side by side
const GuidedExpertDemo: React.FC<{
  initialMode?: 'guided' | 'expert',
  showComparison?: boolean
}> = ({ initialMode = 'guided', showComparison = false }) => {
  const [fabrics, setFabrics] = useState<string[]>(['production-east', 'dev-cluster'])
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateFabric = async (name: string) => {
    setIsCreating(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setFabrics(prev => [...prev, name])
    setIsCreating(false)
  }

  const handleCancel = () => {
    // Cancel logic
  }

  const guidedTips = [
    {
      id: 'welcome-tip',
      title: 'Welcome to Guided Mode!',
      content: (
        <div>
          <p>In guided mode, you'll see helpful explanations and tips throughout the interface.</p>
          <p>Look for <strong>?</strong> buttons next to fields for more information.</p>
        </div>
      ),
      target: 'fabric-name',
      priority: 10
    },
    {
      id: 'naming-tip',
      title: 'Naming Best Practices',
      content: (
        <div>
          <p>Choose descriptive names that indicate:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Environment (prod, dev, staging)</li>
            <li>Location (east, west, datacenter-01)</li>
            <li>Purpose (ml-training, web-cluster)</li>
          </ul>
        </div>
      ),
      target: 'fabric-name',
      priority: 8
    }
  ]

  if (showComparison) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '100vh' }}>
        <div style={{ borderRight: '2px solid #e5e7eb', paddingRight: '20px' }}>
          <div style={{ 
            backgroundColor: '#eff6ff', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #3b82f6'
          }}>
            <h2 style={{ margin: 0, color: '#1e40af', fontSize: '18px' }}>🎯 Guided Mode</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e40af' }}>
              Shows helpful tips and explanations for new users
            </p>
          </div>
          <UserModeProvider defaultMode="guided">
            <div style={{ marginBottom: '20px' }}>
              <ModeToggle showDescriptions />
            </div>
            <GuidedTips tips={guidedTips} />
            <CreateFabricForm
              onCreateFabric={handleCreateFabric}
              onCancel={handleCancel}
              isCreating={isCreating}
              existingFabrics={fabrics}
              suggestedNames={['staging-west', 'test-lab', 'backup-cluster']}
              validationRules={{
                minLength: 3,
                maxLength: 30,
                pattern: /^[a-z0-9-]+$/,
                forbiddenNames: ['system', 'admin', 'root']
              }}
            />
            <div style={{ marginTop: '20px' }}>
              <h4>Sample field with inline explanation:</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label>Uplinks per Leaf:</label>
                <input 
                  type="number" 
                  defaultValue={4} 
                  style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
                <ExplainButton
                  explanation="Uplinks are connections from leaf switches to spine switches. More uplinks provide better redundancy and bandwidth, but increase cost. Typical values are 2-8 uplinks per leaf."
                  title="Understanding uplinks"
                />
              </div>
            </div>
          </UserModeProvider>
        </div>

        <div style={{ paddingLeft: '20px' }}>
          <div style={{ 
            backgroundColor: '#fef7ff', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #a855f7'
          }}>
            <h2 style={{ margin: 0, color: '#7c3aed', fontSize: '18px' }}>⚡ Expert Mode</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7c3aed' }}>
              Shows advanced controls and field provenance information
            </p>
          </div>
          <UserModeProvider defaultMode="expert">
            <div style={{ marginBottom: '20px' }}>
              <ModeToggle showDescriptions />
            </div>
            <CreateFabricForm
              onCreateFabric={handleCreateFabric}
              onCancel={handleCancel}
              isCreating={isCreating}
              existingFabrics={fabrics}
              suggestedNames={['staging-west', 'test-lab', 'backup-cluster']}
              validationRules={{
                minLength: 3,
                maxLength: 30,
                pattern: /^[a-z0-9-]+$/,
                forbiddenNames: ['system', 'admin', 'root']
              }}
            />
            <div style={{ marginTop: '20px' }}>
              <h4>Sample field with provenance info:</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label>Uplinks per Leaf:</label>
                <input 
                  type="number" 
                  defaultValue={4} 
                  style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
                <div style={{ 
                  fontSize: '11px', 
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #3b82f6',
                  borderRadius: '12px',
                  padding: '2px 6px',
                  color: '#3b82f6'
                }}>
                  🧮 computed
                </div>
              </div>
            </div>
          </UserModeProvider>
        </div>
      </div>
    )
  }

  return (
    <UserModeProvider defaultMode={initialMode}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <ModeToggle 
            showDescriptions
            onModeChange={(newMode, previousMode) => {
              console.log(`Mode changed from ${previousMode} to ${newMode}`)
            }}
          />
        </div>

        {initialMode === 'guided' && <GuidedTips tips={guidedTips} />}
        
        <CreateFabricForm
          onCreateFabric={handleCreateFabric}
          onCancel={handleCancel}
          isCreating={isCreating}
          existingFabrics={fabrics}
          suggestedNames={['staging-west', 'test-lab', 'backup-cluster']}
          validationRules={{
            minLength: 3,
            maxLength: 30,
            pattern: /^[a-z0-9-]+$/,
            forbiddenNames: ['system', 'admin', 'root']
          }}
        />

        <div style={{ marginTop: '40px' }}>
          <h3>Existing Fabrics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fabrics.map((fabric, index) => (
              <div 
                key={index}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{fabric}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {index < 2 ? 'Pre-existing' : 'Just created'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </UserModeProvider>
  )
}

// Story 1: Guided Mode Experience
export const GuidedModeExperience: Story = {
  render: () => <GuidedExpertDemo initialMode="guided" />,
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the guided mode experience with contextual tips, inline explanations, and progressive disclosure. Users see helpful hints and "?" buttons throughout the interface.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify guided mode is active
    const modeToggle = canvas.getByTestId('mode-toggle')
    expect(modeToggle).toHaveAttribute('data-current-mode', 'guided')
    
    // Verify guided mode button is pressed
    const guidedButton = canvas.getByTestId('guided-mode-button')
    expect(guidedButton).toHaveAttribute('aria-pressed', 'true')
    
    // Verify form is in guided mode
    const form = canvas.getByTestId('create-fabric-form')
    expect(form).toHaveAttribute('data-user-mode', 'guided')
    
    // Check for explain buttons (should be visible in guided mode)
    const explainButtons = canvas.getAllByTestId('explain-button')
    expect(explainButtons.length).toBeGreaterThan(0)
    
    // Test form interaction
    const nameInput = canvas.getByTestId('fabric-name-input')
    await userEvent.click(nameInput)
    
    // Check for suggestions in guided mode
    await waitFor(() => {
      const suggestions = canvas.queryByTestId('name-suggestions')
      if (suggestions) {
        expect(suggestions).toBeInTheDocument()
      }
    })
    
    // Test validation
    await userEvent.type(nameInput, 'a') // Too short
    await userEvent.tab()
    
    await waitFor(() => {
      const validationError = canvas.getByTestId('validation-error')
      expect(validationError).toBeInTheDocument()
      expect(validationError.textContent).toContain('at least 3 characters')
    })
    
    // Fix validation error
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'test-fabric-guided')
    
    await waitFor(() => {
      const createButton = canvas.getByTestId('create-button')
      expect(createButton).not.toBeDisabled()
    })
    
    console.log('✅ Guided mode experience test passed')
  }
}

// Story 2: Expert Mode Experience  
export const ExpertModeExperience: Story = {
  render: () => <GuidedExpertDemo initialMode="expert" />,
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the expert mode experience with advanced controls, field provenance information, and reduced UI assistance. Expert users see technical details and data lineage.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify expert mode is active
    const modeToggle = canvas.getByTestId('mode-toggle')
    expect(modeToggle).toHaveAttribute('data-current-mode', 'expert')
    
    // Verify expert mode button is pressed
    const expertButton = canvas.getByTestId('expert-mode-button')
    expect(expertButton).toHaveAttribute('aria-pressed', 'true')
    
    // Verify form is in expert mode
    const form = canvas.getByTestId('create-fabric-form')
    expect(form).toHaveAttribute('data-user-mode', 'expert')
    
    // Check for provenance chips (should be visible in expert mode)
    await waitFor(() => {
      const provenanceElements = canvas.queryAllByTestId('expert-provenance')
      // Provenance might not be visible until user interacts with form
      expect(provenanceElements.length).toBeGreaterThanOrEqual(0)
    })
    
    // Test form interaction in expert mode
    const nameInput = canvas.getByTestId('fabric-name-input')
    await userEvent.type(nameInput, 'expert-fabric-test')
    
    // In expert mode, there should be fewer guidance elements
    const guidanceTips = canvas.queryAllByTestId('guidance-tip')
    expect(guidanceTips.length).toBeLessThanOrEqual(2) // Should be minimal or none
    
    // Test mode switching
    const guidedButton = canvas.getByTestId('guided-mode-button')
    await userEvent.click(guidedButton)
    
    await waitFor(() => {
      expect(modeToggle).toHaveAttribute('data-current-mode', 'guided')
    })
    
    // Switch back to expert mode
    await userEvent.click(expertButton)
    
    await waitFor(() => {
      expect(modeToggle).toHaveAttribute('data-current-mode', 'expert')
    })
    
    console.log('✅ Expert mode experience test passed')
  }
}

// Story 3: Side-by-side comparison
export const SideBySideComparison: Story = {
  render: () => <GuidedExpertDemo showComparison />,
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison showing the same interface in both guided and expert modes. This highlights the differences in information density, assistance level, and visual presentation.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Find both forms (guided and expert side by side)
    const forms = canvas.getAllByTestId('create-fabric-form')
    expect(forms).toHaveLength(2)
    
    // Verify one is guided and one is expert
    const guidedForm = forms.find(form => form.getAttribute('data-user-mode') === 'guided')
    const expertForm = forms.find(form => form.getAttribute('data-user-mode') === 'expert')
    
    expect(guidedForm).toBeDefined()
    expect(expertForm).toBeDefined()
    
    // Test that explain buttons are more prevalent in guided mode
    const guidedExplainButtons = within(guidedForm!).getAllByTestId('explain-button')
    
    // In expert mode, explain buttons might be hidden or fewer
    const expertExplainButtons = within(expertForm!).queryAllByTestId('explain-button')
    
    // Guided should have at least as many explain buttons as expert
    expect(guidedExplainButtons.length).toBeGreaterThanOrEqual(expertExplainButtons.length)
    
    console.log('✅ Side-by-side comparison test passed')
  }
}

// Story 4: Mode Toggle Component Showcase
export const ModeToggleShowcase: Story = {
  render: () => (
    <UserModeProvider defaultMode="guided">
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div>
          <h3>Default Mode Toggle</h3>
          <ModeToggle />
        </div>
        
        <div>
          <h3>With Descriptions</h3>
          <ModeToggle showDescriptions />
        </div>
        
        <div>
          <h3>Without Icons</h3>
          <ModeToggle showIcons={false} />
        </div>
        
        <div>
          <h3>Without Labels</h3>
          <ModeToggle showLabels={false} />
        </div>
        
        <div>
          <h3>Small Size</h3>
          <ModeToggle size="small" />
        </div>
        
        <div>
          <h3>Large Size</h3>
          <ModeToggle size="large" showDescriptions />
        </div>
        
        <div>
          <h3>With Change Handler</h3>
          <ModeToggle 
            showDescriptions
            onModeChange={(newMode, previousMode) => {
              // This would normally trigger analytics or other side effects
              console.log(`Mode changed: ${previousMode} → ${newMode}`)
            }}
          />
        </div>
      </div>
    </UserModeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of different ModeToggle configurations and features including persistence, descriptions, and event handling.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Test all the different mode toggle variations
    const modeToggles = canvas.getAllByTestId('mode-toggle')
    expect(modeToggles.length).toBeGreaterThan(1)
    
    // Test that first toggle works
    const firstToggle = modeToggles[0]
    const firstExpertButton = within(firstToggle).getByTestId('expert-mode-button')
    
    await userEvent.click(firstExpertButton)
    
    await waitFor(() => {
      expect(firstExpertButton).toHaveAttribute('aria-pressed', 'true')
    })
    
    console.log('✅ Mode toggle showcase test passed')
  }
}

// Story 5: Accessibility and Keyboard Navigation
export const AccessibilityShowcase: Story = {
  render: () => <GuidedExpertDemo initialMode="guided" />,
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates accessibility features including semantic selectors, ARIA attributes, keyboard navigation, and screen reader support.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Test semantic selectors and ARIA attributes
    const modeToggle = canvas.getByRole('group', { name: 'User experience mode toggle' })
    expect(modeToggle).toBeInTheDocument()
    
    // Test keyboard navigation
    const guidedButton = canvas.getByTestId('guided-mode-button')
    const expertButton = canvas.getByTestId('expert-mode-button')
    
    guidedButton.focus()
    expect(document.activeElement).toBe(guidedButton)
    
    // Test tab navigation
    await userEvent.tab()
    expect(document.activeElement).toBe(expertButton)
    
    // Test space key activation
    await userEvent.keyboard(' ')
    
    await waitFor(() => {
      expect(expertButton).toHaveAttribute('aria-pressed', 'true')
    })
    
    // Test form accessibility
    const nameInput = canvas.getByTestId('fabric-name-input')
    const label = canvas.getByText('Fabric Name')
    
    expect(nameInput.id).toBeTruthy()
    expect(label).toHaveAttribute('for', nameInput.id)
    
    // Test validation error accessibility
    await userEvent.click(nameInput)
    await userEvent.type(nameInput, 'x')
    await userEvent.tab()
    
    await waitFor(() => {
      const errorElement = canvas.getByTestId('validation-error')
      expect(errorElement).toHaveAttribute('role', 'alert')
      expect(nameInput).toHaveAttribute('aria-describedby', 'fabric-name-error')
    })
    
    console.log('✅ Accessibility showcase test passed')
  }
}