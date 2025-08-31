import React from 'react'
import { useMachine } from '@xstate/react'
import { workspaceMachine } from './workspace.machine'
import { FabricList } from './FabricList'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { FabricDesignerView } from './components/FabricDesignerView'

function FabricDesigner({ fabricId, onBackToList }: { fabricId: string; onBackToList: () => void }) {
  return (
    <div style={{ padding: '1rem', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>HNC Fabric Designer v0.4</h1>
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
      
      {/* New Issues-Panel based Fabric Designer */}
      <ErrorBoundary fallback={<div data-testid="designer-fallback" />}>
        <FabricDesignerView />
      </ErrorBoundary>
    </div>
  )
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