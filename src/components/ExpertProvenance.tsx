import React, { useState } from 'react'
import { useUserMode } from '../contexts/UserModeContext'

export interface ProvenanceEntry {
  id: string
  field: string
  value: any
  source: 'user' | 'computed' | 'default' | 'derived'
  timestamp: Date
  reason?: string
  dependencies?: string[]
  metadata?: Record<string, any>
}

export interface ExpertProvenanceProps {
  entries: ProvenanceEntry[]
  fieldName: string
  currentValue: any
  className?: string
  compact?: boolean
}

export const ExpertProvenance: React.FC<ExpertProvenanceProps> = ({
  entries,
  fieldName,
  currentValue,
  className = '',
  compact = false
}) => {
  const { isExpert } = useUserMode()
  const [isExpanded, setIsExpanded] = useState(false)

  // Only show in expert mode
  if (!isExpert) {
    return null
  }

  // Filter entries for this field
  const relevantEntries = entries.filter(entry => 
    entry.field === fieldName || 
    (entry.dependencies && entry.dependencies.includes(fieldName))
  )

  if (relevantEntries.length === 0) {
    return null
  }

  const latestEntry = relevantEntries[relevantEntries.length - 1]

  const getSourceIcon = (source: ProvenanceEntry['source']) => {
    switch (source) {
      case 'user': return '👤'
      case 'computed': return '🧮'
      case 'default': return '⚙️'
      case 'derived': return '🔗'
      default: return '❓'
    }
  }

  const getSourceColor = (source: ProvenanceEntry['source']) => {
    switch (source) {
      case 'user': return '#22c55e'
      case 'computed': return '#3b82f6'
      case 'default': return '#64748b'
      case 'derived': return '#f59e0b'
      default: return '#6b7280'
    }
  }

  const wrapperStyles: React.CSSProperties = {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  }

  const chipStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: compact ? '1px 4px' : '2px 6px',
    backgroundColor: '#f8fafc',
    border: `1px solid ${getSourceColor(latestEntry.source)}`,
    borderRadius: '12px',
    fontSize: compact ? '10px' : '11px',
    fontWeight: '500',
    color: getSourceColor(latestEntry.source),
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    userSelect: 'none'
  }

  const expandedStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    top: '100%',
    left: 0,
    marginTop: '4px',
    padding: '12px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    minWidth: '280px',
    maxWidth: '400px',
    fontSize: '12px',
    lineHeight: '1.4'
  }

  const entryStyles: React.CSSProperties = {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f1f5f9'
  }

  const formatValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div 
      style={{ ...wrapperStyles, position: 'relative' }}
      className={`expert-provenance ${className}`}
      data-testid="expert-provenance"
      data-field={fieldName}
    >
      <div
        style={chipStyles}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Show provenance for ${fieldName}`}
        aria-expanded={isExpanded}
        data-testid="provenance-chip"
      >
        <span>{getSourceIcon(latestEntry.source)}</span>
        <span>{latestEntry.source}</span>
        {relevantEntries.length > 1 && (
          <span style={{ 
            backgroundColor: getSourceColor(latestEntry.source),
            color: 'white',
            borderRadius: '8px',
            padding: '0 3px',
            fontSize: '9px',
            marginLeft: '2px'
          }}>
            {relevantEntries.length}
          </span>
        )}
      </div>

      {isExpanded && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setIsExpanded(false)}
            data-testid="provenance-overlay"
          />
          <div style={expandedStyles} data-testid="provenance-details">
            <div style={{ 
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1f2937',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '4px'
            }}>
              Field Provenance: {fieldName}
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <strong>Current Value:</strong>
              <div style={{ 
                fontFamily: 'monospace',
                backgroundColor: '#f8fafc',
                padding: '4px 8px',
                borderRadius: '4px',
                marginTop: '4px',
                fontSize: '11px'
              }}>
                {formatValue(currentValue)}
              </div>
            </div>

            <div>
              <strong>Change History:</strong>
              <div style={{ marginTop: '8px' }}>
                {relevantEntries.slice().reverse().map((entry, index) => (
                  <div key={entry.id} style={entryStyles}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px'
                    }}>
                      <span>{getSourceIcon(entry.source)}</span>
                      <span style={{ 
                        fontWeight: '500',
                        color: getSourceColor(entry.source)
                      }}>
                        {entry.source}
                      </span>
                      <span style={{ color: '#9ca3af' }}>
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      {index === 0 && (
                        <span style={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          fontSize: '9px',
                          padding: '1px 4px',
                          borderRadius: '2px'
                        }}>
                          CURRENT
                        </span>
                      )}
                    </div>
                    
                    <div style={{ color: '#4b5563', marginBottom: '2px' }}>
                      Value: <code style={{ 
                        backgroundColor: '#f3f4f6',
                        padding: '1px 3px',
                        borderRadius: '2px'
                      }}>
                        {formatValue(entry.value)}
                      </code>
                    </div>
                    
                    {entry.reason && (
                      <div style={{ color: '#6b7280' }}>
                        Reason: {entry.reason}
                      </div>
                    )}
                    
                    {entry.dependencies && entry.dependencies.length > 0 && (
                      <div style={{ color: '#6b7280' }}>
                        Dependencies: {entry.dependencies.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export interface FieldWithProvenanceProps {
  children: React.ReactNode
  fieldName: string
  provenance: ProvenanceEntry[]
  currentValue: any
  className?: string
}

export const FieldWithProvenance: React.FC<FieldWithProvenanceProps> = ({
  children,
  fieldName,
  provenance,
  currentValue,
  className = ''
}) => {
  const { isExpert } = useUserMode()

  return (
    <div className={`field-with-provenance ${className}`} style={{ position: 'relative' }}>
      {children}
      {isExpert && (
        <ExpertProvenance
          entries={provenance}
          fieldName={fieldName}
          currentValue={currentValue}
          compact
        />
      )}
    </div>
  )
}

export default ExpertProvenance