/**
 * History View component for displaying FGD commit and PR history
 * Read-only view that displays chronological list of fabric changes
 * Links out to GitHub for detailed views
 */

import React, { useState, useEffect } from 'react'
import { 
  GitHubHistoryService, 
  HistoryEntry, 
  CommitHistoryEntry, 
  PRHistoryEntry,
  HistoryFetchOptions,
  HistoryFetchResult,
  createGitHubHistoryService,
  isGitHubHistoryAvailable
} from '../features/github-history.service.js'

export interface HistoryViewProps {
  isOpen: boolean
  onClose: () => void
}

export const HistoryView: React.FC<HistoryViewProps> = ({ isOpen, onClose }) => {
  const [historyService, setHistoryService] = useState<GitHubHistoryService | null>(null)
  const [historyResult, setHistoryResult] = useState<HistoryFetchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchOptions, setFetchOptions] = useState<HistoryFetchOptions>({
    limit: 20,
    includeCommits: true,
    includePRs: true,
    fgdOnly: true
  })

  // Initialize service when component mounts
  useEffect(() => {
    if (isOpen && !historyService) {
      // Check for mocked functions in test/storybook environment
      const mockAvailable = (global as any).mockIsGitHubHistoryAvailable
      const mockCreate = (global as any).mockCreateGitHubHistoryService
      
      const isAvailable = mockAvailable ? mockAvailable() : isGitHubHistoryAvailable()
      
      if (isAvailable) {
        const service = mockCreate ? mockCreate() : createGitHubHistoryService()
        if (service) {
          service.initialize().then((initialized: boolean) => {
            if (initialized) {
              setHistoryService(service)
            } else {
              setError('Failed to initialize GitHub service')
            }
          })
        } else {
          setError('GitHub History service not available')
        }
      }
    }
  }, [isOpen, historyService])

  // Fetch history when service is ready
  useEffect(() => {
    if (historyService && isOpen) {
      fetchHistory()
    }
  }, [historyService, isOpen, fetchOptions])

  const fetchHistory = async () => {
    if (!historyService) return

    setLoading(true)
    setError(null)

    try {
      const result = await historyService.fetchHistory(fetchOptions)
      setHistoryResult(result)
      
      if (!result.success && result.error) {
        setError(result.error)
      }
    } catch (err: any) {
      setError(`Failed to fetch history: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchHistory()
  }

  const handleToggleCommits = () => {
    setFetchOptions(prev => ({
      ...prev,
      includeCommits: !prev.includeCommits
    }))
  }

  const handleTogglePRs = () => {
    setFetchOptions(prev => ({
      ...prev,
      includePRs: !prev.includePRs
    }))
  }

  const handleToggleFGDOnly = () => {
    setFetchOptions(prev => ({
      ...prev,
      fgdOnly: !prev.fgdOnly
    }))
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="history-view-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
      data-testid="history-view-overlay"
    >
      <div
        className="history-view-modal"
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
        data-testid="history-view-modal"
      >
        {/* Header */}
        <div className="history-header" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>FGD History</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
              data-testid="close-history-button"
              aria-label="Close History View"
            >
              ×
            </button>
          </div>
          
          {/* Filter Controls */}
          <div 
            className="history-filters" 
            style={{ 
              marginTop: '15px', 
              display: 'flex', 
              gap: '15px', 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={fetchOptions.includeCommits}
                onChange={handleToggleCommits}
                data-testid="include-commits-checkbox"
              />
              Include Commits
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={fetchOptions.includePRs}
                onChange={handleTogglePRs}
                data-testid="include-prs-checkbox"
              />
              Include PRs
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={fetchOptions.fgdOnly}
                onChange={handleToggleFGDOnly}
                data-testid="fgd-only-checkbox"
              />
              FGD-related only
            </label>

            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: '5px 10px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              data-testid="refresh-history-button"
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="history-content"
          style={{ flex: 1, overflow: 'auto' }}
        >
          {!((global as any).mockIsGitHubHistoryAvailable ? (global as any).mockIsGitHubHistoryAvailable() : isGitHubHistoryAvailable()) && (
            <div 
              className="history-unavailable"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666'
              }}
              data-testid="history-unavailable"
            >
              <h3>GitHub History Not Available</h3>
              <p>
                GitHub integration is not configured. To view FGD history, please configure:
              </p>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                <li><code>GITHUB_TOKEN</code> environment variable</li>
                <li><code>GIT_REMOTE</code> environment variable</li>
                <li><code>FEATURE_GH_PR=true</code> feature flag</li>
              </ul>
            </div>
          )}

          {error && (
            <div 
              className="history-error"
              style={{
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                padding: '15px',
                marginBottom: '20px',
                color: '#721c24'
              }}
              data-testid="history-error"
            >
              <h4 style={{ margin: '0 0 10px 0' }}>⚠ Error Loading History</h4>
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          )}

          {loading && (
            <div 
              className="history-loading"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666'
              }}
              data-testid="history-loading"
            >
              <h3>Loading History...</h3>
              <p>Fetching recent FGD commits and pull requests...</p>
            </div>
          )}

          {historyResult && !loading && (
            <HistoryEntries 
              entries={historyResult.entries}
              hasMore={historyResult.hasMore}
              totalCount={historyResult.totalCount}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface HistoryEntriesProps {
  entries: HistoryEntry[]
  hasMore: boolean
  totalCount?: number
}

const HistoryEntries: React.FC<HistoryEntriesProps> = ({ entries, hasMore, totalCount }) => {
  if (entries.length === 0) {
    return (
      <div 
        className="history-empty"
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#666'
        }}
        data-testid="history-empty"
      >
        <h3>No FGD History Found</h3>
        <p>
          No recent commits or pull requests related to FGD files were found.
          Try adjusting the filters or check your repository settings.
        </p>
      </div>
    )
  }

  return (
    <div data-testid="history-entries">
      {totalCount && (
        <div 
          className="history-summary"
          style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            fontSize: '14px',
            color: '#666'
          }}
        >
          Showing {entries.length} of {totalCount} entries
          {hasMore && ' (more available)'}
        </div>
      )}
      
      <div className="history-timeline">
        {entries.map((entry, index) => (
          <HistoryEntry key={`${entry.type}-${entry.type === 'commit' ? entry.sha : entry.number}`} entry={entry} />
        ))}
      </div>
    </div>
  )
}

interface HistoryEntryProps {
  entry: HistoryEntry
}

const HistoryEntry: React.FC<HistoryEntryProps> = ({ entry }) => {
  const isCommit = entry.type === 'commit'
  const commitEntry = entry as CommitHistoryEntry
  const prEntry = entry as PRHistoryEntry

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getStatusColor = (state?: string) => {
    switch (state) {
      case 'merged': return '#28a745'
      case 'open': return '#007bff'
      case 'closed': return '#6c757d'
      default: return '#6c757d'
    }
  }

  const getStatusIcon = (state?: string) => {
    switch (state) {
      case 'merged': return '✓'
      case 'open': return '○'
      case 'closed': return '●'
      default: return '●'
    }
  }

  return (
    <div
      className={`history-entry history-entry-${entry.type}`}
      style={{
        border: '1px solid #e1e5e9',
        borderRadius: '6px',
        marginBottom: '15px',
        padding: '15px',
        backgroundColor: 'white'
      }}
      data-testid={`history-entry-${entry.type}`}
    >
      <div className="entry-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Type Icon */}
        <div
          className="entry-type-icon"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: isCommit ? '#f1f8ff' : '#fff5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '14px'
          }}
        >
          {isCommit ? '📝' : getStatusIcon(prEntry.state)}
        </div>

        {/* Main Content */}
        <div className="entry-content" style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div className="entry-title" style={{ marginBottom: '5px' }}>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#0969da',
                textDecoration: 'none',
                fontWeight: 'semibold',
                fontSize: '16px'
              }}
              data-testid={`${entry.type}-link`}
            >
              {isCommit ? commitEntry.message.split('\n')[0] : prEntry.title}
            </a>
          </div>

          {/* Metadata */}
          <div 
            className="entry-metadata" 
            style={{ 
              fontSize: '14px', 
              color: '#656d76',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              flexWrap: 'wrap'
            }}
          >
            {/* Type & ID */}
            <span>
              {isCommit ? (
                <>
                  <strong>{commitEntry.sha.substring(0, 7)}</strong>
                </>
              ) : (
                <>
                  <span 
                    style={{ 
                      color: getStatusColor(prEntry.state),
                      fontWeight: 'bold'
                    }}
                  >
                    #{prEntry.number}
                  </span>
                  <span 
                    style={{ 
                      color: getStatusColor(prEntry.state),
                      marginLeft: '5px',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {prEntry.state}
                  </span>
                </>
              )}
            </span>

            {/* Author */}
            <span>
              by <strong>
                {isCommit ? commitEntry.author.name : prEntry.author.login}
              </strong>
            </span>

            {/* Timestamp */}
            <span>
              {formatDate(isCommit ? commitEntry.timestamp : prEntry.createdAt)}
            </span>

            {/* Labels for PRs */}
            {!isCommit && prEntry.labels.length > 0 && (
              <div className="pr-labels" style={{ display: 'flex', gap: '5px' }}>
                {prEntry.labels.slice(0, 3).map(label => (
                  <span
                    key={label}
                    style={{
                      backgroundColor: '#f1f8ff',
                      color: '#0969da',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      border: '1px solid #d1d9e0'
                    }}
                  >
                    {label}
                  </span>
                ))}
                {prEntry.labels.length > 3 && (
                  <span style={{ fontSize: '12px', color: '#656d76' }}>
                    +{prEntry.labels.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Files changed (if available) */}
          {((isCommit && commitEntry.files) || (!isCommit && prEntry.filesChanged)) && (
            <div 
              className="entry-files" 
              style={{ 
                marginTop: '8px',
                fontSize: '13px',
                color: '#656d76'
              }}
            >
              <strong>Files:</strong>{' '}
              {(isCommit ? commitEntry.files! : prEntry.filesChanged!).slice(0, 3).join(', ')}
              {(isCommit ? commitEntry.files!.length : prEntry.filesChanged!.length) > 3 && 
                ` +${(isCommit ? commitEntry.files!.length : prEntry.filesChanged!.length) - 3} more`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoryView