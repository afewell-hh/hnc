import React from 'react'
import { useMachine } from '@xstate/react'
import { fabricDesignMachine } from './app.machine'

function App() {
  const [state, send] = useMachine(fabricDesignMachine)

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>HNC Fabric Designer v0.1</h1>
      
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
        State: {String(state.value)} | Config: {JSON.stringify(state.context.config)}
      </div>
    </div>
  )
}

export default App