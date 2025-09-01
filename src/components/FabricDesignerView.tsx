import React, { useState } from 'react'
import { useMachine } from '@xstate/react'
import { fabricDesignMachine } from '../app.machine'
import type { FabricDesignContext, FabricSpec } from '../app.types'
import { IssuesPanel } from '../ui/IssuesPanel'
import { OverrideChip, FieldWithOverride } from '../ui/OverrideChip'
import { GuardPanel } from '../ui/GuardPanel'
import { WiringDiagramSection } from '../ui/WiringDiagramSection'
import { ImportFabricDialog } from '../ui/ImportFabricDialog'
import { useUserMode } from '../contexts/UserModeContext'
import { Tooltip, InlineHint, HelpButton } from './GuidedHints'
import { BreakoutBadge } from '../ui/BreakoutBadge'
import HistoryView from './HistoryView'
import { BulkOperationsPanel } from './BulkOperationsPanel'

export const FabricDesignerView: React.FC = () => {
  const [state, send] = useMachine(fabricDesignMachine, {})
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isHistoryViewOpen, setIsHistoryViewOpen] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)
  const { isGuided, isExpert } = useUserMode()
  
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

  const handleImportFabric = (fabricSpec: FabricSpec) => {
    send({ type: 'START_IMPORT', fabricSpec })
    setIsImportDialogOpen(false)
  }

  const handleOpenImport = () => setIsImportDialogOpen(true)
  const handleCloseImport = () => setIsImportDialogOpen(false)
  const handleOpenHistory = () => setIsHistoryViewOpen(true)
  const handleCloseHistory = () => setIsHistoryViewOpen(false)

  // Bulk operations handlers
  const handleBulkOperationsApply = (modifiedSpec: FabricSpec) => {
    // Update the machine state with the bulk-modified spec
    send({ type: 'UPDATE_CONFIG', data: modifiedSpec })
    setShowBulkOperations(false)
    // Auto-compute topology after bulk changes
    setTimeout(() => {
      send({ type: 'COMPUTE_TOPOLOGY' })
    }, 100)
  }

  const { 
    config, 
    computedTopology, 
    errors, 
    savedToFgd, 
    issues, 
    fieldOverrides,
    rulesEngineEnabled,
    importProgress
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="state-indicator">
          State: <strong>{currentState}</strong>
          {rulesEngineEnabled && (
            <span style={{ marginLeft: '1rem', color: '#28a745' }}>
              🔍 Rules Engine Active
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleOpenHistory}
            disabled={currentState === 'importing' || currentState === 'saving'}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentState !== 'importing' && currentState !== 'saving' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            data-testid="history-view-button"
            aria-label="View FGD history"
          >
            📜 History
          </button>
          <button
            onClick={handleOpenImport}
            disabled={currentState === 'importing' || currentState === 'saving'}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentState !== 'importing' && currentState !== 'saving' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            data-testid="import-fabric-button"
            aria-label="Import fabric configuration"
          >
            📁 Import
          </button>
          {(config.leafClasses && config.leafClasses.length > 0) && (
            <button
              onClick={() => setShowBulkOperations(!showBulkOperations)}
              disabled={currentState === 'importing' || currentState === 'saving'}
              style={{
                padding: '8px 16px',
                backgroundColor: showBulkOperations ? '#fd7e14' : '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentState !== 'importing' && currentState !== 'saving' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              data-testid="bulk-operations-button"
              aria-label="Toggle bulk operations panel"
            >
              🔧 Bulk Ops
            </button>
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
        data-testid="config-section"
      >
        <h2>
          Configuration
          <HelpButton content="Configure your fabric parameters here. All fields are required to compute the topology." />
        </h2>
        
        {isGuided && (
          <InlineHint variant="info">
            Fill in all configuration fields, then click "Compute Topology" to see your network design.
          </InlineHint>
        )}
        
        <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {/* Fabric Name */}
          <div>
            <FieldWithOverride
              fieldPath="name"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Choose a descriptive name for your network fabric (e.g., 'Production DC1', 'Dev Environment')">
                <label>
                  <span>
                    Fabric Name:
                    <HelpButton content="This is the identifier for your network fabric. Choose something meaningful for your environment." />
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
          </div>

          {/* Spine Model */}
          <div>
            <FieldWithOverride
              fieldPath="spineModelId"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Spine switches form the core of your fabric, connecting all leaf switches together">
                <label>
                  <span>
                    Spine Model ID:
                    <HelpButton content="Spine switches provide high-bandwidth connectivity between leaf switches. DS3000 is a 32-port high-capacity spine switch." />
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
          </div>

          {/* Leaf Model */}
          <div>
            <FieldWithOverride
              fieldPath="leafModelId"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Leaf switches connect your servers and provide access to the fabric">
                <label>
                  <span>
                    Leaf Model ID:
                    <HelpButton content="Leaf switches are where your servers connect. DS2000 provides 48 ports for server connections." />
                    {config.leafModelId === 'DS2000' && (
                      <BreakoutBadge 
                        breakoutType="4x25G" 
                        title="DS2000 supports 4x25G breakouts for increased port density"
                      />
                    )}
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
          </div>

          {/* Uplinks Per Leaf */}
          <div>
            <FieldWithOverride
              fieldPath="uplinksPerLeaf"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Number of connections from each leaf switch to spine switches. Must be even for redundancy.">
                <label>
                  <span>
                    Uplinks Per Leaf (even):
                    <HelpButton content="Each leaf needs uplink connections to spine switches. Use even numbers (2, 4, 6) for proper redundancy and load distribution." />
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
            {isGuided && config.uplinksPerLeaf && config.uplinksPerLeaf % 2 !== 0 && (
              <InlineHint variant="warning">
                Uplinks per leaf should be even (2, 4, 6, etc.) for proper redundancy.
              </InlineHint>
            )}
          </div>

          {/* Endpoint Count */}
          <div>
            <FieldWithOverride
              fieldPath="endpointCount"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Total number of servers or devices that will connect to your fabric">
                <label>
                  <span>
                    Endpoint Count:
                    <HelpButton content="How many servers, storage devices, or other endpoints will connect to your network fabric." />
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
          </div>

          {/* Endpoint Profile */}
          <div>
            <FieldWithOverride
              fieldPath="endpointProfile"
              fieldOverrides={fieldOverrides}
              onClearOverride={handleClearOverride}
            >
              <Tooltip content="Choose the type of servers/endpoints that will connect to determine port requirements">
                <label>
                  <span>
                    Endpoint Profile:
                    <HelpButton content="Different server types need different numbers of network connections. Standard servers typically use 2 ports, high-density servers use 4." />
                  </span>
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
              </Tooltip>
            </FieldWithOverride>
          </div>

          {/* Breakout Toggle */}
          {config.leafModelId === 'DS2000' && (
            <div style={{ gridColumn: 'span 2' }}>
              <FieldWithOverride
                fieldPath="breakoutEnabled"
                fieldOverrides={fieldOverrides}
                onClearOverride={handleClearOverride}
              >
                <Tooltip content="Enable breakout to increase effective port capacity with 4x25G breakouts">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="checkbox"
                      checked={config.breakoutEnabled || false}
                      onChange={(e) => handleInputChange('breakoutEnabled', e.target.checked)}
                      data-testid="breakout-enabled-checkbox"
                      aria-label="Enable Breakout"
                    />
                    <span>
                      Enable Breakout (4x25G)
                      <HelpButton content="Enabling breakouts increases effective capacity by using 4x25G lanes per port. This affects capacity calculations but not per-lane assignments in this version." />
                      <BreakoutBadge 
                        breakoutType="4x25G" 
                        title="Increases effective capacity by 4x"
                      />
                    </span>
                  </label>
                </Tooltip>
              </FieldWithOverride>
              {config.breakoutEnabled && (
                <InlineHint variant="info">
                  Breakout enabled: Effective capacity will be calculated with 4x multiplier for endpoint ports.
                </InlineHint>
              )}
            </div>
          )}
        </div>

        <div className="config-actions" style={{ marginTop: '20px' }}>
          <Tooltip content="Click to calculate the required switches and validate your configuration">
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
          </Tooltip>
          <Tooltip content="Reset all configuration fields to their default values">
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
          </Tooltip>
        </div>
        
        {isGuided && (
          <InlineHint variant="tip">
            After filling in all fields, click "Compute Topology" to see how many switches you'll need and validate your configuration.
          </InlineHint>
        )}
      </section>

      {/* Bulk Operations Panel - WP-BULK1 */}
      {showBulkOperations && config.leafClasses && config.leafClasses.length > 0 && (
        <section 
          className="bulk-operations-section" 
          style={{ marginBottom: '30px', padding: '20px', border: '2px solid #6f42c1', borderRadius: '8px' }}
          data-testid="bulk-operations-section"
        >
          <BulkOperationsPanel
            fabricSpec={config as FabricSpec}
            onApplyChanges={handleBulkOperationsApply}
            disabled={currentState === 'importing' || currentState === 'saving'}
          />
        </section>
      )}

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

            {/* Effective Capacity Display */}
            {config.breakoutEnabled && config.leafModelId === 'DS2000' && (
              <div 
                className="effective-capacity-info" 
                style={{ 
                  marginTop: '15px', 
                  padding: '10px', 
                  backgroundColor: '#e3f2fd', 
                  border: '1px solid #2196f3', 
                  borderRadius: '4px' 
                }}
                data-testid="effective-capacity-display"
              >
                <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
                  🔌 Breakout Capacity Effect
                  <BreakoutBadge breakoutType="4x25G" style={{ marginLeft: '10px' }} />
                </h4>
                <div className="capacity-breakdown" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                  <div>
                    <strong>Base Endpoint Ports:</strong> {48 - (config.uplinksPerLeaf || 2)} per leaf
                  </div>
                  <div>
                    <strong>Effective with Breakouts:</strong> {(48 - (config.uplinksPerLeaf || 2)) * 4} per leaf
                  </div>
                  <div>
                    <strong>Capacity Increase:</strong> +300% ({4}x multiplier)
                  </div>
                  <div>
                    <strong>Total Effective:</strong> {computedTopology.leavesNeeded * (48 - (config.uplinksPerLeaf || 2)) * 4} ports
                  </div>
                </div>
              </div>
            )}

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

        {/* Wiring Diagram Section */}
        <WiringDiagramSection
          computedTopology={computedTopology}
          allocationResult={state.context.allocationResult || null}
          config={config}
          isVisible={currentState === 'computed' || currentState === 'saving' || currentState === 'saved'}
          hasCapacityError={computedTopology ? !computedTopology.isValid : false}
        />

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

      {/* Import Fabric Dialog */}
      <ImportFabricDialog
        isOpen={isImportDialogOpen}
        onClose={handleCloseImport}
        onImport={handleImportFabric}
        importProgress={importProgress}
      />

      {/* History View */}
      <HistoryView
        isOpen={isHistoryViewOpen}
        onClose={handleCloseHistory}
      />
    </div>
  )
}