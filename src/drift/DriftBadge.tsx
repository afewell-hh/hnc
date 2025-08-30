import React from 'react'

interface DriftBadgeProps {
  driftCount: number
  onClick?: () => void
  style?: React.CSSProperties
}

export function DriftBadge({ driftCount, onClick, style }: DriftBadgeProps) {
  if (driftCount === 0) {
    return null
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#ff9800',
    color: 'white',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    cursor: onClick ? 'pointer' : 'default',
    gap: '0.25rem',
    ...style
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }

  return (
    <span style={badgeStyle} onClick={handleClick} title={`${driftCount} fabric${driftCount > 1 ? 's' : ''} have drift`}>
      ⚠️ {driftCount} fabric{driftCount > 1 ? 's' : ''} have drift
    </span>
  )
}