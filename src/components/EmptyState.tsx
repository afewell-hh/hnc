import React from 'react'

export function EmptyState() {
  return (
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
  )
}