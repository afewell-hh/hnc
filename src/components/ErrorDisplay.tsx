import React from 'react'

interface ErrorDisplayProps {
  errors: string[]
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
  if (errors.length === 0) return null

  return (
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
  )
}