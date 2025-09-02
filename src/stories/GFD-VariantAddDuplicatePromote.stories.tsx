/**
 * GFD Variant Management Stories - WP-GFD1
 * Demonstrates variant creation, duplication, and promotion in Explore mode
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import React, { useState } from 'react'
import StepperView from '../components/gfd/StepperView'
import { applyHPDCTemplate } from '../templates/hpdc-defaults'
import type { FabricSpec } from '../app.state'

const meta = {
  title: 'GFD/VariantAddDuplicatePromote',
  component: StepperView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Variant management in Explore mode - WP-GFD1'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof StepperView>

export default meta
type Story = StoryObj<typeof meta>

// Enhanced stepper with variant tracking
const VariantExplorer: React.FC = () => {
  const [variants, setVariants] = useState<Record<string, FabricSpec>>({})
  const [activeVariant, setActiveVariant] = useState<string>('main')
  const [mainSpec, setMainSpec] = useState<FabricSpec>(
    applyHPDCTemplate('hpdc-compute-small')
  )
  const [variantHistory, setVariantHistory] = useState<string[]>([])

  const handleCreateVariant = () => {
    const variantName = `Variant ${String.fromCharCode(65 + Object.keys(variants).length)}`
    const newSpec = { ...mainSpec }
    setVariants(prev => ({ ...prev, [variantName]: newSpec }))
    setActiveVariant(variantName)
    setVariantHistory(prev => [...prev, `Created ${variantName}`])
    return variantName
  }

  const handleDuplicateVariant = (sourceKey: string) => {
    const source = sourceKey === 'main' ? mainSpec : variants[sourceKey]
    const newName = `${sourceKey} Copy`
    setVariants(prev => ({ ...prev, [newName]: { ...source } }))
    setVariantHistory(prev => [...prev, `Duplicated ${sourceKey} → ${newName}`])
    return newName
  }

  const handlePromoteVariant = (variantKey: string) => {
    const promoted = variants[variantKey]
    if (promoted) {
      setMainSpec(promoted)
      setActiveVariant('main')
      setVariantHistory(prev => [...prev, `Promoted ${variantKey} to Main`])
    }
  }

  const handleDeleteVariant = (variantKey: string) => {
    setVariants(prev => {
      const updated = { ...prev }
      delete updated[variantKey]
      return updated
    })
    if (activeVariant === variantKey) {
      setActiveVariant('main')
    }
    setVariantHistory(prev => [...prev, `Deleted ${variantKey}`])
  }

  const getCurrentSpec = () => {
    return activeVariant === 'main' ? mainSpec : variants[activeVariant]
  }

  const handleSpecChange = (spec: FabricSpec) => {
    if (activeVariant === 'main') {
      setMainSpec(spec)
    } else {
      setVariants(prev => ({ ...prev, [activeVariant]: spec }))
    }
  }

  return (
    <div className="variant-explorer">
      <div className="variant-sidebar">
        <h3>Configuration Variants</h3>
        
        <div className="variant-list">
          <button
            className={`variant-item ${activeVariant === 'main' ? 'active' : ''}`}
            onClick={() => setActiveVariant('main')}
          >
            <span className="variant-icon">🏠</span>
            Main Configuration
            <span className="variant-badge">Primary</span>
          </button>

          {Object.keys(variants).map(variantKey => (
            <div key={variantKey} className="variant-item-wrapper">
              <button
                className={`variant-item ${activeVariant === variantKey ? 'active' : ''}`}
                onClick={() => setActiveVariant(variantKey)}
              >
                <span className="variant-icon">🔀</span>
                {variantKey}
              </button>
              <div className="variant-actions">
                <button
                  className="action-btn"
                  onClick={() => handleDuplicateVariant(variantKey)}
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  className="action-btn"
                  onClick={() => handlePromoteVariant(variantKey)}
                  title="Promote to Main"
                >
                  ⬆️
                </button>
                <button
                  className="action-btn danger"
                  onClick={() => handleDeleteVariant(variantKey)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary create-variant"
          onClick={handleCreateVariant}
        >
          + Create Variant
        </button>

        <div className="variant-history">
          <h4>History</h4>
          <ul>
            {variantHistory.slice(-5).map((event, i) => (
              <li key={i}>{event}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="variant-content">
        <div className="variant-header">
          <h4>Editing: {activeVariant}</h4>
          {activeVariant !== 'main' && (
            <div className="variant-comparison">
              Comparing to Main: 
              <span className="diff-count">3 differences</span>
            </div>
          )}
        </div>
        
        <StepperView
          initialSpec={getCurrentSpec()}
          onSpecChange={handleSpecChange}
          mode="explore"
        />
      </div>
    </div>
  )
}

export const CreateFirstVariant: Story = {
  name: '1. Create First Variant',
  render: () => <VariantExplorer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify main configuration is shown
    expect(canvas.getByText('Main Configuration')).toBeInTheDocument()
    expect(canvas.getByText('Editing: main')).toBeInTheDocument()
    
    // Create first variant
    const createButton = canvas.getByText('+ Create Variant')
    await userEvent.click(createButton)
    
    // Verify variant A is created
    expect(canvas.getByText('Variant A')).toBeInTheDocument()
    expect(canvas.getByText('Created Variant A')).toBeInTheDocument()
    
    // Should switch to editing Variant A
    expect(canvas.getByText('Editing: Variant A')).toBeInTheDocument()
  }
}

export const DuplicateAndModify: Story = {
  name: '2. Duplicate and Modify Variant',
  render: () => <VariantExplorer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create initial variant
    await userEvent.click(canvas.getByText('+ Create Variant'))
    
    // Duplicate Variant A
    const duplicateBtn = canvas.getAllByTitle('Duplicate')[0]
    await userEvent.click(duplicateBtn)
    
    // Verify copy is created
    expect(canvas.getByText('Variant A Copy')).toBeInTheDocument()
    expect(canvas.getByText(/Duplicated Variant A/)).toBeInTheDocument()
    
    // Switch to the copy
    await userEvent.click(canvas.getByText('Variant A Copy'))
    
    // Modify the copy (change fabric name)
    const nameInput = canvas.getByDisplayValue('compute-fabric')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'variant-compute-fabric')
    
    // Should show comparison to main
    expect(canvas.getByText('Comparing to Main:')).toBeInTheDocument()
  }
}

export const PromoteVariantToMain: Story = {
  name: '3. Promote Variant to Main',
  args: {
    initialSpec: {
      spineModelId: 'DS3000',
      leafModelId: 'DS2000'
    },
    onSpecChange: () => {},
    mode: 'guided' as const
  },
  render: () => <VariantExplorer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create and modify a variant
    await userEvent.click(canvas.getByText('+ Create Variant'))
    
    const nameInput = canvas.getByDisplayValue('compute-fabric')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'optimized-fabric')
    
    // Promote variant to main
    const promoteBtn = canvas.getByTitle('Promote to Main')
    await userEvent.click(promoteBtn)
    
    // Verify promotion
    expect(canvas.getByText('Promoted Variant A to Main')).toBeInTheDocument()
    expect(canvas.getByText('Editing: main')).toBeInTheDocument()
    
    // Main should now have the variant's changes
    expect(canvas.getByDisplayValue('optimized-fabric')).toBeInTheDocument()
  }
}

export const MultipleVariantComparison: Story = {
  name: '4. Compare Multiple Variants',
  args: {
    initialSpec: {
      spineModelId: 'DS3000',
      leafModelId: 'DS2000'
    },
    onSpecChange: () => {},
    mode: 'guided' as const
  },
  render: () => {
    const [variants] = useState({
      'Variant A': applyHPDCTemplate('hpdc-compute-small', {
        name: 'compute-optimized',
        endpointCount: 64
      }),
      'Variant B': applyHPDCTemplate('hpdc-compute-small', {
        name: 'compute-balanced',
        endpointCount: 48,
        uplinksPerLeaf: 8
      }),
      'Variant C': applyHPDCTemplate('hpdc-storage-medium', {
        name: 'storage-variant',
        endpointCount: 100
      })
    })
    
    const [selectedVariants, setSelectedVariants] = useState<string[]>([])
    
    return (
      <div className="variant-comparison-view">
        <h3>Variant Comparison</h3>
        
        <div className="variant-selector">
          {Object.keys(variants).map(key => (
            <label key={key} className="variant-checkbox">
              <input
                type="checkbox"
                checked={selectedVariants.includes(key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedVariants([...selectedVariants, key])
                  } else {
                    setSelectedVariants(selectedVariants.filter(v => v !== key))
                  }
                }}
              />
              {key}
            </label>
          ))}
        </div>
        
        {selectedVariants.length >= 2 && (
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Property</th>
                {selectedVariants.map(v => <th key={v}>{v}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Name</td>
                {selectedVariants.map(v => (
                  <td key={v}>{variants[v as keyof typeof variants].name}</td>
                ))}
              </tr>
              <tr>
                <td>Endpoints</td>
                {selectedVariants.map(v => (
                  <td key={v}>{variants[v as keyof typeof variants].endpointCount}</td>
                ))}
              </tr>
              <tr>
                <td>Uplinks/Leaf</td>
                {selectedVariants.map(v => (
                  <td key={v}>{variants[v as keyof typeof variants].uplinksPerLeaf}</td>
                ))}
              </tr>
              <tr>
                <td>Template</td>
                {selectedVariants.map(v => (
                  <td key={v}>
                    {v === 'Variant C' ? 'Storage' : 'Compute'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Select two variants for comparison
    const checkboxes = canvas.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0]) // Variant A
    await userEvent.click(checkboxes[1]) // Variant B
    
    // Verify comparison table
    expect(canvas.getByText('compute-optimized')).toBeInTheDocument()
    expect(canvas.getByText('compute-balanced')).toBeInTheDocument()
    expect(canvas.getByText('64')).toBeInTheDocument() // Variant A endpoints
    expect(canvas.getByText('48')).toBeInTheDocument() // Variant B endpoints
  }
}

export const VariantBranchingScenario: Story = {
  name: '5. Variant Branching Workflow',
  args: {
    mode: 'guided' as const,
    onSpecChange: () => {}
  },
  render: () => <VariantExplorer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create base variant
    await userEvent.click(canvas.getByText('+ Create Variant'))
    expect(canvas.getByText('Variant A')).toBeInTheDocument()
    
    // Create branch from Variant A
    const duplicateA = canvas.getAllByTitle('Duplicate')[0]
    await userEvent.click(duplicateA)
    expect(canvas.getByText('Variant A Copy')).toBeInTheDocument()
    
    // Create another variant from main
    await userEvent.click(canvas.getByText('Main Configuration'))
    await userEvent.click(canvas.getByText('+ Create Variant'))
    expect(canvas.getByText('Variant B')).toBeInTheDocument()
    
    // Now we have: Main, Variant A, Variant A Copy, Variant B
    const allVariants = canvas.getAllByText(/^Variant/)
    expect(allVariants.length).toBe(3)
    
    // History should show all operations
    expect(canvas.getByText('Created Variant A')).toBeInTheDocument()
    expect(canvas.getByText(/Duplicated Variant A/)).toBeInTheDocument()
    expect(canvas.getByText('Created Variant B')).toBeInTheDocument()
  }
}

export const DeleteVariantCleanup: Story = {
  name: '6. Delete Variant Cleanup',
  args: {
    mode: 'guided' as const,
    onSpecChange: () => {}
  },
  render: () => <VariantExplorer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Create multiple variants
    await userEvent.click(canvas.getByText('+ Create Variant'))
    await userEvent.click(canvas.getByText('+ Create Variant'))
    await userEvent.click(canvas.getByText('+ Create Variant'))
    
    // Should have 3 variants
    expect(canvas.getByText('Variant A')).toBeInTheDocument()
    expect(canvas.getByText('Variant B')).toBeInTheDocument()
    expect(canvas.getByText('Variant C')).toBeInTheDocument()
    
    // Delete Variant B
    const deleteButtons = canvas.getAllByTitle('Delete')
    await userEvent.click(deleteButtons[1]) // Delete Variant B
    
    // Variant B should be gone
    expect(canvas.queryByText('Variant B')).not.toBeInTheDocument()
    expect(canvas.getByText('Deleted Variant B')).toBeInTheDocument()
    
    // Should still have A and C
    expect(canvas.getByText('Variant A')).toBeInTheDocument()
    expect(canvas.getByText('Variant C')).toBeInTheDocument()
  }
}