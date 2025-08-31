import React, { ReactNode, useState } from 'react'
import { useUserMode } from '../contexts/UserModeContext'

export interface TooltipProps {
  children: ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  showOnlyInGuidedMode?: boolean
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  showOnlyInGuidedMode = true
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const { isGuided } = useUserMode()

  // Hide tooltip in expert mode if showOnlyInGuidedMode is true
  if (showOnlyInGuidedMode && !isGuided) {
    return <>{children}</>
  }

  const tooltipStyles: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block'
  }

  const tooltipContentStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    padding: '8px 12px',
    backgroundColor: '#2c3e50',
    color: 'white',
    borderRadius: '4px',
    fontSize: '13px',
    lineHeight: '1.4',
    maxWidth: '250px',
    whiteSpace: 'normal',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.2s, visibility 0.2s',
    ...(position === 'top' && {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px'
    }),
    ...(position === 'bottom' && {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px'
    }),
    ...(position === 'left' && {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px'
    }),
    ...(position === 'right' && {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px'
    })
  }

  const arrowStyles: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    ...(position === 'top' && {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '6px 6px 0 6px',
      borderColor: '#2c3e50 transparent transparent transparent'
    }),
    ...(position === 'bottom' && {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '0 6px 6px 6px',
      borderColor: 'transparent transparent #2c3e50 transparent'
    }),
    ...(position === 'left' && {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 0 6px 6px',
      borderColor: 'transparent transparent transparent #2c3e50'
    }),
    ...(position === 'right' && {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 6px 6px 0',
      borderColor: 'transparent #2c3e50 transparent transparent'
    })
  }

  return (
    <div 
      style={tooltipStyles}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      data-testid="tooltip-wrapper"
    >
      {children}
      <div style={tooltipContentStyles} data-testid="tooltip-content">
        {content}
        <div style={arrowStyles} />
      </div>
    </div>
  )
}

export interface InlineHintProps {
  children: ReactNode
  showOnlyInGuidedMode?: boolean
  variant?: 'info' | 'warning' | 'success' | 'tip'
}

export const InlineHint: React.FC<InlineHintProps> = ({
  children,
  showOnlyInGuidedMode = true,
  variant = 'info'
}) => {
  const { isGuided } = useUserMode()

  // Hide hint in expert mode if showOnlyInGuidedMode is true
  if (showOnlyInGuidedMode && !isGuided) {
    return null
  }

  const variantStyles = {
    info: {
      backgroundColor: '#e3f2fd',
      color: '#1565c0',
      borderLeft: '4px solid #2196f3',
      icon: 'ℹ️'
    },
    warning: {
      backgroundColor: '#fff8e1',
      color: '#f57f17',
      borderLeft: '4px solid #ffc107',
      icon: '⚠️'
    },
    success: {
      backgroundColor: '#e8f5e8',
      color: '#2e7d32',
      borderLeft: '4px solid #4caf50',
      icon: '✅'
    },
    tip: {
      backgroundColor: '#f3e5f5',
      color: '#7b1fa2',
      borderLeft: '4px solid #9c27b0',
      icon: '💡'
    }
  }

  const style = variantStyles[variant]

  const hintStyles: React.CSSProperties = {
    padding: '8px 12px',
    margin: '4px 0',
    backgroundColor: style.backgroundColor,
    color: style.color,
    borderLeft: style.borderLeft,
    borderRadius: '0 4px 4px 0',
    fontSize: '13px',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px'
  }

  return (
    <div style={hintStyles} data-testid="inline-hint" data-variant={variant}>
      <span style={{ flexShrink: 0 }}>{style.icon}</span>
      <div>{children}</div>
    </div>
  )
}

export interface HelpButtonProps {
  content: string
  showOnlyInGuidedMode?: boolean
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  content,
  showOnlyInGuidedMode = true
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const { isGuided } = useUserMode()

  // Hide help button in expert mode if showOnlyInGuidedMode is true
  if (showOnlyInGuidedMode && !isGuided) {
    return null
  }

  const buttonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: '2px 6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#6c757d',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: '4px',
    verticalAlign: 'middle'
  }

  const popoverStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '8px',
    padding: '12px 16px',
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontSize: '13px',
    lineHeight: '1.4',
    color: '#495057',
    maxWidth: '300px',
    whiteSpace: 'normal',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.2s, visibility 0.2s'
  }

  return (
    <button
      type="button"
      style={buttonStyles}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => {
        e.preventDefault()
        setIsVisible(!isVisible)
      }}
      data-testid="help-button"
      aria-label="Show help"
      title="Click for help"
    >
      ?
      <div style={popoverStyles} data-testid="help-popover">
        {content}
      </div>
    </button>
  )
}