import React, { useState } from 'react'

interface CreateFabricFormProps {
  onCreateFabric: (name: string) => void
  onCancel: () => void
  isCreating: boolean
}

export function CreateFabricForm({ onCreateFabric, onCancel, isCreating }: CreateFabricFormProps) {
  const [newFabricName, setNewFabricName] = useState('')

  const handleCreate = () => {
    if (newFabricName.trim()) {
      onCreateFabric(newFabricName.trim())
      setNewFabricName('')
    }
  }

  return (
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
          onClick={onCancel}
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
  )
}