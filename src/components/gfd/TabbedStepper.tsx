/**
 * TabbedStepper Component - WP-NAV1
 * Main tabbed navigation component that mirrors stepper workflow
 */

import React, { useState, useCallback, useMemo, useRef } from 'react'
import StepTab, { TabConfiguration, StepValidation } from './StepTab'
import StatusBadge, { ValidationBadge, ValidationIssue } from './StatusBadge'
import useStepValidation, { StepValidationState } from '../../hooks/useStepValidation'

export interface TabbedStepperProps {
  currentStep: number
  stepValidations?: StepValidationState
  onStepChange: (step: number) => void
  onSave?: () => void
  onPromote?: () => void
  saveBlocked?: boolean
  promoteBlocked?: boolean
  showSaveActions?: boolean
  className?: string
  children?: React.ReactNode
}

const STEP_TABS: TabConfiguration[] = [
  { 
    id: 'templates', 
    label: 'Templates', 
    stepNumber: 1, 
    description: 'Switch models & basic config',
    accessible: true 
  },
  { 
    id: 'endpoints', 
    label: 'Endpoints', 
    stepNumber: 2, 
    description: 'Server profiles & counts',
    accessible: true 
  },
  { 
    id: 'externals', 
    label: 'Externals', 
    stepNumber: 3, 
    description: 'Border links & peering',
    accessible: true 
  },
  { 
    id: 'topology', 
    label: 'Topology', 
    stepNumber: 4, 
    description: 'Compute & optimize layout',
    accessible: true 
  },
  { 
    id: 'review', 
    label: 'Review', 
    stepNumber: 5, 
    description: 'Validate & preview config',
    accessible: true 
  },
  { 
    id: 'deploy', 
    label: 'Deploy', 
    stepNumber: 6, 
    description: 'Save & generate artifacts',
    accessible: true 
  }
]

const TabbedStepper: React.FC<TabbedStepperProps> = ({
  currentStep,
  stepValidations = {},
  onStepChange,
  onSave,
  onPromote,
  saveBlocked = false,
  promoteBlocked = false,
  showSaveActions = true,
  className = '',
  children
}) => {
  const tabListRef = useRef<HTMLDivElement>(null)
  
  const stepIds = useMemo(() => STEP_TABS.map(tab => tab.id), [])
  
  const {
    validationState,
    hasErrors,
    hasWarnings,
    validationSummary,
    saveBlocked: validationSaveBlocked
  } = useStepValidation(stepIds, {
    initialValidations: stepValidations
  })

  const isSaveBlocked = saveBlocked || validationSaveBlocked
  const isPromoteBlocked = promoteBlocked || validationSaveBlocked

  // Handle tab click
  const handleTabClick = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STEP_TABS.length) {
      onStepChange(stepIndex)
    }
  }, [onStepChange])

  // Handle keyboard navigation
  const handleTabListKeyDown = useCallback((e: React.KeyboardEvent) => {
    const { key } = e
    const currentIndex = Math.max(0, Math.min(currentStep, STEP_TABS.length - 1))
    
    let newIndex = currentIndex
    
    switch (key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : STEP_TABS.length - 1
        break
      case 'ArrowRight':
        newIndex = currentIndex < STEP_TABS.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        newIndex = 0
        break
      case 'End':
        newIndex = STEP_TABS.length - 1
        break
      default:
        return
    }
    
    e.preventDefault()
    handleTabClick(newIndex)
    
    // Focus the new tab
    const tabElement = tabListRef.current?.children[newIndex] as HTMLElement
    tabElement?.focus()
  }, [currentStep, handleTabClick])

  // Get validation state for a tab
  const getTabValidation = useCallback((tab: TabConfiguration): StepValidation => {
    return validationState[tab.id] || {
      stepId: tab.id,
      badge: 'pending' as ValidationBadge,
      issues: [],
      hasChanged: false
    }
  }, [validationState])

  // Render validation summary
  const renderValidationSummary = () => {
    if (!hasErrors && !hasWarnings) {
      return (
        <div className="validation-summary validation-success" role="status">
          <StatusBadge badge="ok" size="sm" showTooltip={false} />
          <span>All steps validated successfully</span>
        </div>
      )
    }

    return (
      <div className="validation-summary validation-issues" role="alert">
        <div className="summary-badges">
          {hasErrors && (
            <div className="summary-badge-item">
              <StatusBadge badge="error" size="sm" showTooltip={false} />
              <span>{validationSummary.errorSteps} errors</span>
            </div>
          )}
          {hasWarnings && (
            <div className="summary-badge-item">
              <StatusBadge badge="warning" size="sm" showTooltip={false} />
              <span>{validationSummary.warningSteps} warnings</span>
            </div>
          )}
        </div>
        {isSaveBlocked && (
          <div className="save-blocked-notice">
            <span>⚠ Errors must be resolved before saving</span>
          </div>
        )}
      </div>
    )
  }

  // Render action buttons
  const renderActionButtons = () => {
    if (!showSaveActions) return null

    return (
      <div className="stepper-actions">
        <button
          className={`btn btn-secondary ${isSaveBlocked ? 'btn-disabled' : ''}`}
          onClick={onSave}
          disabled={isSaveBlocked || !onSave}
          aria-describedby="save-status"
        >
          Save Draft
        </button>
        
        <button
          className={`btn btn-primary ${isPromoteBlocked ? 'btn-disabled' : ''}`}
          onClick={onPromote}
          disabled={isPromoteBlocked || !onPromote}
          aria-describedby="promote-status"
        >
          Promote to Production
        </button>

        <div className="action-status" id="save-status" aria-live="polite">
          {isSaveBlocked && (
            <span className="status-message error">
              Resolve errors before saving
            </span>
          )}
        </div>
        
        <div className="action-status" id="promote-status" aria-live="polite">
          {isPromoteBlocked && (
            <span className="status-message error">
              Resolve errors before promoting
            </span>
          )}
        </div>
      </div>
    )
  }

  const wrapperClasses = [
    'tabbed-stepper',
    hasErrors ? 'has-errors' : '',
    hasWarnings ? 'has-warnings' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClasses}>
      <div className="stepper-header">
        <h2>Fabric Designer</h2>
        {renderValidationSummary()}
      </div>

      <div 
        className="tab-list" 
        role="tablist"
        aria-label="Fabric design steps"
        onKeyDown={handleTabListKeyDown}
        ref={tabListRef}
      >
        {STEP_TABS.map((tab, index) => (
          <StepTab
            key={tab.id}
            tab={tab}
            isActive={index === currentStep}
            validationState={getTabValidation(tab)}
            onClick={() => handleTabClick(index)}
          />
        ))}
      </div>

      <div className="tab-content">
        <div
          className="tab-panel active"
          role="tabpanel"
          id={`step-panel-${STEP_TABS[currentStep]?.id}`}
          aria-labelledby={`step-tab-${STEP_TABS[currentStep]?.id}`}
        >
          {children}
        </div>
      </div>

      {renderActionButtons()}
    </div>
  )
}

export default TabbedStepper