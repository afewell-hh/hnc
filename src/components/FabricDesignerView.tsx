import React from 'react'
import { useMachine } from '@xstate/react'
import { fabricDesignMachine } from '../app.machine'
import type { FabricDesignContext } from '../app.types'
import { IssuesPanel } from '../ui/IssuesPanel'
import { OverrideChip, FieldWithOverride } from '../ui/OverrideChip'
import { GuardPanel } from '../ui/GuardPanel'

export const FabricDesignerView: React.FC = () => {
  const [state, send] = useMachine(fabricDesignMachine, {})
  
  const handleInputChange = (field: string, value: any) => {
    send({ type: 'UPDATE_CONFIG', data: { [field]: value } })
  }
  
  const handleComputeTopology = () => send({ type: 'COMPUTE_TOPOLOGY' })
  const handleSaveToFgd = () => send({ type: 'SAVE_TO_FGD' })
  const handleReset = () => send({ type: 'RESET' })
  
  const handleOverrideIssue = (issueId: string, reason: string) => {
    send({ type: 'OVERRIDE_ISSUE', issueId, reason })
  }
  
  const handleClearOverride = (fieldPath: string) => {
    send({ type: 'CLEAR_OVERRIDE', fieldPath })
  }

  const { 
    config, 
    computedTopology, 
    errors, 
    savedToFgd, 
    issues, 
    fieldOverrides,
    rulesEngineEnabled 
  } = state.context as FabricDesignContext
  
  const currentState = String(state.value)

  // Check if save is enabled based on issues
  const canSave = rulesEngineEnabled 
    ? issues.filter(i => i.type === 'error' && !i.overridden && !i.overridable).length === 0
    : computedTopology?.isValid || false

  return (
    <div 
      className="fabric-design-container" 
      style={{ padding: '20px', maxWidth: '1200px' }}
      data-testid="fabric-designer-view"
    >
      <header>
        <h1>HNC Fabric Designer v0.4</h1>
        <div className="state-indicator">
          State: <strong>{currentState}</strong>
          {rulesEngineEnabled && (
            <span style={{ marginLeft: '1rem', color: '#28a745' }}>
              🔍 Rules Engine Active
            </span>
          )}
        </div>
      </header>

      {/* Issues Panel - Show when rules engine is enabled */}
      {rulesEngineEnabled && issues.length > 0 && (
        <IssuesPanel
          issues={issues}
          fieldOverrides={fieldOverrides}
          onOverrideIssue={handleOverrideIssue}
          onClearOverride={handleClearOverride}
        />
      )}

      {/* Configuration Section */}
      <section 
        className="config-section" 
        style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}
      >
        <h2>Configuration</h2>
        <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {/* Fabric Name */}
          <div>
            <FieldWithOverride
              fieldPath="name"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Fabric Name:</span>
                <input 
                  type="text" 
                  value={config.name || ''} 
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }} 
                  placeholder="Enter fabric name"
                  data-testid="fabric-name-input"
                  aria-label="Fabric Name"
                />
              </label>
            </FieldWithOverride>
          </div>

          {/* Spine Model */}
          <div>
            <FieldWithOverride
              fieldPath="spineModelId"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Spine Model ID:</span>
                <select 
                  value={config.spineModelId || ''} 
                  onChange={(e) => handleInputChange('spineModelId', e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="spine-model-select"
                  aria-label="Spine Model"
                >
                  <option value="">Select spine model</option>
                  <option value="DS3000">DS3000 (32-port)</option>
                </select>
              </label>
            </FieldWithOverride>
          </div>

          {/* Leaf Model */}
          <div>
            <FieldWithOverride
              fieldPath="leafModelId"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Leaf Model ID:</span>
                <select 
                  value={config.leafModelId || ''} 
                  onChange={(e) => handleInputChange('leafModelId', e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="leaf-model-select"
                  aria-label="Leaf Model"
                >
                  <option value="">Select leaf model</option>
                  <option value="DS2000">DS2000 (48-port)</option>
                </select>
              </label>
            </FieldWithOverride>
          </div>

          {/* Uplinks Per Leaf */}
          <div>
            <FieldWithOverride
              fieldPath="uplinksPerLeaf"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Uplinks Per Leaf (even):</span>
                <input 
                  type="number" 
                  value={config.uplinksPerLeaf || 2} 
                  onChange={(e) => handleInputChange('uplinksPerLeaf', parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }} 
                  min={2}
                  step={2}
                  data-testid="uplinks-per-leaf-input"
                  aria-label="Uplinks Per Leaf"
                />
              </label>
            </FieldWithOverride>
          </div>

          {/* Endpoint Count */}
          <div>
            <FieldWithOverride
              fieldPath="endpointCount"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Endpoint Count:</span>
                <input 
                  type="number" 
                  value={config.endpointCount || 48} 
                  onChange={(e) => handleInputChange('endpointCount', parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }} 
                  min={1}
                  data-testid="endpoint-count-input"
                  aria-label="Endpoint Count"
                />
              </label>
            </FieldWithOverride>
          </div>

          {/* Endpoint Profile */}
          <div>
            <FieldWithOverride
              fieldPath="endpointProfile"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <label>
                <span>Endpoint Profile:</span>
                <select 
                  value={config.endpointProfile?.name || ''} 
                  onChange={(e) => {
                    const profiles = { 
                      'Standard Server': { name: 'Standard Server', portsPerEndpoint: 2 },
                      'High-Density Server': { name: 'High-Density Server', portsPerEndpoint: 4 } 
                    }
                    handleInputChange('endpointProfile', profiles[e.target.value as keyof typeof profiles])
                  }} 
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="endpoint-profile-select"
                  aria-label="Endpoint Profile"
                >
                  <option value="">Select profile</option>
                  <option value="Standard Server">Standard Server (2 ports)</option>
                  <option value="High-Density Server">High-Density Server (4 ports)</option>
                </select>
              </label>
            </FieldWithOverride>
          </div>
        </div>

        <div className="config-actions" style={{ marginTop: '20px' }}>
          <button 
            onClick={handleComputeTopology} 
            disabled={currentState === 'saving'}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px', 
              backgroundColor: '#007bff',
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: currentState !== 'saving' ? 'pointer' : 'not-allowed' 
            }}
            data-testid="compute-topology-button"
          >
            Compute Topology
          </button>
          <button 
            onClick={handleReset}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px', 
              backgroundColor: '#6c757d',
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
            data-testid="reset-button"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Preview Section */}
      <section 
        className="preview-section" 
        style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}
      >
        <h2>Preview</h2>
        
        {(currentState === 'computed' || currentState === 'saving') && computedTopology && (
          <div className="topology-results" style={{ marginBottom: '20px' }}>
            <h3>Computed Topology</h3>
            <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div><strong>Leaves Needed:</strong> {computedTopology.leavesNeeded}</div>
              <div><strong>Spines Needed:</strong> {computedTopology.spinesNeeded}</div>
              <div><strong>Total Ports:</strong> {computedTopology.totalPorts}</div>
              <div><strong>Used Ports:</strong> {computedTopology.usedPorts}</div>
              <div>
                <strong>O/S Ratio:</strong> {computedTopology.oversubscriptionRatio.toFixed(2)}:1
                {computedTopology.oversubscriptionRatio > 4 && (
                  <span style={{ color: 'red', marginLeft: '5px' }}>(Too High!)</span>
                )}
              </div>
              <div>
                <strong>Valid:</strong> 
                <span style={{ color: computedTopology.isValid ? 'green' : 'red' }}>
                  {computedTopology.isValid ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Guard Panel for constraint violations */}
            {computedTopology.guards && computedTopology.guards.length > 0 && (
              <GuardPanel guards={computedTopology.guards} />
            )}

            <div className="save-section" style={{ marginTop: '20px' }}>
              <button
                onClick={handleSaveToFgd}
                disabled={!canSave || currentState !== 'computed'}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: canSave ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canSave && currentState === 'computed' ? 'pointer' : 'not-allowed'
                }}
                data-testid="save-to-fgd-button"
              >
                {currentState === 'saving' ? 'Saving to FGD...' : 'Save to FGD'}
              </button>
              
              {!canSave && rulesEngineEnabled && (
                <p style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.9rem', 
                  color: '#dc3545' 
                }}>
                  ⚠️ Resolve blocking issues or apply manual overrides to enable save.
                </p>
              )}
            </div>
          </div>
        )}

        {currentState === 'saved' && (
          <div 
            className="save-success" 
            style={{ 
              padding: '15px', 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb', 
              borderRadius: '4px' 
            }}
            data-testid="save-success-message"
          >
            <h3 style={{ color: '#155724', margin: '0 0 10px 0' }}>✓ Saved Successfully</h3>
            <p style={{ margin: 0, color: '#155724' }}>
              Fabric design and wiring diagram stub saved to in-memory FGD.
            </p>
          </div>
        )}

        {currentState === 'saving' && (
          <div 
            className="saving-indicator" 
            style={{ 
              padding: '15px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '4px' 
            }}
            data-testid="saving-indicator"
          >
            <h3 style={{ color: '#856404', margin: '0 0 10px 0' }}>⏳ Saving...</h3>
            <p style={{ margin: 0, color: '#856404' }}>
              Generating wiring diagram and saving to FGD...
            </p>
          </div>
        )}

        {/* Legacy error display for backwards compatibility */}
        {errors.length > 0 && (
          <div 
            className="error-display" 
            style={{ 
              marginTop: '15px', 
              padding: '15px', 
              backgroundColor: '#f8d7da', 
              border: '1px solid #f5c6cb', 
              borderRadius: '4px' 
            }}
            data-testid="legacy-errors"
          >
            <h3 style={{ color: '#721c24', margin: '0 0 10px 0' }}>⚠ Validation Errors</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#721c24' }}>
              {errors.map((error: string, index: number) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <section 
          className="debug-section" 
          style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            backgroundColor: '#f8f9fa' 
          }}
        >
          <h3>Debug Info</h3>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <div><strong>Current State:</strong> {currentState}</div>
            <div><strong>Config Valid:</strong> {JSON.stringify(!!config && Object.keys(config).length > 0)}</div>
            <div><strong>Has Topology:</strong> {JSON.stringify(!!computedTopology)}</div>
            <div><strong>Saved to FGD:</strong> {JSON.stringify(savedToFgd)}</div>
            <div><strong>Rules Engine:</strong> {JSON.stringify(rulesEngineEnabled)}</div>
            <div><strong>Issues Count:</strong> {issues.length}</div>
            <div><strong>Overrides Count:</strong> {fieldOverrides.length}</div>
            <div><strong>Can Save:</strong> {JSON.stringify(canSave)}</div>
          </div>
        </section>
      )}
    </div>
  )
}