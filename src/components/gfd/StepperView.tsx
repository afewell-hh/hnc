/**
 * StepperView Component - WP-GFD1
 * Progressive stepper interface for guided fabric design
 */

import React, { useState, useCallback } from 'react'
import type { FabricSpec } from '../../fabric.types'
import ExternalLinkEditor from './ExternalLinkEditor'
import TabbedStepper from './TabbedStepper'
import type { ExternalLink, BorderCapabilities } from '../../domain/external-link'
import type { BorderValidation } from '../../domain/border-validation'
import { useStepValidation, StepValidationState } from '../../hooks/useStepValidation'
import { ValidationIssue } from './StatusBadge'

export interface StepperViewProps {
  initialSpec?: FabricSpec
  onSpecChange: (spec: FabricSpec) => void
  mode: 'guided' | 'explore'
  navigationMode?: 'stepper' | 'tabs' | 'both'
  showBadges?: boolean
}

export interface StepConfig {
  id: string
  label: string
  description: string
  status: 'pending' | 'current' | 'completed' | 'error'
  hasWarning?: boolean
}

const DEFAULT_STEPS: StepConfig[] = [
  {
    id: 'basics',
    label: 'Fabric Basics',
    description: 'Name and description',
    status: 'current'
  },
  {
    id: 'endpoints',
    label: 'Endpoints',
    description: 'Server profiles and counts',
    status: 'pending'
  },
  {
    id: 'leaf-classes',
    label: 'Leaf Classes',
    description: 'Configure leaf switch classes',
    status: 'pending'
  },
  {
    id: 'spine-select',
    label: 'Spine Selection',
    description: 'Choose spine model and count',
    status: 'pending'
  },
  {
    id: 'external',
    label: 'External Connectivity',
    description: 'Border links and peering',
    status: 'pending'
  },
  {
    id: 'preview',
    label: 'Preview & Save',
    description: 'Review and generate configuration',
    status: 'pending'
  }
]

