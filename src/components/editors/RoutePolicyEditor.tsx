import React, { useState, useCallback } from 'react'

export interface RoutePolicyMatch {
  id: string
  type: 'prefix' | 'community' | 'as-path' | 'metric' | 'origin'
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'contains'
  value: string
}

export interface RoutePolicyAction {
  id: string
  type: 'permit' | 'deny' | 'set-metric' | 'set-community' | 'set-local-pref' | 'set-next-hop'
  value?: string
  priority: number
}

export interface RoutePolicyStatement {
  id: string
  sequenceNumber: number
  description?: string
  matches: RoutePolicyMatch[]
  actions: RoutePolicyAction[]
  enabled: boolean
}

export interface RoutePolicyConfig {
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    description?: string
    statements: RoutePolicyStatement[]
    defaultAction: 'permit' | 'deny'
  }
}

export interface RoutePolicyEditorProps {
  policy?: RoutePolicyConfig
  onChange: (policy: RoutePolicyConfig) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const RoutePolicyEditor: React.FC<RoutePolicyEditorProps> = ({
  policy,
  onChange,
  onValidate,
  readonly = false
}) => {
  const [errors, setErrors] = useState<string[]>([])
  const [expandedStatements, setExpandedStatements] = useState<Set<string>>(new Set())

  // Initialize default route policy config
  const defaultPolicy: RoutePolicyConfig = {
    metadata: {
      name: 'route-policy-1',
      labels: {},
      annotations: {}
    },
    spec: {
      description: '',
      statements: [],
      defaultAction: 'deny'
    }
  }

  const currentPolicy = policy || defaultPolicy

  const validatePolicy = useCallback((config: RoutePolicyConfig): { isValid: boolean; errors: string[] } => {
    const validationErrors: string[] = []

    // Validate metadata
    if (!config.metadata.name) {
      validationErrors.push('Route policy name is required')
    }

    // Validate statements
    const sequenceNumbers = new Set<number>()
    config.spec.statements.forEach((statement, index) => {
      if (sequenceNumbers.has(statement.sequenceNumber)) {
        validationErrors.push(`Statement ${index + 1}: Duplicate sequence number ${statement.sequenceNumber}`)
      }
      sequenceNumbers.add(statement.sequenceNumber)

      // Validate matches
      statement.matches.forEach((match, matchIndex) => {
        if (!match.value.trim()) {
          validationErrors.push(`Statement ${index + 1}, Match ${matchIndex + 1}: Value is required`)
        }

        // Validate specific match types
        if (match.type === 'prefix' && !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(match.value)) {
          validationErrors.push(`Statement ${index + 1}, Match ${matchIndex + 1}: Invalid prefix format`)
        }

        if (match.type === 'community' && !/^\d+:\d+$/.test(match.value)) {
          validationErrors.push(`Statement ${index + 1}, Match ${matchIndex + 1}: Community must be in format ASN:value`)
        }
      })

      // Validate actions
      statement.actions.forEach((action, actionIndex) => {
        if ((action.type === 'set-metric' || action.type === 'set-local-pref') && 
            (!action.value || isNaN(parseInt(action.value)))) {
          validationErrors.push(`Statement ${index + 1}, Action ${actionIndex + 1}: Numeric value is required`)
        }

        if (action.type === 'set-next-hop' && action.value && 
            !/^(\d{1,3}\.){3}\d{1,3}$/.test(action.value)) {
          validationErrors.push(`Statement ${index + 1}, Action ${actionIndex + 1}: Invalid IP address`)
        }

        if (action.type === 'set-community' && action.value && 
            !/^\d+:\d+$/.test(action.value)) {
          validationErrors.push(`Statement ${index + 1}, Action ${actionIndex + 1}: Community must be in format ASN:value`)
        }
      })
    })

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [])

  const handleChange = useCallback((updates: Partial<RoutePolicyConfig>) => {
    const newPolicy = {
      ...currentPolicy,
      ...updates,
      spec: {
        ...currentPolicy.spec,
        ...(updates.spec || {})
      },
      metadata: {
        ...currentPolicy.metadata,
        ...(updates.metadata || {})
      }
    }

    const validation = validatePolicy(newPolicy)
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    onChange(newPolicy)
  }, [currentPolicy, onChange, onValidate, validatePolicy])

  const addStatement = useCallback(() => {
    const maxSequence = Math.max(0, ...currentPolicy.spec.statements.map(s => s.sequenceNumber))
    const newStatement: RoutePolicyStatement = {
      id: `statement-${Date.now()}`,
      sequenceNumber: maxSequence + 10,
      description: '',
      matches: [],
      actions: [{
        id: `action-${Date.now()}`,
        type: 'permit',
        priority: 1
      }],
      enabled: true
    }

    handleChange({
      spec: {
        ...currentPolicy.spec,
        statements: [...currentPolicy.spec.statements, newStatement]
      }
    })

    // Auto-expand the new statement
    setExpandedStatements(prev => new Set([...prev, newStatement.id]))
  }, [currentPolicy, handleChange])

  const updateStatement = useCallback((statementId: string, updates: Partial<RoutePolicyStatement>) => {
    const statements = currentPolicy.spec.statements.map(statement =>
      statement.id === statementId ? { ...statement, ...updates } : statement
    )
    
    handleChange({
      spec: {
        ...currentPolicy.spec,
        statements
      }
    })
  }, [currentPolicy, handleChange])

  const removeStatement = useCallback((statementId: string) => {
    handleChange({
      spec: {
        ...currentPolicy.spec,
        statements: currentPolicy.spec.statements.filter(statement => statement.id !== statementId)
      }
    })

    setExpandedStatements(prev => {
      const newSet = new Set(prev)
      newSet.delete(statementId)
      return newSet
    })
  }, [currentPolicy, handleChange])

  const addMatch = useCallback((statementId: string) => {
    const newMatch: RoutePolicyMatch = {
      id: `match-${Date.now()}`,
      type: 'prefix',
      operator: 'eq',
      value: '0.0.0.0/0'
    }

    updateStatement(statementId, {
      matches: [
        ...currentPolicy.spec.statements.find(s => s.id === statementId)?.matches || [],
        newMatch
      ]
    })
  }, [currentPolicy, updateStatement])

  const updateMatch = useCallback((statementId: string, matchId: string, updates: Partial<RoutePolicyMatch>) => {
    const statement = currentPolicy.spec.statements.find(s => s.id === statementId)
    if (!statement) return

    const matches = statement.matches.map(match =>
      match.id === matchId ? { ...match, ...updates } : match
    )

    updateStatement(statementId, { matches })
  }, [currentPolicy, updateStatement])

  const removeMatch = useCallback((statementId: string, matchId: string) => {
    const statement = currentPolicy.spec.statements.find(s => s.id === statementId)
    if (!statement) return

    updateStatement(statementId, {
      matches: statement.matches.filter(match => match.id !== matchId)
    })
  }, [currentPolicy, updateStatement])

  const addAction = useCallback((statementId: string) => {
    const statement = currentPolicy.spec.statements.find(s => s.id === statementId)
    const maxPriority = Math.max(0, ...(statement?.actions.map(a => a.priority) || []))
    
    const newAction: RoutePolicyAction = {
      id: `action-${Date.now()}`,
      type: 'set-metric',
      value: '100',
      priority: maxPriority + 1
    }

    updateStatement(statementId, {
      actions: [...(statement?.actions || []), newAction]
    })
  }, [currentPolicy, updateStatement])

  const updateAction = useCallback((statementId: string, actionId: string, updates: Partial<RoutePolicyAction>) => {
    const statement = currentPolicy.spec.statements.find(s => s.id === statementId)
    if (!statement) return

    const actions = statement.actions.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    )

    updateStatement(statementId, { actions })
  }, [currentPolicy, updateStatement])

  const removeAction = useCallback((statementId: string, actionId: string) => {
    const statement = currentPolicy.spec.statements.find(s => s.id === statementId)
    if (!statement) return

    updateStatement(statementId, {
      actions: statement.actions.filter(action => action.id !== actionId)
    })
  }, [currentPolicy, updateStatement])

  const toggleStatementExpansion = useCallback((statementId: string) => {
    setExpandedStatements(prev => {
      const newSet = new Set(prev)
      if (newSet.has(statementId)) {
        newSet.delete(statementId)
      } else {
        newSet.add(statementId)
      }
      return newSet
    })
  }, [])

  return (
    <div className="route-policy-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>Route Policy Configuration</h3>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Configure route filtering and manipulation policies for BGP routing
        </p>
        
        {errors.length > 0 && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>Validation Errors:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {errors.map((error, index) => (
                <li key={index} style={{ color: '#721c24' }}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Basic Settings */}
      <div style={{ marginBottom: '30px' }}>
        <h4>Basic Settings</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <label>
              <strong>Policy Name:</strong>
              <input
                type="text"
                value={currentPolicy.metadata.name || ''}
                onChange={(e) => handleChange({
                  metadata: { ...currentPolicy.metadata, name: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="route-policy-1"
                data-testid="policy-name-input"
              />
            </label>
          </div>

          <div>
            <label>
              <strong>Default Action:</strong>
              <select
                value={currentPolicy.spec.defaultAction}
                onChange={(e) => handleChange({
                  spec: { ...currentPolicy.spec, defaultAction: e.target.value as 'permit' | 'deny' }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                data-testid="default-action-select"
              >
                <option value="permit">Permit (Allow)</option>
                <option value="deny">Deny (Block)</option>
              </select>
            </label>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              Action for routes not matching any statements
            </div>
          </div>

          <div>
            <label>
              <strong>Description:</strong>
              <input
                type="text"
                value={currentPolicy.spec.description || ''}
                onChange={(e) => handleChange({
                  spec: { ...currentPolicy.spec, description: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="Policy description"
                data-testid="policy-description-input"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Policy Statements */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4>Policy Statements</h4>
          {!readonly && (
            <button
              onClick={addStatement}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              data-testid="add-statement-button"
            >
              Add Statement
            </button>
          )}
        </div>

        {currentPolicy.spec.statements
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
          .map((statement, index) => {
            const isExpanded = expandedStatements.has(statement.id)
            
            return (
              <div key={statement.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '4px', 
                marginBottom: '15px',
                overflow: 'hidden'
              }}>
                {/* Statement Header */}
                <div 
                  style={{ 
                    padding: '15px', 
                    backgroundColor: statement.enabled ? '#f8f9fa' : '#f1f3f4',
                    borderBottom: isExpanded ? '1px solid #ddd' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleStatementExpansion(statement.id)}
                >
                  <div>
                    <h5 style={{ margin: '0 0 5px 0' }}>
                      Statement {statement.sequenceNumber}
                      {!statement.enabled && <span style={{ color: '#6c757d', fontWeight: 'normal' }}> (Disabled)</span>}
                    </h5>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      {statement.description || 'No description'}
                      • {statement.matches.length} matches • {statement.actions.length} actions
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                    {!readonly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeStatement(statement.id)
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        data-testid={`remove-statement-${statement.id}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Statement Details */}
                {isExpanded && (
                  <div style={{ padding: '20px' }}>
                    {/* Statement Settings */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                      <div>
                        <label>
                          <strong>Sequence Number:</strong>
                          <input
                            type="number"
                            value={statement.sequenceNumber}
                            onChange={(e) => updateStatement(statement.id, { 
                              sequenceNumber: parseInt(e.target.value) || 0 
                            })}
                            disabled={readonly}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                            min={1}
                            step={10}
                            data-testid={`statement-${statement.id}-sequence`}
                          />
                        </label>
                      </div>

                      <div>
                        <label>
                          <strong>Description:</strong>
                          <input
                            type="text"
                            value={statement.description || ''}
                            onChange={(e) => updateStatement(statement.id, { description: e.target.value })}
                            disabled={readonly}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                            placeholder="Statement description"
                            data-testid={`statement-${statement.id}-description`}
                          />
                        </label>
                      </div>

                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '30px' }}>
                          <input
                            type="checkbox"
                            checked={statement.enabled}
                            onChange={(e) => updateStatement(statement.id, { enabled: e.target.checked })}
                            disabled={readonly}
                            data-testid={`statement-${statement.id}-enabled`}
                          />
                          <span>Enabled</span>
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                      {/* Matches */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <h6>Match Conditions</h6>
                          {!readonly && (
                            <button
                              onClick={() => addMatch(statement.id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              data-testid={`add-match-${statement.id}`}
                            >
                              Add Match
                            </button>
                          )}
                        </div>

                        {statement.matches.map((match, matchIndex) => (
                          <div key={match.id} style={{ 
                            border: '1px solid #e9ecef', 
                            borderRadius: '4px', 
                            padding: '10px', 
                            marginBottom: '10px' 
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                              <select
                                value={match.type}
                                onChange={(e) => updateMatch(statement.id, match.id, { 
                                  type: e.target.value as RoutePolicyMatch['type']
                                })}
                                disabled={readonly}
                                style={{ padding: '4px', fontSize: '12px' }}
                                data-testid={`match-${match.id}-type`}
                              >
                                <option value="prefix">IP Prefix</option>
                                <option value="community">BGP Community</option>
                                <option value="as-path">AS Path</option>
                                <option value="metric">Metric</option>
                                <option value="origin">Origin</option>
                              </select>

                              <select
                                value={match.operator}
                                onChange={(e) => updateMatch(statement.id, match.id, { 
                                  operator: e.target.value as RoutePolicyMatch['operator']
                                })}
                                disabled={readonly}
                                style={{ padding: '4px', fontSize: '12px' }}
                                data-testid={`match-${match.id}-operator`}
                              >
                                <option value="eq">Equals</option>
                                <option value="ne">Not Equals</option>
                                <option value="lt">Less Than</option>
                                <option value="le">Less/Equal</option>
                                <option value="gt">Greater Than</option>
                                <option value="ge">Greater/Equal</option>
                                <option value="contains">Contains</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                value={match.value}
                                onChange={(e) => updateMatch(statement.id, match.id, { value: e.target.value })}
                                disabled={readonly}
                                style={{ flex: 1, padding: '4px', fontSize: '12px' }}
                                placeholder={
                                  match.type === 'prefix' ? '10.0.0.0/8' :
                                  match.type === 'community' ? '65000:100' :
                                  match.type === 'metric' ? '100' : 'Value'
                                }
                                data-testid={`match-${match.id}-value`}
                              />
                              {!readonly && (
                                <button
                                  onClick={() => removeMatch(statement.id, match.id)}
                                  style={{
                                    padding: '4px 6px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px'
                                  }}
                                  data-testid={`remove-match-${match.id}`}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {statement.matches.length === 0 && (
                          <div style={{ 
                            padding: '15px', 
                            textAlign: 'center', 
                            color: '#6c757d',
                            border: '2px dashed #dee2e6',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            No match conditions (matches all routes)
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <h6>Actions</h6>
                          {!readonly && (
                            <button
                              onClick={() => addAction(statement.id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              data-testid={`add-action-${statement.id}`}
                            >
                              Add Action
                            </button>
                          )}
                        </div>

                        {statement.actions
                          .sort((a, b) => a.priority - b.priority)
                          .map((action, actionIndex) => (
                            <div key={action.id} style={{ 
                              border: '1px solid #e9ecef', 
                              borderRadius: '4px', 
                              padding: '10px', 
                              marginBottom: '10px' 
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                                <select
                                  value={action.type}
                                  onChange={(e) => updateAction(statement.id, action.id, { 
                                    type: e.target.value as RoutePolicyAction['type']
                                  })}
                                  disabled={readonly}
                                  style={{ padding: '4px', fontSize: '12px' }}
                                  data-testid={`action-${action.id}-type`}
                                >
                                  <option value="permit">Permit Route</option>
                                  <option value="deny">Deny Route</option>
                                  <option value="set-metric">Set Metric</option>
                                  <option value="set-community">Set Community</option>
                                  <option value="set-local-pref">Set Local Pref</option>
                                  <option value="set-next-hop">Set Next Hop</option>
                                </select>

                                <input
                                  type="number"
                                  value={action.priority}
                                  onChange={(e) => updateAction(statement.id, action.id, { 
                                    priority: parseInt(e.target.value) || 1 
                                  })}
                                  disabled={readonly}
                                  style={{ width: '60px', padding: '4px', fontSize: '12px' }}
                                  min={1}
                                  title="Priority"
                                  data-testid={`action-${action.id}-priority`}
                                />
                              </div>

                              {['set-metric', 'set-community', 'set-local-pref', 'set-next-hop'].includes(action.type) && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <input
                                    type="text"
                                    value={action.value || ''}
                                    onChange={(e) => updateAction(statement.id, action.id, { value: e.target.value })}
                                    disabled={readonly}
                                    style={{ flex: 1, padding: '4px', fontSize: '12px' }}
                                    placeholder={
                                      action.type === 'set-metric' ? '100' :
                                      action.type === 'set-community' ? '65000:100' :
                                      action.type === 'set-local-pref' ? '100' :
                                      action.type === 'set-next-hop' ? '10.0.0.1' : ''
                                    }
                                    data-testid={`action-${action.id}-value`}
                                  />
                                  {!readonly && (
                                    <button
                                      onClick={() => removeAction(statement.id, action.id)}
                                      style={{
                                        padding: '4px 6px',
                                        backgroundColor: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '10px'
                                      }}
                                      data-testid={`remove-action-${action.id}`}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                        {statement.actions.length === 0 && (
                          <div style={{ 
                            padding: '15px', 
                            textAlign: 'center', 
                            color: '#6c757d',
                            border: '2px dashed #dee2e6',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            No actions configured
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

        {currentPolicy.spec.statements.length === 0 && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6c757d',
            border: '2px dashed #dee2e6',
            borderRadius: '4px'
          }}>
            No policy statements configured. Click "Add Statement" to create one.
          </div>
        )}
      </div>

      {/* Policy Summary */}
      {currentPolicy.spec.statements.length > 0 && (
        <div style={{ 
          marginTop: '30px', 
          padding: '15px', 
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d7ff',
          borderRadius: '4px'
        }}>
          <h5 style={{ margin: '0 0 10px 0' }}>Policy Summary</h5>
          <div style={{ fontSize: '14px' }}>
            <div><strong>Statements:</strong> {currentPolicy.spec.statements.length} total ({currentPolicy.spec.statements.filter(s => s.enabled).length} enabled)</div>
            <div><strong>Default Action:</strong> {currentPolicy.spec.defaultAction === 'permit' ? 'Allow unmatched routes' : 'Deny unmatched routes'}</div>
            <div><strong>Total Matches:</strong> {currentPolicy.spec.statements.reduce((sum, s) => sum + s.matches.length, 0)}</div>
            <div><strong>Total Actions:</strong> {currentPolicy.spec.statements.reduce((sum, s) => sum + s.actions.length, 0)}</div>
            <div><strong>Status:</strong> {errors.length === 0 ? '✓ Configuration valid' : `⚠ ${errors.length} validation errors`}</div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <h5 style={{ margin: '0 0 10px 0' }}>💡 Route Policy Tips</h5>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li><strong>Sequence Order:</strong> Statements are processed in sequence number order (lower numbers first)</li>
          <li><strong>First Match Wins:</strong> Once a route matches a statement, processing stops for that route</li>
          <li><strong>Default Action:</strong> Applied only to routes that don't match any statement</li>
          <li><strong>Multiple Matches:</strong> All match conditions in a statement must be true (AND logic)</li>
          <li><strong>Action Priority:</strong> When multiple actions apply, lower priority numbers execute first</li>
        </ul>
      </div>
    </div>
  )
}

export default RoutePolicyEditor