import React from 'react'
import type { DriftStatus } from './types.js'

interface DriftIndicatorProps {
  driftStatus: DriftStatus | null
  isChecking?: boolean
  onClick?: () => void
  compact?: boolean
}

export function DriftIndicator({ driftStatus, isChecking, onClick, compact = false }: DriftIndicatorProps) {
  if (isChecking) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        borderRadius: '8px',
        fontSize: '0.8rem'
      }}>
        🔄 {compact ? 'Checking...' : 'Checking for drift...'}
      </span>
    )
  }

  if (!driftStatus) {
    return null
  }

  if (!driftStatus.hasDrift) {
    if (compact) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          color: '#4caf50',
          fontSize: '0.8rem'
        }}>
          ✓
        </span>
      )
    }
    return null // Don't show "no drift" indicator in non-compact mode
  }

  const indicatorStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#fff3e0',
    color: '#f57c00',
    border: '1px solid #ffb74d',
    borderRadius: '8px',
    fontSize: '0.8rem',
    cursor: onClick ? 'pointer' : 'default'
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }

  return (
    <span 
      style={indicatorStyle} 
      onClick={handleClick}
      title={compact ? driftStatus.driftSummary.join(', ') : undefined}
    >
      🔄 {compact ? 'Drift detected' : `Drift detected (${driftStatus.driftSummary.length} changes)`}
    </span>
  )
}