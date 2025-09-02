import React, { useState, useRef, useEffect } from 'react'
import { useUserMode } from '../contexts/UserModeContext'

export interface ExplainTooltipProps {
  children: React.ReactNode
  explanation: string
  title?: string
  showInExpertMode?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right'
  variant?: 'default' | 'expert' | 'warning' | 'info'
  className?: string
}

export const ExplainTooltip: React.FC<ExplainTooltipProps> = ({
  children,
  explanation,
  title = "Why this matters",
  showInExpertMode = true,
  position = 'top',
  variant = 'default',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const { isGuided, isExpert } = useUserMode()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Only show in guided mode, or in expert mode if explicitly allowed
  const shouldShow = isGuided || (isExpert && showInExpertMode)
  if (!shouldShow) {
    return <>{children}</>
  }

  // Check if tooltip would overflow viewport and adjust position
  useEffect(() => {
    if (isVisible && tooltipRef.current && wrapperRef.current) {
      const tooltip = tooltipRef.current
      const wrapper = wrapperRef.current
      const rect = wrapper.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      
      let newPosition = position
      
      // Check top overflow
      if (position === 'top' && rect.top - tooltipRect.height < 10) {
        newPosition = 'bottom'
      }
      
      // Check bottom overflow
      if (position === 'bottom' && rect.bottom + tooltipRect.height > window.innerHeight - 10) {
        newPosition = 'top'
      }
      
      // Check left overflow
      if (position === 'left' && rect.left - tooltipRect.width < 10) {
        newPosition = 'right'
      }
      
      // Check right overflow
      if (position === 'right' && rect.right + tooltipRect.width > window.innerWidth - 10) {
        newPosition = 'left'
      }
      
      setActualPosition(newPosition)
    }
  }, [isVisible, position])

  const variantStyles = {
    default: {
      backgroundColor: '#2c3e50',
      color: 'white',
      borderColor: '#2c3e50'
    },
    expert: {
      backgroundColor: '#1a365d',
      color: '#e2e8f0',
      borderColor: '#2d3748'
    },
    warning: {
      backgroundColor: '#744210',
      color: '#fef5e7',
      borderColor: '#d69e2e'
    },
    info: {
      backgroundColor: '#1e3a8a',
      color: '#dbeafe',
      borderColor: '#3b82f6'
    }
  }

  const style = variantStyles[variant]

  const wrapperStyles: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block'
  }

  const tooltipStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    padding: '12px 16px',
    backgroundColor: style.backgroundColor,
    color: style.color,
    borderRadius: '6px',
    fontSize: '13px',
    lineHeight: '1.4',
    maxWidth: '280px',
    width: 'max-content',
    whiteSpace: 'normal',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease',
    transform: isVisible ? 'scale(1)' : 'scale(0.95)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: `1px solid ${style.borderColor}`,
    ...(actualPosition === 'top' && {
      bottom: '100%',
      left: '50%',
      transform: `translateX(-50%) ${isVisible ? 'scale(1)' : 'scale(0.95)'}`,
      marginBottom: '8px'
    }),
    ...(actualPosition === 'bottom' && {
      top: '100%',
      left: '50%',
      transform: `translateX(-50%) ${isVisible ? 'scale(1)' : 'scale(0.95)'}`,
      marginTop: '8px'
    }),
    ...(actualPosition === 'left' && {
      right: '100%',
      top: '50%',
      transform: `translateY(-50%) ${isVisible ? 'scale(1)' : 'scale(0.95)'}`,
      marginRight: '8px'
    }),
    ...(actualPosition === 'right' && {
      left: '100%',
      top: '50%',
      transform: `translateY(-50%) ${isVisible ? 'scale(1)' : 'scale(0.95)'}`,
      marginLeft: '8px'
    })
  }

  const arrowStyles: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    ...(actualPosition === 'top' && {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '6px 6px 0 6px',
      borderColor: `${style.backgroundColor} transparent transparent transparent`
    }),
    ...(actualPosition === 'bottom' && {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '0 6px 6px 6px',
      borderColor: `transparent transparent ${style.backgroundColor} transparent`
    }),
    ...(actualPosition === 'left' && {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 0 6px 6px',
      borderColor: `transparent transparent transparent ${style.backgroundColor}`
    }),
    ...(actualPosition === 'right' && {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 6px 6px 0',
      borderColor: `transparent ${style.backgroundColor} transparent transparent`
    })
  }

  const titleStyles: React.CSSProperties = {
    fontWeight: '600',
    marginBottom: '6px',
    fontSize: '14px'
  }

  return (
    <div 
      ref={wrapperRef}
      style={wrapperStyles}
      className={`explain-tooltip-wrapper ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      data-testid="explain-tooltip-wrapper"
      data-user-mode={isGuided ? 'guided' : 'expert'}
      data-variant={variant}
    >
      {children}
      <div 
        ref={tooltipRef}
        style={tooltipStyles} 
        data-testid="explain-tooltip-content"
        role="tooltip"
        aria-label={explanation}
      >
        {title && <div style={titleStyles}>{title}</div>}
        <div>{explanation}</div>
        <div style={arrowStyles} />
      </div>
    </div>
  )
}

export interface ExplainButtonProps {
  explanation: string
  title?: string
  variant?: 'default' | 'expert' | 'warning' | 'info'
  size?: 'small' | 'medium'
  showInExpertMode?: boolean
  className?: string
}

export const ExplainButton: React.FC<ExplainButtonProps> = ({
  explanation,
  title = "Why this matters",
  variant = 'default',
  size = 'small',
  showInExpertMode = true,
  className = ''
}) => {
  const { isGuided, isExpert } = useUserMode()

  // Only show in guided mode, or in expert mode if explicitly allowed
  const shouldShow = isGuided || (isExpert && showInExpertMode)
  if (!shouldShow) {
    return null
  }

  const buttonStyles: React.CSSProperties = {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '50%',
    width: size === 'small' ? '20px' : '24px',
    height: size === 'small' ? '20px' : '24px',
    cursor: 'pointer',
    fontSize: size === 'small' ? '12px' : '14px',
    color: '#64748b',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '6px',
    verticalAlign: 'middle',
    transition: 'all 0.2s ease',
    backgroundColor: 'white',
    outline: 'none'
  }

  const hoverStyles: React.CSSProperties = {
    ...buttonStyles,
    borderColor: '#cbd5e0',
    color: '#4a5568',
    transform: 'scale(1.1)'
  }

  const [isHovered, setIsHovered] = useState(false)

  return (
    <ExplainTooltip
      explanation={explanation}
      title={title}
      variant={variant}
      showInExpertMode={showInExpertMode}
      className={className}
    >
      <button
        type="button"
        style={isHovered ? hoverStyles : buttonStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="explain-button"
        data-variant={variant}
        data-size={size}
        aria-label={`Explain: ${title}`}
        onClick={(e) => e.preventDefault()}
      >
        ?
      </button>
    </ExplainTooltip>
  )
}

export default ExplainTooltip