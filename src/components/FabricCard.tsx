import React from 'react'
import { FabricSummary } from '../fabric.types'
import { DriftIndicator } from '../drift/DriftIndicator.js'

interface FabricCardProps {
  fabric: FabricSummary
  onSelectFabric: (fabricId: string) => void
  onDeleteFabric: (fabricId: string) => void
  onCheckDrift?: (fabricId: string) => void
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

export function FabricCard({ fabric, onSelectFabric, onDeleteFabric, onCheckDrift }: FabricCardProps) {
  return (
    <div
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
  )
}