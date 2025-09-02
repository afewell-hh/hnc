import React, { useState } from 'react'
import { useUserMode } from '../contexts/UserModeContext'
import { ExplainTooltip, ExplainButton } from './ExplainTooltip'
import { InlineGuidance } from './GuidedTips'
import { FieldWithProvenance, ProvenanceEntry } from './ExpertProvenance'

interface CreateFabricFormProps {
  onCreateFabric: (name: string) => void
  onCancel: () => void
  isCreating: boolean
  existingFabrics?: string[]
  suggestedNames?: string[]
  validationRules?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    forbiddenNames?: string[]
  }
}

export function CreateFabricForm({ 
  onCreateFabric, 
  onCancel, 
  isCreating,
  existingFabrics = [],
  suggestedNames = [],
  validationRules = {}
}: CreateFabricFormProps) {
  const [newFabricName, setNewFabricName] = useState('')
  const [validationError, setValidationError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { isGuided, isExpert } = useUserMode()

  const validateName = (name: string): string => {
    const trimmed = name.trim()
    const { minLength = 2, maxLength = 50, pattern, forbiddenNames = [] } = validationRules

    if (!trimmed) {
      return 'Fabric name is required'
    }
    if (trimmed.length < minLength) {
      return `Fabric name must be at least ${minLength} characters`
    }
    if (trimmed.length > maxLength) {
      return `Fabric name must be no more than ${maxLength} characters`
    }
    if (existingFabrics.includes(trimmed)) {
      return 'A fabric with this name already exists'
    }
    if (forbiddenNames.includes(trimmed.toLowerCase())) {
      return 'This name is reserved and cannot be used'
    }
    if (pattern && !pattern.test(trimmed)) {
      return 'Fabric name contains invalid characters'
    }
    return ''
  }

  const handleNameChange = (value: string) => {
    setNewFabricName(value)
    const error = validateName(value)
    setValidationError(error)
  }

  const handleCreate = () => {
    const trimmed = newFabricName.trim()
    const error = validateName(trimmed)
    
    if (!error) {
      onCreateFabric(trimmed)
      setNewFabricName('')
      setValidationError('')
    } else {
      setValidationError(error)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setNewFabricName(suggestion)
    setValidationError('')
    setShowSuggestions(false)
  }

  // Mock provenance data for expert mode
  const mockProvenance: ProvenanceEntry[] = [
    {
      id: 'fabric-name-1',
      field: 'fabricName',
      value: newFabricName,
      source: 'user',
      timestamp: new Date(),
      reason: 'User input via form field'
    }
  ]

  const containerStyles: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    position: 'relative'
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937'
  }

  const fieldGroupStyles: React.CSSProperties = {
    marginBottom: '20px'
  }

  const labelStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  }

  const inputStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    padding: '8px 12px',
    border: `1px solid ${validationError ? '#ef4444' : '#d1d5db'}`,
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: isCreating ? '#f9fafb' : 'white',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  }

  const errorStyles: React.CSSProperties = {
    color: '#ef4444',
    fontSize: '13px',
    marginTop: '4px',
    fontWeight: '500'
  }

  const buttonGroupStyles: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '20px'
  }

  const primaryButtonStyles: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: validationError || !newFabricName.trim() || isCreating ? '#9ca3af' : '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: validationError || !newFabricName.trim() || isCreating ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s ease'
  }

  const secondaryButtonStyles: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: isCreating ? 'not-allowed' : 'pointer',
    transition: 'colors 0.2s ease'
  }

  const suggestionStyles: React.CSSProperties = {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '12px'
  }

  const suggestionButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '12px',
    marginRight: '8px'
  }

  return (
    <div 
      style={containerStyles}
      data-testid="create-fabric-form"
      data-user-mode={isGuided ? 'guided' : 'expert'}
    >
      <div style={headerStyles}>
        <span>🏗️</span>
        <span>Create New Fabric</span>
        <ExplainButton
          explanation="A fabric represents a complete network topology with switches, servers, and their connections. Each fabric operates independently and can have its own configuration."
          title="What is a fabric?"
          variant="info"
        />
      </div>

      <InlineGuidance
        tip="Start by choosing a descriptive name for your fabric. Good names help identify the purpose or location, like 'datacenter-east' or 'dev-cluster'."
        variant="tip"
      >
        <div style={fieldGroupStyles}>
          <label style={labelStyles} htmlFor="fabric-name-input">
            <span>Fabric Name</span>
            <ExplainButton
              explanation="The fabric name uniquely identifies this network configuration. It should be descriptive and follow your organization's naming conventions."
              title="Naming best practices"
            />
          </label>
          
          <FieldWithProvenance
            fieldName="fabricName"
            provenance={mockProvenance}
            currentValue={newFabricName}
          >
            <ExplainTooltip
              explanation="Enter a unique name for your fabric. This name will be used to identify the fabric in lists and configurations."
              position="bottom"
            >
              <input
                id="fabric-name-input"
                type="text"
                placeholder="e.g., production-west, dev-cluster, lab-01"
                value={newFabricName}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !validationError && newFabricName.trim()) {
                    handleCreate()
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                style={inputStyles}
                autoFocus
                disabled={isCreating}
                data-testid="fabric-name-input"
                data-tip-target="fabric-name"
                aria-describedby={validationError ? 'fabric-name-error' : undefined}
              />
            </ExplainTooltip>
          </FieldWithProvenance>
          
          {validationError && (
            <div 
              style={errorStyles}
              id="fabric-name-error"
              data-testid="validation-error"
              role="alert"
            >
              {validationError}
            </div>
          )}

          {showSuggestions && suggestedNames.length > 0 && !newFabricName && (
            <div style={suggestionStyles} data-testid="name-suggestions">
              <div style={{ marginBottom: '4px', fontWeight: '500' }}>Suggested names:</div>
              {suggestedNames.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  style={suggestionButtonStyles}
                  onClick={() => handleSuggestionClick(suggestion)}
                  data-testid={`suggestion-${index}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </InlineGuidance>

      <div style={buttonGroupStyles}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!!validationError || !newFabricName.trim() || isCreating}
          style={primaryButtonStyles}
          data-testid="create-button"
        >
          {isCreating ? 'Creating...' : 'Create Fabric'}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
          style={secondaryButtonStyles}
          data-testid="cancel-button"
        >
          Cancel
        </button>

        {isExpert && existingFabrics.length > 0 && (
          <div style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
            {existingFabrics.length} existing fabric{existingFabrics.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}