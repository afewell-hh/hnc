import React from 'react'
import { useMachine } from '@xstate/react'
import { fabricDesignMachine } from './app.machine'

export const FabricDesignView: React.FC = () => {
  const [state, send] = useMachine(fabricDesignMachine, {})
  const handleInputChange = (field: string, value: any) => {
    send({ type: 'UPDATE_CONFIG', data: { [field]: value } })
  }
  const handleComputeTopology = () => send({ type: 'COMPUTE_TOPOLOGY' })
  const handleSaveToFgd = () => send({ type: 'SAVE_TO_FGD' })
  const handleReset = () => send({ type: 'RESET' })

  const { config, computedTopology, errors, savedToFgd } = state.context
  const currentState = String(state.value)

  return (
    <div className="fabric-design-container" style={{ padding: '20px', maxWidth: '800px' }}>
      <header>
        <h1>HNC v0.1 - Fabric Design Tool</h1>
        <div className="state-indicator">State: <strong>{currentState}</strong></div>
      </header>
      {/* Configuration Section */}
      <section className="config-section" style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Configuration</h2>
        <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {[
            { label: 'Fabric Name', field: 'name', type: 'text', placeholder: 'Enter fabric name' },
            { label: 'Spine Model ID', field: 'spineModelId', type: 'select', options: [['', 'Select spine model'], ['DS3000', 'DS3000 (32-port)']] },
            { label: 'Leaf Model ID', field: 'leafModelId', type: 'select', options: [['', 'Select leaf model'], ['DS2000', 'DS2000 (48-port)']] },
            { label: 'Uplinks Per Leaf (even)', field: 'uplinksPerLeaf', type: 'number', min: 2, step: 2 },
            { label: 'Endpoint Count', field: 'endpointCount', type: 'number', min: 1 },
          ].map(({ label, field, type, options, ...props }) => (
            <div key={field}>
              <label>
                {label}:
                {type === 'select' ? (
                  <select value={config[field as keyof typeof config] as string || ''} 
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                    {options?.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                ) : (
                  <input type={type} value={config[field as keyof typeof config] as string || ''}
                    onChange={(e) => handleInputChange(field, type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }} {...props} />
                )}
              </label>
            </div>
          ))}
          <div>
            <label>
              Endpoint Profile:
              <select value={config.endpointProfile?.name || ''} onChange={(e) => {
                const profiles = { 'Standard Server': { name: 'Standard Server', portsPerEndpoint: 2 },
                  'High-Density Server': { name: 'High-Density Server', portsPerEndpoint: 4 } }
                handleInputChange('endpointProfile', profiles[e.target.value as keyof typeof profiles])
              }} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                <option value="">Select profile</option>
                <option value="Standard Server">Standard Server (2 ports)</option>
                <option value="High-Density Server">High-Density Server (4 ports)</option>
              </select>
            </label>
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
            }}>
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
            }}>
            Reset
          </button>
        </div>
      </section>

      {/* Preview Section */}
      <section className="preview-section" style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
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

            <div className="save-section" style={{ marginTop: '20px' }}>
              <button
                onClick={handleSaveToFgd}
                disabled={!computedTopology.isValid || currentState !== 'computed'}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: computedTopology.isValid ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: computedTopology.isValid && currentState === 'computed' ? 'pointer' : 'not-allowed'
                }}
              >
                {currentState === 'saving' ? 'Saving to FGD...' : 'Save to FGD'}
              </button>
            </div>
          </div>
        )}

        {currentState === 'saved' && (
          <div className="save-success" style={{ padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px' }}>
            <h3 style={{ color: '#155724', margin: '0 0 10px 0' }}>✓ Saved Successfully</h3>
            <p style={{ margin: 0, color: '#155724' }}>Fabric design and wiring diagram stub saved to in-memory FGD.</p>
          </div>
        )}
        {currentState === 'saving' && (
          <div className="saving-indicator" style={{ padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px' }}>
            <h3 style={{ color: '#856404', margin: '0 0 10px 0' }}>⏳ Saving...</h3>
            <p style={{ margin: 0, color: '#856404' }}>Generating wiring diagram and saving to FGD...</p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="error-display" style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
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
        <section className="debug-section" style={{ padding: '20px', border: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
          <h3>Debug Info</h3>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <div><strong>Current State:</strong> {currentState}</div>
            <div><strong>Config Valid:</strong> {JSON.stringify(!!config && Object.keys(config).length > 0)}</div>
            <div><strong>Has Topology:</strong> {JSON.stringify(!!computedTopology)}</div>
            <div><strong>Saved to FGD:</strong> {JSON.stringify(savedToFgd)}</div>
          </div>
        </section>
      )}
    </div>
  )
}