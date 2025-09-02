/**
 * GFD Template HPDC Stories - WP-GFD1
 * Demonstrates HPDC template selection and application
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import React, { useState } from 'react'
import StepperView from '../components/gfd/StepperView'
import { HPDC_TEMPLATES, applyHPDCTemplate } from '../templates/hpdc-defaults'
import type { FabricSpec } from '../app.state'

const meta = {
  title: 'GFD/TemplateHPDC',
  component: StepperView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'HPDC template selection and configuration - WP-GFD1'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof StepperView>

export default meta
type Story = StoryObj<typeof meta>

// Template selector component for story
const TemplateSelector: React.FC<{
  onSelect: (templateId: string) => void
}> = ({ onSelect }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  
  return (
    <div className="template-selector">
      <h3>Select HPDC Template</h3>
      <div className="template-grid">
        {Object.values(HPDC_TEMPLATES).map(template => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedTemplate(template.id)
              onSelect(template.id)
            }}
          >
            <h4>{template.name}</h4>
            <p className="template-category">{template.category}</p>
            <p className="template-description">{template.description}</p>
            <div className="template-specs">
              <div>Endpoints: {template.recommended.endpoints.minCount}-{template.recommended.endpoints.maxCount}</div>
              <div>Spines: {template.recommended.spines.recommendedCount}</div>
              <div>Bandwidth: {template.recommended.external.typicalBandwidthGbps} Gbps</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Story wrapper with template selection
const StepperWithTemplate: React.FC = () => {
  const [fabricSpec, setFabricSpec] = useState<FabricSpec | null>(null)
  const [showStepper, setShowStepper] = useState(false)

  const handleTemplateSelect = (templateId: string) => {
    const spec = applyHPDCTemplate(templateId)
    setFabricSpec(spec)
    setShowStepper(true)
  }

  if (!showStepper || !fabricSpec) {
    return <TemplateSelector onSelect={handleTemplateSelect} />
  }

  return (
    <StepperView
      initialSpec={fabricSpec}
      onSpecChange={setFabricSpec}
      mode="guided"
    />
  )
}

export const SelectComputeTemplate: Story = {
  name: '1. Select Compute Template',
  render: () => <StepperWithTemplate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify templates are displayed
    expect(canvas.getByText('Select HPDC Template')).toBeInTheDocument()
    expect(canvas.getByText('Small Compute Cluster')).toBeInTheDocument()
    expect(canvas.getByText('Medium Storage Cluster')).toBeInTheDocument()
    expect(canvas.getByText('AI/GPU Training Cluster')).toBeInTheDocument()
    expect(canvas.getByText('Large Mixed Workload')).toBeInTheDocument()
    
    // Select compute template
    const computeCard = canvas.getByText('Small Compute Cluster').closest('.template-card')
    if (computeCard) {
      await userEvent.click(computeCard)
      
      // Should transition to stepper
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify stepper is shown with template values
      expect(canvas.getByText('Fabric Designer')).toBeInTheDocument()
      expect(canvas.getByDisplayValue('compute-fabric')).toBeInTheDocument()
    }
  }
}

export const ApplyStorageTemplate: Story = {
  name: '2. Apply Storage Template',
  args: {
    initialSpec: applyHPDCTemplate('hpdc-storage-medium'),
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify storage template is applied
    expect(canvas.getByDisplayValue('storage-fabric')).toBeInTheDocument()
    
    // Navigate through steps
    const nextButton = canvas.getByText('Next')
    
    // Move to endpoints step
    await userEvent.click(nextButton)
    expect(canvas.getByText('Endpoint Configuration')).toBeInTheDocument()
    
    // Verify storage profile recommendations
    expect(canvas.getByText(/storage nodes/i)).toBeInTheDocument()
  }
}

export const GPUTemplateWithCustomization: Story = {
  name: '3. GPU Template with Customization',
  args: {
    initialSpec: applyHPDCTemplate('hpdc-ai-gpu', {
      name: 'ml-training-fabric',
      endpointCount: 96 // Custom GPU server count
    }),
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify customized GPU template
    expect(canvas.getByDisplayValue('ml-training-fabric')).toBeInTheDocument()
    
    // Check GPU-specific recommendations
    const nextButton = canvas.getByText('Next')
    await userEvent.click(nextButton)
    
    // Should show GPU profile with 8x100G NICs
    expect(canvas.getByText(/GPU servers/i)).toBeInTheDocument()
    
    // Move to spine selection
    await userEvent.click(nextButton)
    await userEvent.click(nextButton)
    
    // Verify high spine count for GPU fabric
    expect(canvas.getByText('Spine Selection')).toBeInTheDocument()
    expect(canvas.getByText(/8 spines recommended/i)).toBeInTheDocument()
  }
}

export const TemplateValidationWarnings: Story = {
  name: '4. Template Validation Warnings',
  args: {
    initialSpec: applyHPDCTemplate('hpdc-compute-small', {
      endpointCount: 200, // Exceeds template recommendation
      uplinksPerLeaf: 2   // Below HPDC best practice
    }),
    mode: 'guided'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show warnings for out-of-range values
    const warningSteps = canvas.getAllByClassName('warning')
    expect(warningSteps.length).toBeGreaterThan(0)
    
    // Hover over warning to see details
    const firstWarning = warningSteps[0]
    await userEvent.hover(firstWarning)
    
    // Tooltip should explain the issue
    expect(canvas.getByText(/Consider a larger template/i)).toBeInTheDocument()
    expect(canvas.getByText(/Use at least 4 uplinks/i)).toBeInTheDocument()
  }
}

export const MixedWorkloadTemplate: Story = {
  name: '5. Mixed Workload Multi-Profile',
  args: {
    initialSpec: applyHPDCTemplate('hpdc-mixed-large'),
    mode: 'explore' // Allow jumping between steps
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // In explore mode, can click any step
    const leafClassStep = canvas.getByText('Leaf Classes').closest('.step-item')
    if (leafClassStep) {
      await userEvent.click(leafClassStep)
      
      // Should jump directly to leaf classes
      expect(canvas.getByText(/Configure leaf switch classes/i)).toBeInTheDocument()
    }
    
    // Mixed template should suggest multiple profiles
    const endpointStep = canvas.getByText('Endpoints').closest('.step-item')
    if (endpointStep) {
      await userEvent.click(endpointStep)
      
      // Should show multiple profile options
      expect(canvas.getByText(/general-dual-25g/i)).toBeInTheDocument()
      expect(canvas.getByText(/database-dual-100g/i)).toBeInTheDocument()
      expect(canvas.getByText(/web-single-10g/i)).toBeInTheDocument()
    }
  }
}

export const TemplateComparisonView: Story = {
  name: '6. Template Comparison',
  render: () => {
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
    
    const toggleTemplate = (templateId: string) => {
      setSelectedTemplates(prev => 
        prev.includes(templateId)
          ? prev.filter(id => id !== templateId)
          : [...prev, templateId].slice(0, 2) // Max 2 for comparison
      )
    }
    
    return (
      <div className="template-comparison">
        <h3>Compare HPDC Templates</h3>
        <p>Select up to 2 templates to compare</p>
        
        <div className="template-selector-compare">
          {Object.values(HPDC_TEMPLATES).map(template => (
            <label key={template.id} className="template-checkbox">
              <input
                type="checkbox"
                checked={selectedTemplates.includes(template.id)}
                onChange={() => toggleTemplate(template.id)}
                disabled={!selectedTemplates.includes(template.id) && selectedTemplates.length >= 2}
              />
              {template.name}
            </label>
          ))}
        </div>
        
        {selectedTemplates.length > 0 && (
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Attribute</th>
                  {selectedTemplates.map(id => (
                    <th key={id}>{HPDC_TEMPLATES[id].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Category</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>{HPDC_TEMPLATES[id].category}</td>
                  ))}
                </tr>
                <tr>
                  <td>Endpoint Range</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>
                      {HPDC_TEMPLATES[id].recommended.endpoints.minCount}-
                      {HPDC_TEMPLATES[id].recommended.endpoints.maxCount}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Spine Count</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>{HPDC_TEMPLATES[id].recommended.spines.recommendedCount}</td>
                  ))}
                </tr>
                <tr>
                  <td>Bandwidth</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>{HPDC_TEMPLATES[id].recommended.external.typicalBandwidthGbps} Gbps</td>
                  ))}
                </tr>
                <tr>
                  <td>Leaf Classes</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>{HPDC_TEMPLATES[id].recommended.leafClasses.count}</td>
                  ))}
                </tr>
                <tr>
                  <td>Redundancy</td>
                  {selectedTemplates.map(id => (
                    <td key={id}>{HPDC_TEMPLATES[id].recommended.spines.redundancy}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Select two templates for comparison
    const checkboxes = canvas.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0]) // Compute
    await userEvent.click(checkboxes[2]) // GPU
    
    // Verify comparison table appears
    expect(canvas.getByText('Category')).toBeInTheDocument()
    expect(canvas.getByText('compute')).toBeInTheDocument()
    expect(canvas.getByText('ai-ml')).toBeInTheDocument()
    
    // Check bandwidth difference
    expect(canvas.getByText('200 Gbps')).toBeInTheDocument()
    expect(canvas.getByText('1600 Gbps')).toBeInTheDocument()
  }
}