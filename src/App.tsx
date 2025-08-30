import React, { useState } from 'react'
import { useMachine } from '@xstate/react'
import { workspaceMachine } from './workspace.machine'
import { fabricDesignMachine } from './app.machine'
import { FabricList } from './FabricList'
import { DriftSection } from './drift/DriftSection.js'
import { detectDrift } from './drift/detector.js'
import type { DriftStatus } from './drift/types.js'

function FabricDesigner({ fabricId, onBackToList }: { fabricId: string; onBackToList: () => void }) {
  const [state, send] = useMachine(fabricDesignMachine)
  const [driftStatus, setDriftStatus] = useState<DriftStatus | null>(null)
  const [isCheckingDrift, setIsCheckingDrift] = useState(false)

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>HNC Fabric Designer v0.2</h1>
        <button
          onClick={onBackToList}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to List
        </button>
      </div>

      {/* Drift Detection Section */}
      <DriftSection
        fabricId={fabricId}
        driftStatus={driftStatus}
        onRefreshDrift={handleCheckDrift}
        isRefreshing={isCheckingDrift}
      />
      
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Fabric Name:
          <input
            type="text"
            value={state.context.config.name || ''}
            onChange={(e) => send({ type: 'UPDATE_CONFIG', data: { name: e.target.value } })}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Spine Model:
          <select
            value={state.context.config.spineModelId || 'DS3000'}
            onChange={(e) => send({ type: 'UPDATE_CONFIG', data: { spineModelId: e.target.value } })}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            <option value="DS3000">DS3000</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Leaf Model:
          <select
            value={state.context.config.leafModelId || 'DS2000'}
            onChange={(e) => send({ type: 'UPDATE_CONFIG', data: { leafModelId: e.target.value } })}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            <option value="DS2000">DS2000</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Uplinks Per Leaf:
          <input
            type="number"
            min="1"
            max="4"
            value={state.context.config.uplinksPerLeaf || 2}
            onChange={(e) => send({ type: 'UPDATE_CONFIG', data: { uplinksPerLeaf: parseInt(e.target.value) } })}
            style={{ marginLeft: '0.5rem', padding: '0.25rem', width: '60px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Endpoint Count:
          <input
            type="number"
            min="1"
            value={state.context.config.endpointCount || 48}
            onChange={(e) => send({ type: 'UPDATE_CONFIG', data: { endpointCount: parseInt(e.target.value) } })}
            style={{ marginLeft: '0.5rem', padding: '0.25rem', width: '80px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => send({ type: 'COMPUTE_TOPOLOGY' })}
          disabled={state.matches('computing') || state.matches('saving')}
          style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
        >
          {state.matches('computing') ? 'Computing...' : 'Compute Topology'}
        </button>

        {state.matches('computed') && (
          <button
            onClick={() => send({ type: 'SAVE_TO_FGD' })}
            disabled={state.matches('saving')}
            style={{ padding: '0.5rem 1rem' }}
          >
            {state.matches('saving') ? 'Saving...' : 'Save to FGD'}
          </button>
        )}
      </div>

      {state.context.errors.length > 0 && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          <h3>Errors:</h3>
          <ul>
            {state.context.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {state.context.computedTopology && (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
          <h3>Computed Topology</h3>
          <p>Leaves needed: {state.context.computedTopology.leavesNeeded}</p>
          <p>Spines needed: {state.context.computedTopology.spinesNeeded}</p>
          <p>Oversubscription ratio: {state.context.computedTopology.oversubscriptionRatio}:1</p>
          <p>Valid: {state.context.computedTopology.isValid ? 'Yes' : 'No'}</p>
        </div>
      )}

      {state.matches('saved') && (
        <div style={{ color: 'green', padding: '1rem', border: '1px solid green' }}>
          ✅ Topology saved to FGD successfully!
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2rem' }}>
        Fabric ID: {fabricId} | State: {String(state.value)} | Config: {JSON.stringify(state.context.config)}
      </div>
    </div>
  )

  // Drift checking function
  async function handleCheckDrift() {
    if (!state.context.loadedDiagram) {
      setDriftStatus({
        hasDrift: false,
        driftSummary: ['No topology loaded - cannot check drift'],
        lastChecked: new Date(),
        affectedFiles: []
      })
      return
    }

    setIsCheckingDrift(true)
    try {
      const result = await detectDrift(fabricId, state.context.loadedDiagram)
      setDriftStatus(result)
    } catch (error) {
      setDriftStatus({
        hasDrift: false,
        driftSummary: [`Error checking drift: ${error instanceof Error ? error.message : 'Unknown error'}`],
        lastChecked: new Date(),
        affectedFiles: []
      })
    } finally {
      setIsCheckingDrift(false)
    }
  }
}

function App() {
  const [workspaceState, workspaceSend] = useMachine(workspaceMachine)

  const handleCreateFabric = (name: string) => {
    workspaceSend({ type: 'CREATE_FABRIC', name })
  }

  const handleSelectFabric = (fabricId: string) => {
    workspaceSend({ type: 'SELECT_FABRIC', fabricId })
  }

  const handleDeleteFabric = (fabricId: string) => {
    workspaceSend({ type: 'DELETE_FABRIC', fabricId })
  }

  const handleBackToList = () => {
    workspaceSend({ type: 'BACK_TO_LIST' })
  }

  const handleCheckDrift = async (fabricId: string) => {
    // This would check drift for a specific fabric in the workspace
    console.log(`Checking drift for fabric: ${fabricId}`)
    // Implementation would depend on having access to the fabric's current state
  }

  const handleViewDriftDetails = () => {
    // This could open a modal or navigate to a dedicated drift view
    console.log('Opening drift details view')
  }

  // Route based on workspace state
  if (workspaceState.matches('selected') && workspaceState.context.selectedFabricId) {
    return (
      <FabricDesigner 
        fabricId={workspaceState.context.selectedFabricId}
        onBackToList={handleBackToList}
      />
    )
  }

  return (
    <FabricList
      fabrics={workspaceState.context.fabrics}
      onCreateFabric={handleCreateFabric}
      onSelectFabric={handleSelectFabric}
      onDeleteFabric={handleDeleteFabric}
      onCheckDrift={handleCheckDrift}
      onViewDriftDetails={handleViewDriftDetails}
      errors={workspaceState.context.errors}
      isCreating={workspaceState.matches('creating')}
    />
  )
}

export default App