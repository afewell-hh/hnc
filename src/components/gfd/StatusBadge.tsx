/**
 * StatusBadge Component - WP-NAV1
 * Status badge component for navigation validation state
 */

import React from 'react'

export type ValidationBadge = 'ok' | 'warning' | 'error' | 'pending' | 'loading'

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  field?: string
  suggestion?: string
}

export interface StatusBadgeProps {
  badge: ValidationBadge
  issues?: ValidationIssue[]
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const BADGE_CONFIGS = {
  ok: { 
    icon: '✓', 
    color: 'success', 
    tooltip: 'Step completed successfully',
    priority: 4
  },
  warning: { 
    icon: '⚠', 
    color: 'warning', 
    tooltip: 'Completed with warnings',
    priority: 2
  },
  error: { 
    icon: '✖', 
    color: 'error', 
    tooltip: 'Errors must be resolved',
    priority: 1
  },
  pending: { 
    icon: '○', 
    color: 'neutral', 
    tooltip: 'Not started',
    priority: 5
  },
  loading: { 
    icon: '⟳', 
    color: 'info', 
    tooltip: 'Processing...',
    priority: 3
  }
} as const

export const getBadgeForIssues = (issues: ValidationIssue[]): ValidationBadge => {
  if (issues.length === 0) return 'ok'
  
  const hasErrors = issues.some(i => i.type === 'error')
  if (hasErrors) return 'error'
  
  const hasWarnings = issues.some(i => i.type === 'warning')
  if (hasWarnings) return 'warning'
  
  return 'ok'
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  badge,
  issues = [],
  size = 'md',
  showTooltip = true,
  className = ''
}) => {
  const config = BADGE_CONFIGS[badge]
  
  const renderTooltip = () => {
    if (!showTooltip) return null

    const content = issues.length > 0 
      ? issues.map(issue => issue.message).join('\n')
      : config.tooltip

    return (
      <div className="status-badge-tooltip" role="tooltip">
        {content}
      </div>
    )
  }

  const animationClass = badge === 'loading' ? 'animate-spin' : ''

  return (
    <div 
      className={`status-badge status-badge-${config.color} status-badge-${size} ${animationClass} ${className}`}
      aria-label={config.tooltip}
      title={showTooltip ? undefined : config.tooltip}
    >
      <span className="badge-icon" aria-hidden="true">
        {config.icon}
      </span>
      {issues.length > 0 && (
        <span className="badge-count" aria-label={`${issues.length} issues`}>
          {issues.length}
        </span>
      )}
      {showTooltip && renderTooltip()}
    </div>
  )
}

export default StatusBadge