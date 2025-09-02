import React, { useState } from 'react'
import { FabricSummary } from './fabric.types'
import { DriftBadge } from './drift/DriftBadge.js'
import { CreateFabricForm } from './components/CreateFabricForm.js'
import { FabricCard } from './components/FabricCard.js'
import { ErrorDisplay } from './components/ErrorDisplay.js'
import { EmptyState } from './components/EmptyState.js'

interface FabricListProps {
  fabrics: FabricSummary[]
  onCreateFabric: (name: string) => void
  onSelectFabric: (fabricId: string) => void
  onDeleteFabric: (fabricId: string) => void
  onCheckDrift?: (fabricId: string) => void
  onViewDriftDetails?: () => void
  errors: string[]
  isCreating: boolean
}

export function FabricList({ 
  fabrics, 
  onCreateFabric, 
  onSelectFabric, 
  onDeleteFabric, 
  onCheckDrift,
  onViewDriftDetails,
  errors,
  isCreating 
}: FabricListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreate = (name: string) => {
    onCreateFabric(name)
    setShowCreateForm(false)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
  }

  // Calculate drift count for workspace badge
  const fabricsWithDrift = fabrics.filter(f => f.driftStatus?.hasDrift).length

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>HNC Fabric Workspace</h1>
          <DriftBadge 
            driftCount={fabricsWithDrift} 
            onClick={onViewDriftDetails}
          />
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create New Fabric
          </button>
        )}
      </div>

      <ErrorDisplay errors={errors} />

      {showCreateForm && (
        <CreateFabricForm
          onCreateFabric={handleCreate}
          onCancel={handleCancel}
          isCreating={isCreating}
        />
      )}

      {fabrics.length === 0 && !showCreateForm && <EmptyState />}

      {fabrics.length > 0 && (
        <div>
          <h2>Your Fabrics ({fabrics.length})</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {fabrics.map((fabric) => (
              <FabricCard
                key={fabric.id}
                fabric={fabric}
                onSelectFabric={onSelectFabric}
                onDeleteFabric={onDeleteFabric}
                onCheckDrift={onCheckDrift}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}