const StepperView: React.FC<StepperViewProps> = ({
  initialSpec,
  onSpecChange,
  mode,
  navigationMode = 'stepper',
  showBadges = true
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [steps, setSteps] = useState<StepConfig[]>(DEFAULT_STEPS)
  const [fabricSpec, setFabricSpec] = useState<ExtendedFabricSpec>(
    (initialSpec as ExtendedFabricSpec) || createDefaultSpec()
  )
  const [variants, setVariants] = useState<Record<string, ExtendedFabricSpec>>({})
  const [activeVariant, setActiveVariant] = useState<string>('main')
  
  // Validation hook for tabbed navigation
  const stepIds = ['basics', 'endpoints', 'leaf-classes', 'spine-select', 'external', 'preview']
  const {
    validationState,
    updateStepValidation,
    hasErrors,
    saveBlocked
  } = useStepValidation(stepIds)

  const handleStepChange = useCallback((index: number) => {
    if (mode === 'explore' || index <= currentStepIndex + 1) {
      setCurrentStepIndex(index)
      
      // Update step statuses
      const updatedSteps = steps.map((step, i) => ({
        ...step,
        status: i < index ? 'completed' : 
                i === index ? 'current' : 
                'pending'
      } as StepConfig))
      setSteps(updatedSteps)
    }
  }, [currentStepIndex, steps, mode])

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      handleStepChange(currentStepIndex + 1)
    }
  }, [currentStepIndex, steps.length, handleStepChange])

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      handleStepChange(currentStepIndex - 1)
    }
  }, [currentStepIndex, handleStepChange])

  const handleSpecUpdate = useCallback((updates: Partial<ExtendedFabricSpec>) => {
    const updatedSpec = { ...fabricSpec, ...updates }
    setFabricSpec(updatedSpec)
    onSpecChange(updatedSpec as FabricSpec)
    
    // Update validation based on spec changes
    validateSpecForCurrentStep(updatedSpec, steps[currentStepIndex].id)
    
    if (mode === 'explore' && activeVariant !== 'main') {
      setVariants(prev => ({
        ...prev,
        [activeVariant]: updatedSpec
      }))
    }
  }, [fabricSpec, onSpecChange, mode, activeVariant, currentStepIndex, steps])

  // Validation helper
  const validateSpecForCurrentStep = useCallback((spec: ExtendedFabricSpec, stepId: string) => {
    const issues: ValidationIssue[] = []
    
    switch (stepId) {
      case 'basics':
        if (!spec.name || spec.name.trim() === '') {
          issues.push({ type: 'error', message: 'Fabric name is required' })
        }
        break
      case 'endpoints':
        if (!spec.endpointCount || spec.endpointCount <= 0) {
          issues.push({ type: 'error', message: 'Endpoint count must be greater than 0' })
        }
        break
      case 'external':
        if (!spec.externalLinks || spec.externalLinks.length === 0) {
          issues.push({ type: 'warning', message: 'No external links configured' })
        }
        break
    }
    
    updateStepValidation(stepId, issues, true)
  }, [updateStepValidation])

  const handleCreateVariant = useCallback(() => {
    const variantName = `Variant ${String.fromCharCode(65 + Object.keys(variants).length)}`
    const newVariant = { ...fabricSpec }
    setVariants(prev => ({
      ...prev,
      [variantName]: newVariant
    }))
    setActiveVariant(variantName)
    return variantName
  }, [fabricSpec, variants])

  const handleDuplicateVariant = useCallback((variantKey: string) => {
    const source = variants[variantKey] || fabricSpec
    const newName = `${variantKey} Copy`
    setVariants(prev => ({
      ...prev,
      [newName]: { ...source }
    }))
    return newName
  }, [variants, fabricSpec])

  const handlePromoteVariant = useCallback((variantKey: string) => {
    const variantSpec = variants[variantKey]
    if (variantSpec) {
      setFabricSpec(variantSpec)
      onSpecChange(variantSpec)
      setActiveVariant('main')
    }
  }, [variants, onSpecChange])

  const renderStepIndicator = () => (
    <div className="stepper-indicator">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`step-item ${step.status} ${step.hasWarning ? 'warning' : ''}`}
          onClick={() => handleStepChange(index)}
        >
          <div className="step-number">
            {step.status === 'completed' ? '✓' : 
             step.status === 'error' ? '✖' :
             step.hasWarning ? '!' :
             index + 1}
          </div>
          <div className="step-info">
            <div className="step-label">{step.label}</div>
            <div className="step-description">{step.description}</div>
          </div>
          {index < steps.length - 1 && (
            <div className="step-connector" />
          )}
        </div>
      ))}
    </div>
  )

  const renderStepContent = () => {
    const currentStep = steps[currentStepIndex]
    
    switch (currentStep.id) {
      case 'basics':
        return (
          <FabricBasicsStep
            spec={fabricSpec}
            onUpdate={handleSpecUpdate}
          />
        )
      case 'endpoints':
        return (
          <EndpointsStep
            spec={fabricSpec}
            onUpdate={handleSpecUpdate}
          />
        )
      case 'leaf-classes':
        return (
          <LeafClassesStep
            spec={fabricSpec}
            onUpdate={handleSpecUpdate}
          />
        )
      case 'spine-select':
        return (
          <SpineSelectionStep
            spec={fabricSpec}
            onUpdate={handleSpecUpdate}
          />
        )
      case 'external':
        return (
          <ExternalConnectivityStep
            spec={fabricSpec}
            onUpdate={handleSpecUpdate}
          />
        )
      case 'preview':
        return (
          <PreviewStep
            spec={fabricSpec}
            onPromote={() => {}}
          />
        )
      default:
        return <div>Unknown step</div>
    }
  }

  const renderVariantControls = () => {
    if (mode !== 'explore') return null

    return (
      <div className="variant-controls">
        <h4>Variants</h4>
        <div className="variant-list">
          <button
            className={`variant-item ${activeVariant === 'main' ? 'active' : ''}`}
            onClick={() => setActiveVariant('main')}
          >
            Main Configuration
          </button>
          {Object.keys(variants).map(variantKey => (
            <div key={variantKey} className="variant-item-wrapper">
              <button
                className={`variant-item ${activeVariant === variantKey ? 'active' : ''}`}
                onClick={() => setActiveVariant(variantKey)}
              >
                {variantKey}
              </button>
              <button
                className="variant-action"
                onClick={() => handleDuplicateVariant(variantKey)}
                title="Duplicate"
              >
                📋
              </button>
              <button
                className="variant-action"
                onClick={() => handlePromoteVariant(variantKey)}
                title="Promote to Main"
              >
                ⬆️
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleCreateVariant}
        >
          + Add Variant
        </button>
      </div>
    )
  }

  // Render based on navigation mode
  if (navigationMode === 'tabs') {
    return (
      <div className="stepper-view tabbed-mode">
        <TabbedStepper
          currentStep={currentStepIndex}
          stepValidations={validationState}
          onStepChange={setCurrentStepIndex}
          onSave={() => console.log('Save draft')}
          onPromote={() => console.log('Promote to production')}
          saveBlocked={saveBlocked}
          showSaveActions={true}
        >
          {renderStepContent()}
        </TabbedStepper>
        {renderVariantControls()}
      </div>
    )
  }

  // Default stepper mode
  return (
    <div className="stepper-view stepper-mode">
      <div className="stepper-header">
        <h2>Fabric Designer</h2>
        <div className="mode-badge">{mode === 'guided' ? 'Guided' : 'Explore'}</div>
      </div>

      {renderStepIndicator()}
      
      <div className="stepper-content">
        {renderStepContent()}
      </div>

      <div className="stepper-actions">
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
        >
          Previous
        </button>
        <button
          className="btn btn-primary"
          onClick={handleNext}
          disabled={currentStepIndex === steps.length - 1}
        >
          Next
        </button>
      </div>

      {renderVariantControls()}
    </div>
  )
}

// Step Components (placeholders for now)
const FabricBasicsStep: React.FC<any> = ({ spec, onUpdate }) => (
  <div className="step-content">
    <h3>Fabric Basics</h3>
    <div className="form-group">
      <label>Fabric Name</label>
      <input
        type="text"
        value={spec.name || ''}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="my-fabric"
      />
    </div>
    <div className="form-group">
      <label>Description</label>
      <textarea
        value={spec.description || ''}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Production data center fabric"
      />
    </div>
  </div>
)

const EndpointsStep: React.FC<any> = ({ spec, onUpdate }) => (
  <div className="step-content">
    <h3>Endpoint Configuration</h3>
    <p>Configure server profiles and counts...</p>
  </div>
)

const LeafClassesStep: React.FC<any> = ({ spec, onUpdate }) => (
  <div className="step-content">
    <h3>Leaf Classes</h3>
    <p>Configure leaf switch classes...</p>
  </div>
)

const SpineSelectionStep: React.FC<any> = ({ spec, onUpdate }) => (
  <div className="step-content">
    <h3>Spine Selection</h3>
    <p>Choose spine model and count...</p>
  </div>
)

const ExternalConnectivityStep: React.FC<any> = ({ spec, onUpdate }) => {
  const handleExternalLinksChange = (externalLinks: ExternalLink[]) => {
    onUpdate({ externalLinks })
  }

  const handleValidationChange = (validation: BorderValidation) => {
    // Could store validation state for blocking save if needed
    console.log('External validation:', validation)
  }

  return (
    <div className="step-content">
      <ExternalLinkEditor
        externalLinks={spec.externalLinks || []}
        onLinksChange={handleExternalLinksChange}
        spineCount={spec.spineCount}
        borderCapabilities={spec.borderCapabilities}
        mode="guided"
        onValidationChange={handleValidationChange}
      />
    </div>
  )
}

const PreviewStep: React.FC<any> = ({ spec, onPromote }) => (
  <div className="step-content">
    <h3>Preview Configuration</h3>
    <p>Review and save your fabric configuration...</p>
  </div>
)

// Extended fabric spec with external connectivity support
interface ExtendedFabricSpec extends FabricSpec {
  name?: string
  spineModelId?: string
  leafModelId?: string
  uplinksPerLeaf?: number
  endpointCount?: number
  spineCount?: number
  endpointProfile?: any
  externalLinks?: ExternalLink[]
  borderCapabilities?: BorderCapabilities
}

function createDefaultSpec(): ExtendedFabricSpec {
  return {
    metadata: { name: 'default-fabric' },
    spec: {
      switches: [],
      servers: [],
      connections: []
    },
    name: '',
    spineModelId: '',
    leafModelId: '',
    uplinksPerLeaf: 4,
    endpointCount: 0,
    endpointProfile: {
      name: '',
      portsPerEndpoint: 1,
      count: 0
    },
    externalLinks: []
  }
}

export default StepperView