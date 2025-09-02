import React from 'react'

export interface BulkOperationsPanelProps {
  isOpen?: boolean
  onClose?: () => void
}

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  isOpen = false,
  onClose
}) => {
  if (!isOpen) {
    return null
  }

  const panelStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '400px',
    height: '100vh',
    backgroundColor: 'white',
    borderLeft: '1px solid #e5e7eb',
    boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
    zIndex: 1000,
    padding: '20px',
    overflow: 'auto'
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    fontSize: '18px',
    fontWeight: '600'
  }

  const closeButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px'
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 999
        }}
        onClick={onClose}
      />
      <div style={panelStyles} data-testid="bulk-operations-panel">
        <div style={headerStyles}>
          <span>Bulk Operations</span>
          <button
            type="button"
            style={closeButtonStyles}
            onClick={onClose}
            data-testid="close-bulk-panel"
          >
            ×
          </button>
        </div>
        
        <div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Bulk operations panel placeholder for WP-UXG2 implementation.
          </p>
        </div>
      </div>
    </>
  )
}

export default BulkOperationsPanel