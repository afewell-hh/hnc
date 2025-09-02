/**
 * StepTab Component - WP-NAV1
 * Individual tab component with validation badge integration
 */

import React from 'react'
import StatusBadge, { ValidationBadge, ValidationIssue } from './StatusBadge'

export interface StepValidation {
  stepId: string
  badge: ValidationBadge
  issues: ValidationIssue[]
  hasChanged: boolean
}

export interface TabConfiguration {
  id: string
  label: string
  stepNumber: number
  description?: string
  accessible: boolean
}

export interface StepTabProps {
  tab: TabConfiguration
  isActive: boolean
  validationState: StepValidation
  onClick: () => void
  disabled?: boolean
  className?: string
}

const StepTab: React.FC<StepTabProps> = ({
  tab,
  isActive,
  validationState,
  onClick,
  disabled = false,
  className = ''
}) => {
  const handleClick = () => {
    if (!disabled && tab.accessible) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && tab.accessible) {
      e.preventDefault()
      onClick()
    }
  }

  const tabClasses = [
    'step-tab',
    isActive ? 'step-tab-active' : 'step-tab-inactive',
    !tab.accessible ? 'step-tab-disabled' : 'step-tab-enabled',
    validationState.badge === 'error' ? 'step-tab-error' : '',
    validationState.badge === 'warning' ? 'step-tab-warning' : '',
    validationState.hasChanged ? 'step-tab-changed' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={tabClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      aria-controls={`step-panel-${tab.id}`}
      aria-describedby={`step-tab-badge-${tab.id}`}
      tabIndex={isActive ? 0 : -1}
    >
      <div className="step-tab-header">
        <div className="step-tab-number">{tab.stepNumber}</div>
        <div className="step-tab-content">
          <div className="step-tab-label">{tab.label}</div>
          {tab.description && (
            <div className="step-tab-description">{tab.description}</div>
          )}
        </div>
        <div 
          className="step-tab-badge"
          id={`step-tab-badge-${tab.id}`}
          aria-live="polite"
        >
          <StatusBadge
            badge={validationState.badge}
            issues={validationState.issues}
            size="sm"
            showTooltip={true}
          />
        </div>
      </div>
      
      {isActive && (
        <div className="step-tab-indicator" aria-hidden="true" />
      )}
    </button>
  )
}

export default StepTab