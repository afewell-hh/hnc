/**
 * Navigation Stories - WP-NAV1
 * Tabbed navigation that mirrors stepper workflow
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import TabbedStepper from '../components/gfd/TabbedStepper'
import { StepValidationState } from '../hooks/useStepValidation'
import { ValidationIssue } from '../components/gfd/StatusBadge'

const meta: Meta<typeof TabbedStepper> = {
  title: 'Navigation/TabsMirrorStepper',
  component: TabbedStepper,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Tabbed navigation system that mirrors the stepper workflow with validation badges'
      }
    }
  },
  argTypes: {
    currentStep: {
      control: { type: 'range', min: 0, max: 5, step: 1 },
      description: 'Currently active step (0-5)'
    },
    saveBlocked: {
      control: 'boolean',
      description: 'Whether save actions are blocked'
    },
    showSaveActions: {
      control: 'boolean',
      description: 'Show save and promote buttons'
    }
  }
}

export default meta
type Story = StoryObj<typeof TabbedStepper>

// Mock validation states for different scenarios
const cleanValidations: StepValidationState = {
  templates: { stepId: 'templates', badge: 'ok', issues: [], hasChanged: true },
  endpoints: { stepId: 'endpoints', badge: 'ok', issues: [], hasChanged: true },
  externals: { stepId: 'externals', badge: 'ok', issues: [], hasChanged: true },
  topology: { stepId: 'topology', badge: 'ok', issues: [], hasChanged: true },
  review: { stepId: 'review', badge: 'ok', issues: [], hasChanged: false },
  deploy: { stepId: 'deploy', badge: 'pending', issues: [], hasChanged: false }
}

const mixedValidations: StepValidationState = {
  templates: { 
    stepId: 'templates', 
    badge: 'ok', 
    issues: [], 
    hasChanged: true 
  },
  endpoints: { 
    stepId: 'endpoints', 
    badge: 'warning', 
    issues: [
      { type: 'warning', message: 'High endpoint count may impact performance' }
    ], 
    hasChanged: true 
  },
  externals: { 
    stepId: 'externals', 
    badge: 'error', 
    issues: [
      { type: 'error', message: 'Border capability mismatch detected' },
      { type: 'error', message: 'External link validation failed' }
    ], 
    hasChanged: true 
  },
  topology: { 
    stepId: 'topology', 
    badge: 'loading', 
    issues: [], 
    hasChanged: true 
  },
  review: { 
    stepId: 'review', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  },
  deploy: { 
    stepId: 'deploy', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  }
}

const errorValidations: StepValidationState = {
  templates: { 
    stepId: 'templates', 
    badge: 'error', 
    issues: [
      { type: 'error', message: 'Switch model not selected' }
    ], 
    hasChanged: true 
  },
  endpoints: { 
    stepId: 'endpoints', 
    badge: 'error', 
    issues: [
      { type: 'error', message: 'No endpoint profiles defined' },
      { type: 'error', message: 'Invalid server count' }
    ], 
    hasChanged: true 
  },
  externals: { 
    stepId: 'externals', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  },
  topology: { 
    stepId: 'topology', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  },
  review: { 
    stepId: 'review', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  },
  deploy: { 
    stepId: 'deploy', 
    badge: 'pending', 
    issues: [], 
    hasChanged: false 
  }
}

// Base story with clean state
export const CleanNavigation: Story = {
  args: {
    currentStep: 0,
    stepValidations: cleanValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    onSave: () => console.log('Save draft'),
    onPromote: () => console.log('Promote to production'),
    saveBlocked: false,
    showSaveActions: true,
    children: (
      <div style={{ padding: '2rem', background: '#f8f9fa', minHeight: '300px' }}>
        <h3>Step Content Area</h3>
        <p>This is where the step-specific content would be rendered.</p>
        <p>Users can navigate between tabs freely while content is preserved.</p>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify tabs are rendered
    expect(canvas.getByRole('tab', { name: /Templates/ })).toBeInTheDocument()
    expect(canvas.getByRole('tab', { name: /Endpoints/ })).toBeInTheDocument()
    expect(canvas.getByRole('tab', { name: /Externals/ })).toBeInTheDocument()
    
    // Verify first tab is active
    expect(canvas.getByRole('tab', { name: /Templates/ })).toHaveAttribute('aria-selected', 'true')
    
    // Verify save actions are enabled
    expect(canvas.getByRole('button', { name: /Save Draft/ })).toBeEnabled()
    expect(canvas.getByRole('button', { name: /Promote/ })).toBeEnabled()
  }
}

// Tab navigation functionality
export const TabNavigation: Story = {
  args: {
    currentStep: 0,
    stepValidations: cleanValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Step Content</h3>
        <p>Click any tab to navigate. Content persists across navigation.</p>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Test tab navigation
    const endpointsTab = canvas.getByRole('tab', { name: /Endpoints/ })
    await userEvent.click(endpointsTab)
    
    // Verify tab becomes active
    expect(endpointsTab).toHaveAttribute('aria-selected', 'true')
    
    // Test forward navigation to topology
    const topologyTab = canvas.getByRole('tab', { name: /Topology/ })
    await userEvent.click(topologyTab)
    expect(topologyTab).toHaveAttribute('aria-selected', 'true')
    
    // Test keyboard navigation
    await userEvent.keyboard('{ArrowLeft}')
    expect(canvas.getByRole('tab', { name: /Externals/ })).toHaveAttribute('aria-selected', 'true')
  }
}

// Mixed validation state with warnings and errors
export const MixedValidationState: Story = {
  args: {
    currentStep: 2,
    stepValidations: mixedValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    onSave: () => console.log('Save draft'),
    onPromote: () => console.log('Promote to production'),
    saveBlocked: true,
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Externals Configuration</h3>
        <div style={{ background: '#fee', padding: '1rem', border: '1px solid #fcc', borderRadius: '4px' }}>
          <h4>❌ Validation Errors</h4>
          <ul>
            <li>Border capability mismatch detected</li>
            <li>External link validation failed</li>
          </ul>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify error badges are shown
    const externalsTab = canvas.getByRole('tab', { name: /Externals/ })
    expect(externalsTab).toHaveClass('step-tab-error')
    
    // Verify warning badges
    const endpointsTab = canvas.getByRole('tab', { name: /Endpoints/ })
    expect(endpointsTab).toHaveClass('step-tab-warning')
    
    // Verify save is blocked
    expect(canvas.getByRole('button', { name: /Save Draft/ })).toBeDisabled()
    expect(canvas.getByText(/Errors must be resolved/)).toBeInTheDocument()
  }
}

// Save blocked due to errors
export const SaveBlocked: Story = {
  args: {
    currentStep: 1,
    stepValidations: errorValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    onSave: () => console.log('Save draft'),
    onPromote: () => console.log('Promote to production'),
    saveBlocked: true,
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Endpoints Configuration</h3>
        <div style={{ background: '#fee', padding: '1rem', border: '1px solid #fcc', borderRadius: '4px' }}>
          <h4>❌ Critical Errors</h4>
          <ul>
            <li>No endpoint profiles defined</li>
            <li>Invalid server count</li>
          </ul>
          <p><strong>These errors must be resolved before saving.</strong></p>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify multiple error badges
    expect(canvas.getAllByText('2')).toHaveLength(1) // Error count badge
    
    // Verify save buttons are disabled
    expect(canvas.getByRole('button', { name: /Save Draft/ })).toBeDisabled()
    expect(canvas.getByRole('button', { name: /Promote/ })).toBeDisabled()
    
    // Verify error summary is shown
    expect(canvas.getByText(/2 errors/)).toBeInTheDocument()
    expect(canvas.getByText(/must be resolved/)).toBeInTheDocument()
  }
}

// Validation persistence across tabs
export const ValidationPersistence: Story = {
  args: {
    currentStep: 0,
    stepValidations: mixedValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Navigation Test</h3>
        <p>Switch between tabs to verify validation states persist correctly.</p>
        <p>Badge states should remain consistent regardless of current tab.</p>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Start at templates (OK state)
    expect(canvas.getByRole('tab', { name: /Templates/ })).not.toHaveClass('step-tab-error')
    
    // Navigate to endpoints (warning state)
    await userEvent.click(canvas.getByRole('tab', { name: /Endpoints/ }))
    expect(canvas.getByRole('tab', { name: /Endpoints/ })).toHaveClass('step-tab-warning')
    
    // Navigate to externals (error state) 
    await userEvent.click(canvas.getByRole('tab', { name: /Externals/ }))
    expect(canvas.getByRole('tab', { name: /Externals/ })).toHaveClass('step-tab-error')
    
    // Navigate back to templates - should still be OK
    await userEvent.click(canvas.getByRole('tab', { name: /Templates/ }))
    expect(canvas.getByRole('tab', { name: /Templates/ })).not.toHaveClass('step-tab-error')
    
    // Verify other tabs maintained their state
    expect(canvas.getByRole('tab', { name: /Endpoints/ })).toHaveClass('step-tab-warning')
    expect(canvas.getByRole('tab', { name: /Externals/ })).toHaveClass('step-tab-error')
  }
}

// Loading state during processing
export const LoadingState: Story = {
  args: {
    currentStep: 3,
    stepValidations: mixedValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Topology Computation</h3>
        <div style={{ background: '#e6f3ff', padding: '1rem', border: '1px solid #99d6ff', borderRadius: '4px' }}>
          <h4>⟳ Processing...</h4>
          <p>Computing optimal fabric topology based on your configuration.</p>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify loading badge is animated
    const topologyTab = canvas.getByRole('tab', { name: /Topology/ })
    expect(topologyTab).toHaveAttribute('aria-selected', 'true')
    
    // Loading indicator should be present in badge
    const loadingBadge = canvas.getByText('⟳')
    expect(loadingBadge).toBeInTheDocument()
  }
}

// Keyboard accessibility
export const KeyboardNavigation: Story = {
  args: {
    currentStep: 0,
    stepValidations: cleanValidations,
    onStepChange: (step) => console.log(`Navigate to step: ${step}`),
    children: (
      <div style={{ padding: '2rem' }}>
        <h3>Keyboard Navigation Test</h3>
        <p>Use arrow keys, Home, End to navigate between tabs.</p>
        <p>Use Enter or Space to activate tabs.</p>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Focus first tab
    const firstTab = canvas.getByRole('tab', { name: /Templates/ })
    firstTab.focus()
    
    // Navigate right with arrow key
    await userEvent.keyboard('{ArrowRight}')
    expect(canvas.getByRole('tab', { name: /Endpoints/ })).toHaveAttribute('aria-selected', 'true')
    
    // Navigate to end with End key
    await userEvent.keyboard('{End}')
    expect(canvas.getByRole('tab', { name: /Deploy/ })).toHaveAttribute('aria-selected', 'true')
    
    // Navigate to beginning with Home key
    await userEvent.keyboard('{Home}')
    expect(canvas.getByRole('tab', { name: /Templates/ })).toHaveAttribute('aria-selected', 'true')
  }
}