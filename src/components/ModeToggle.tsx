import React from 'react'
import { useUserMode, UserMode } from '../contexts/UserModeContext'

export interface ModeToggleProps {
  className?: string
  style?: React.CSSProperties
  size?: 'small' | 'medium' | 'large'
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  className = '',
  style = {},
  size = 'medium'
}) => {
  const { mode, setMode, isGuided, isExpert } = useUserMode()

  const handleToggle = (newMode: UserMode) => {
    setMode(newMode)
  }

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    padding: '2px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    ...style
  }

  const buttonStyles = (isActive: boolean): React.CSSProperties => ({
    padding: size === 'small' ? '4px 8px' : size === 'large' ? '10px 16px' : '6px 12px',
    fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px',
    fontWeight: isActive ? '600' : '400',
    backgroundColor: isActive ? '#ffffff' : 'transparent',
    color: isActive ? '#495057' : '#6c757d',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    outline: 'none',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)' : 'none',
    minWidth: size === 'small' ? '50px' : size === 'large' ? '80px' : '65px',
    textAlign: 'center'
  })

  const iconStyles: React.CSSProperties = {
    marginRight: '6px',
    fontSize: size === 'small' ? '12px' : '14px'
  }

  const labelStyles: React.CSSProperties = {
    marginRight: '8px',
    fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px',
    fontWeight: '500',
    color: '#495057'
  }

  return (
    <div 
      className={`mode-toggle ${className}`}
      style={baseStyles}
      data-testid="mode-toggle"
      role="group"
      aria-label="User experience mode toggle"
    >
      <span style={labelStyles}>Mode:</span>
      <button
        type="button"
        onClick={() => handleToggle('guided')}
        style={buttonStyles(isGuided)}
        data-testid="guided-mode-button"
        aria-label="Switch to guided mode"
        aria-pressed={isGuided}
        title="Guided mode: Shows helpful hints and tooltips for new users"
      >
        <span style={iconStyles}>🎯</span>
        Guided
      </button>
      <button
        type="button"
        onClick={() => handleToggle('expert')}
        style={buttonStyles(isExpert)}
        data-testid="expert-mode-button"
        aria-label="Switch to expert mode"
        aria-pressed={isExpert}
        title="Expert mode: Shows advanced features like provenance chips"
      >
        <span style={iconStyles}>⚡</span>
        Expert
      </button>
    </div>
  )
}

export default ModeToggle