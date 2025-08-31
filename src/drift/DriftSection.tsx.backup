import React, { useState } from 'react'
import type { DriftStatus, DriftSummary } from './types.js'

interface DriftSectionProps {
  fabricId: string
  driftStatus: DriftStatus | null
  onRefreshDrift?: () => void
  onShowDetails?: () => void
  isRefreshing?: boolean
}

export function DriftSection({ 
  fabricId, 
  driftStatus, 
  onRefreshDrift, 
  onShowDetails,
  isRefreshing = false 
}: DriftSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!driftStatus) {
    return (
      <div style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h4 style={{ margin: 0, color: '#666' }}>Drift Status</h4>
          <button
            onClick={onRefreshDrift}
            disabled={isRefreshing}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            {isRefreshing ? 'Checking...' : 'Check for Drift'}
          </button>
        </div>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Click "Check for Drift" to compare in-memory topology with saved files
        </p>
      </div>
    )
  }

  const sectionStyle: React.CSSProperties = {
    border: driftStatus.hasDrift ? '1px solid #ffb74d' : '1px solid #c8e6c9',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    backgroundColor: driftStatus.hasDrift ? '#fff8e1' : '#f1f8e9'
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: driftStatus.hasDrift ? '0.5rem' : 0
  }

  return (
    <div style={sectionStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h4 style={{ margin: 0, color: driftStatus.hasDrift ? '#f57c00' : '#4caf50' }}>
            {driftStatus.hasDrift ? '🔄 Drift Detected' : '✅ No Drift'}
          </h4>
          {driftStatus.hasDrift && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: '#f57c00'
              }}
            >
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onRefreshDrift}
            disabled={isRefreshing}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          {onShowDetails && driftStatus.hasDrift && (
            <button
              onClick={onShowDetails}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid #f57c00',
                borderRadius: '4px',
                backgroundColor: '#f57c00',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {!driftStatus.hasDrift && (
        <p style={{ margin: '0.5rem 0 0 0', color: '#4caf50', fontSize: '0.9rem' }}>
          In-memory topology matches saved files. Last checked: {driftStatus.lastChecked.toLocaleTimeString()}
        </p>
      )}

      {driftStatus.hasDrift && (
        <>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            Last checked: {driftStatus.lastChecked.toLocaleTimeString()}
          </div>
          
          {isExpanded && (
            <div style={{ 
              backgroundColor: 'white', 
              padding: '0.75rem', 
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              <h5 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Changes Detected:</h5>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#666' }}>
                {driftStatus.driftSummary.map((summary, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>
                    {summary}
                  </li>
                ))}
              </ul>
              
              {driftStatus.affectedFiles.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <h6 style={{ margin: '0 0 0.25rem 0', color: '#333' }}>Affected Files:</h6>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.8rem', color: '#666' }}>
                    {driftStatus.affectedFiles.map((file, index) => (
                      <li key={index}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}