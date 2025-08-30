import React, { useState } from 'react'
import { FabricSummary } from './fabric.types'
import { DriftBadge } from './drift/DriftBadge.js'
import { DriftIndicator } from './drift/DriftIndicator.js'

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
  const [newFabricName, setNewFabricName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreate = () => {
    if (newFabricName.trim()) {
      onCreateFabric(newFabricName.trim())
      setNewFabricName('')
      setShowCreateForm(false)
    }
  }

  const handleCancel = () => {
    setNewFabricName('')
    setShowCreateForm(false)
  }

  const getStatusColor = (status: FabricSummary['status']) => {
    switch (status) {
      case 'draft': return '#666'
      case 'computed': return '#1976d2'
      case 'saved': return '#388e3c'
      default: return '#666'
    }
  }

  const getStatusLabel = (status: FabricSummary['status']) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'computed': return 'Computed'
      case 'saved': return 'Saved'
      default: return 'Unknown'
    }
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

      {errors.length > 0 && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffebee', 
          padding: '1rem', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Errors:</h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {showCreateForm && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '4px', 
          padding: '1rem', 
          marginBottom: '2rem',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>Create New Fabric</h3>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Enter fabric name..."
              value={newFabricName}
              onChange={(e) => setNewFabricName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              style={{
                width: '300px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginRight: '0.5rem'
              }}
              autoFocus
              disabled={isCreating}
            />
            <button
              onClick={handleCreate}
              disabled={!newFabricName.trim() || isCreating}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '0.5rem',
                opacity: (!newFabricName.trim() || isCreating) ? 0.6 : 1
              }}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isCreating}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {fabrics.length === 0 && !showCreateForm && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#666',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <h3>No fabrics created yet</h3>
          <p>Create your first fabric to get started with network design</p>
        </div>
      )}

      {fabrics.length > 0 && (
        <div>
          <h2>Your Fabrics ({fabrics.length})</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {fabrics.map((fabric) => (
              <div
                key={fabric.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      {fabric.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          color: 'white',
                          backgroundColor: getStatusColor(fabric.status)
                        }}
                      >
                        {getStatusLabel(fabric.status)}
                      </span>
                      <DriftIndicator 
                        driftStatus={fabric.driftStatus || null}
                        onClick={onCheckDrift ? () => onCheckDrift(fabric.id) : undefined}
                        compact
                      />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      <div>Created: {fabric.createdAt.toLocaleDateString()}</div>
                      <div>Modified: {fabric.lastModified.toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => onSelectFabric(fabric.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#1976d2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Select
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${fabric.name}"?`)) {
                          onDeleteFabric(fabric.id)
                        }
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}