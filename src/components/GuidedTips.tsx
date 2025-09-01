import React, { useState, useEffect } from 'react'
import { useUserMode } from '../contexts/UserModeContext'

export interface GuidedTipConfig {
  id: string
  title: string
  content: React.ReactNode
  target?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  showOnce?: boolean
  priority?: number
  condition?: () => boolean
}

export interface GuidedTipsProps {
  tips: GuidedTipConfig[]
  onComplete?: (tipId: string) => void
  className?: string
}

export const GuidedTips: React.FC<GuidedTipsProps> = ({
  tips,
  onComplete,
  className = ''
}) => {
  const { isGuided } = useUserMode()
  const [currentTip, setCurrentTip] = useState<GuidedTipConfig | null>(null)
  const [completedTips, setCompletedTips] = useState<Set<string>>(new Set())
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Only show tips in guided mode
  if (!isGuided) {
    return null
  }

  // Filter and sort available tips
  const availableTips = tips
    .filter(tip => !completedTips.has(tip.id))
    .filter(tip => !tip.condition || tip.condition())
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))

  useEffect(() => {
    if (availableTips.length > 0 && !currentTip) {
      setCurrentTip(availableTips[0])
    }
  }, [availableTips, currentTip])

  useEffect(() => {
    if (currentTip && currentTip.target) {
      const targetElement = document.querySelector(`[data-tip-target="${currentTip.target}"]`)
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        const placement = currentTip.placement || 'bottom'
        
        let top = 0
        let left = 0
        
        switch (placement) {
          case 'top':
            top = rect.top - 10
            left = rect.left + rect.width / 2
            break
          case 'bottom':
            top = rect.bottom + 10
            left = rect.left + rect.width / 2
            break
          case 'left':
            top = rect.top + rect.height / 2
            left = rect.left - 10
            break
          case 'right':
            top = rect.top + rect.height / 2
            left = rect.right + 10
            break
        }
        
        setPosition({ top, left })
      }
    }
  }, [currentTip])

  const handleNext = () => {
    if (currentTip) {
      const newCompleted = new Set(completedTips)
      if (currentTip.showOnce) {
        newCompleted.add(currentTip.id)
        setCompletedTips(newCompleted)
      }
      
      onComplete?.(currentTip.id)
      
      // Find next tip
      const remainingTips = availableTips.filter(tip => 
        tip.id !== currentTip.id && !newCompleted.has(tip.id)
      )
      
      if (remainingTips.length > 0) {
        setCurrentTip(remainingTips[0])
      } else {
        setCurrentTip(null)
      }
    }
  }

  const handleSkip = () => {
    setCurrentTip(null)
  }

  const handleDismissAll = () => {
    const allTipIds = new Set([...completedTips, ...tips.map(t => t.id)])
    setCompletedTips(allTipIds)
    setCurrentTip(null)
  }

  if (!currentTip) {
    return null
  }

  const tipStyles: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    top: position.top,
    left: position.left,
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '16px',
    maxWidth: '320px',
    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.15)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937'
  }

  const contentStyles: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#4b5563',
    marginBottom: '16px'
  }

  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  }

  const buttonStyles: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease'
  }

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    backgroundColor: '#3b82f6',
    color: 'white'
  }

  const secondaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0'
  }

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    backdropFilter: 'blur(1px)'
  }

  const progressStyles: React.CSSProperties = {
    fontSize: '11px',
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: '8px'
  }

  const currentIndex = tips.findIndex(t => t.id === currentTip.id) + 1
  const totalTips = tips.length

  return (
    <>
      <div style={overlayStyles} onClick={handleSkip} data-testid="tip-overlay" />
      <div 
        style={tipStyles}
        className={`guided-tip ${className}`}
        data-testid="guided-tip"
        data-tip-id={currentTip.id}
      >
        <div style={progressStyles}>
          Tip {currentIndex} of {totalTips}
        </div>
        
        <div style={headerStyles}>
          <span>💡</span>
          <span>{currentTip.title}</span>
        </div>
        
        <div style={contentStyles}>
          {currentTip.content}
        </div>
        
        <div style={actionsStyles}>
          <button
            type="button"
            style={secondaryButtonStyles}
            onClick={handleDismissAll}
            data-testid="tip-dismiss-all"
          >
            Don't show tips
          </button>
          <button
            type="button"
            style={secondaryButtonStyles}
            onClick={handleSkip}
            data-testid="tip-skip"
          >
            Skip
          </button>
          <button
            type="button"
            style={primaryButtonStyles}
            onClick={handleNext}
            data-testid="tip-next"
          >
            {currentIndex === totalTips ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}

export interface ContextualTipProps {
  id: string
  title: string
  content: React.ReactNode
  target: string
  showOnce?: boolean
  priority?: number
  className?: string
}

export const ContextualTip: React.FC<ContextualTipProps> = ({
  id,
  title,
  content,
  target,
  showOnce = true,
  priority = 0,
  className = ''
}) => {
  const tips: GuidedTipConfig[] = [{
    id,
    title,
    content,
    target,
    showOnce,
    priority
  }]

  return (
    <GuidedTips 
      tips={tips}
      className={className}
    />
  )
}

export interface InlineGuidanceProps {
  children: React.ReactNode
  tip?: string
  variant?: 'info' | 'warning' | 'success' | 'tip'
  showInExpertMode?: boolean
  className?: string
}

export const InlineGuidance: React.FC<InlineGuidanceProps> = ({
  children,
  tip,
  variant = 'info',
  showInExpertMode = false,
  className = ''
}) => {
  const { isGuided, isExpert } = useUserMode()

  // Show tip based on mode settings
  const shouldShowTip = tip && (isGuided || (isExpert && showInExpertMode))

  const variantStyles = {
    info: {
      backgroundColor: '#eff6ff',
      borderColor: '#3b82f6',
      color: '#1e40af',
      icon: 'ℹ️'
    },
    warning: {
      backgroundColor: '#fffbeb',
      borderColor: '#f59e0b',
      color: '#d97706',
      icon: '⚠️'
    },
    success: {
      backgroundColor: '#f0fdf4',
      borderColor: '#22c55e',
      color: '#16a34a',
      icon: '✅'
    },
    tip: {
      backgroundColor: '#fef7ff',
      borderColor: '#a855f7',
      color: '#9333ea',
      icon: '💡'
    }
  }

  const style = variantStyles[variant]

  const tipStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 12px',
    marginTop: '4px',
    backgroundColor: style.backgroundColor,
    border: `1px solid ${style.borderColor}`,
    borderRadius: '6px',
    fontSize: '13px',
    lineHeight: '1.4',
    color: style.color
  }

  return (
    <div className={`inline-guidance ${className}`} data-testid="inline-guidance">
      {children}
      {shouldShowTip && (
        <div style={tipStyles} data-testid="guidance-tip" data-variant={variant}>
          <span style={{ flexShrink: 0 }}>{style.icon}</span>
          <div>{tip}</div>
        </div>
      )}
    </div>
  )
}

export default GuidedTips