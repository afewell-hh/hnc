import React from 'react'

interface BreakoutBadgeProps {
  breakoutType: string
  title?: string
  style?: React.CSSProperties
}

export function BreakoutBadge({ breakoutType, title, style }: BreakoutBadgeProps) {
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    gap: '0.25rem',
    marginLeft: '0.5rem',
    ...style
  }

  return (
    <span 
      style={badgeStyle} 
      title={title || `Supports ${breakoutType} breakouts`}
      data-testid="breakout-badge"
      aria-label={`Breakout capability: ${breakoutType}`}
    >
      🔌 {breakoutType}
    </span>
  )
}