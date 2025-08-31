import React from 'react';
import type { Issue, FieldOverride } from '../app.types';

interface IssuesPanelProps {
  issues: Issue[];
  fieldOverrides?: FieldOverride[];
  onOverrideIssue?: (issueId: string, reason: string) => void;
  onClearOverride?: (fieldPath: string) => void;
  className?: string;
}

export function IssuesPanel({ 
  issues, 
  fieldOverrides = [], 
  onOverrideIssue, 
  onClearOverride,
  className 
}: IssuesPanelProps) {
  const [expandedIssues, setExpandedIssues] = React.useState<Set<string>>(new Set());
  const [overrideReason, setOverrideReason] = React.useState<{ [issueId: string]: string }>({});

  const toggleIssueExpansion = (issueId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedIssues(newExpanded);
  };

  const getIssueIcon = (type: Issue['type'], severity: Issue['severity']): string => {
    switch (type) {
      case 'error':
        return severity === 'high' ? '🚫' : '❌';
      case 'warning':
        return severity === 'high' ? '⚠️' : '⚡';
      case 'info':
        return '💡';
      default:
        return '❓';
    }
  };

  const getSeverityColor = (severity: Issue['severity']): string => {
    switch (severity) {
      case 'high':
        return '#dc3545'; // Red
      case 'medium':
        return '#fd7e14'; // Orange
      case 'low':
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  };

  const getTypeColor = (type: Issue['type']): string => {
    switch (type) {
      case 'error':
        return '#dc3545';
      case 'warning':
        return '#fd7e14';
      case 'info':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  };

  const getCategoryLabel = (category: Issue['category']): string => {
    switch (category) {
      case 'validation':
        return 'Input Validation';
      case 'constraint':
        return 'Design Constraint';
      case 'optimization':
        return 'Optimization';
      case 'configuration':
        return 'Configuration';
      default:
        return 'General';
    }
  };

  const handleOverrideIssue = (issue: Issue) => {
    const reason = overrideReason[issue.id] || '';
    if (reason.trim() && onOverrideIssue) {
      onOverrideIssue(issue.id, reason.trim());
      setOverrideReason(prev => ({ ...prev, [issue.id]: '' }));
    }
  };

  const groupedIssues = React.useMemo(() => {
    const groups = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as { [key in Issue['type']]: Issue[] });

    // Sort issues within each group by severity (high -> medium -> low)
    Object.keys(groups).forEach(type => {
      groups[type as Issue['type']].sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
    });

    return groups;
  }, [issues]);

  const issueCount = issues.length;
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  const infoCount = issues.filter(i => i.type === 'info').length;
  const overriddenCount = issues.filter(i => i.overridden).length;

  if (issueCount === 0) {
    return (
      <div 
        className={`issues-panel no-issues ${className || ''}`}
        data-testid="issues-panel"
        role="status"
        aria-label="No issues detected"
        style={{
          padding: '1rem',
          border: '2px solid #28a745',
          borderRadius: '8px',
          backgroundColor: '#d4edda',
          marginBottom: '1rem'
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          color: '#155724'
        }}>
          <span aria-hidden="true">✅</span>
          <strong>All Clear</strong>
        </div>
        <p style={{ margin: '0.5rem 0 0 0', color: '#155724' }}>
          No validation issues detected. Configuration is ready for deployment.
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`issues-panel ${className || ''}`}
      data-testid="issues-panel"
      role="region"
      aria-label={`Issues panel with ${issueCount} items`}
      style={{
        border: errorCount > 0 ? '2px solid #dc3545' : '2px solid #fd7e14',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: errorCount > 0 ? '#fff5f5' : '#fff8e1'
      }}
    >
      {/* Panel Header */}
      <div className="issues-panel-header" style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          margin: 0, 
          color: errorCount > 0 ? '#dc3545' : '#fd7e14',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span aria-hidden="true">🔍</span>
          Issues ({issueCount})
        </h3>
        
        {/* Issue Summary */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          margin: '0.5rem 0',
          fontSize: '0.9rem'
        }}>
          {errorCount > 0 && (
            <span style={{ color: '#dc3545' }}>
              <span aria-hidden="true">❌</span> {errorCount} Errors
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ color: '#fd7e14' }}>
              <span aria-hidden="true">⚠️</span> {warningCount} Warnings
            </span>
          )}
          {infoCount > 0 && (
            <span style={{ color: '#17a2b8' }}>
              <span aria-hidden="true">💡</span> {infoCount} Info
            </span>
          )}
          {overriddenCount > 0 && (
            <span style={{ color: '#6c757d' }}>
              <span aria-hidden="true">🔧</span> {overriddenCount} Overridden
            </span>
          )}
        </div>
        
        <p style={{ 
          margin: '0.5rem 0 0 0', 
          fontSize: '0.9rem', 
          color: '#6c757d' 
        }}>
          Review the issues below. Some can be manually overridden if needed.
        </p>
      </div>

      {/* Issues List */}
      <div className="issues-list" role="list">
        {Object.entries(groupedIssues).map(([type, typeIssues]) => (
          <div key={type} className="issue-type-group">
            {/* Type Header */}
            <h4 style={{ 
              margin: '0 0 0.5rem 0',
              color: getTypeColor(type as Issue['type']),
              fontSize: '1rem',
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span aria-hidden="true">
                {getIssueIcon(type as Issue['type'], 'medium')}
              </span>
              {type}s ({typeIssues.length})
            </h4>

            {/* Issues in this type */}
            {typeIssues.map((issue, index) => (
              <div
                key={issue.id}
                className={`issue-item issue-${issue.type} severity-${issue.severity} ${issue.overridden ? 'overridden' : ''}`}
                role="listitem"
                data-testid={`issue-${issue.id}`}
                style={{
                  border: '1px solid #dee2e6',
                  borderLeft: `4px solid ${getSeverityColor(issue.severity)}`,
                  borderRadius: '4px',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  backgroundColor: issue.overridden ? '#f8f9fa' : 'white',
                  opacity: issue.overridden ? 0.7 : 1
                }}
              >
                {/* Issue Header */}
                <div 
                  className="issue-header"
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}
                  onClick={() => toggleIssueExpansion(issue.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleIssueExpansion(issue.id);
                    }
                  }}
                  aria-expanded={expandedIssues.has(issue.id)}
                  aria-controls={`issue-details-${issue.id}`}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '0.25rem'
                    }}>
                      <span aria-hidden="true">
                        {getIssueIcon(issue.type, issue.severity)}
                      </span>
                      <strong style={{ color: getTypeColor(issue.type) }}>
                        {issue.title}
                      </strong>
                      {issue.overridden && (
                        <span 
                          className="override-chip"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: 'bold'
                          }}
                          aria-label="This issue has been manually overridden"
                        >
                          OVERRIDDEN
                        </span>
                      )}
                      <span 
                        className="severity-badge"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.5rem',
                          backgroundColor: getSeverityColor(issue.severity),
                          color: 'white',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        {issue.severity}
                      </span>
                      <span 
                        className="category-badge"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#e9ecef',
                          color: '#495057',
                          borderRadius: '12px',
                          fontWeight: 'normal'
                        }}
                      >
                        {getCategoryLabel(issue.category)}
                      </span>
                    </div>
                    <p style={{ 
                      margin: 0, 
                      color: '#495057',
                      fontSize: '0.9rem'
                    }}>
                      {issue.message}
                    </p>
                  </div>
                  <span 
                    className="expand-icon" 
                    aria-hidden="true"
                    style={{ 
                      marginLeft: '0.5rem',
                      color: '#6c757d'
                    }}
                  >
                    {expandedIssues.has(issue.id) ? '▼' : '▶'}
                  </span>
                </div>

                {/* Expanded Issue Details */}
                {expandedIssues.has(issue.id) && (
                  <div 
                    id={`issue-details-${issue.id}`}
                    className="issue-details"
                    style={{ 
                      borderTop: '1px solid #e9ecef',
                      paddingTop: '0.75rem',
                      marginTop: '0.5rem'
                    }}
                  >
                    {/* Field Information */}
                    {issue.field && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#495057' }}>
                          Related Field:
                        </strong>
                        <code style={{ 
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.25rem',
                          backgroundColor: '#e9ecef',
                          borderRadius: '3px',
                          fontSize: '0.8rem'
                        }}>
                          {issue.field}
                        </code>
                      </div>
                    )}

                    {/* Override Actions */}
                    {issue.overridable && !issue.overridden && onOverrideIssue && (
                      <div 
                        className="override-section"
                        style={{ 
                          padding: '0.75rem',
                          backgroundColor: '#fff3cd',
                          border: '1px solid #ffeaa7',
                          borderRadius: '4px',
                          marginBottom: '0.75rem'
                        }}
                      >
                        <h5 style={{ 
                          margin: '0 0 0.5rem 0',
                          color: '#856404',
                          fontSize: '0.9rem'
                        }}>
                          Manual Override Available
                        </h5>
                        <p style={{ 
                          margin: '0 0 0.75rem 0',
                          fontSize: '0.8rem',
                          color: '#856404'
                        }}>
                          You can manually override this issue if you understand the implications.
                          Please provide a reason for the override.
                        </p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label 
                              htmlFor={`override-reason-${issue.id}`}
                              style={{ 
                                display: 'block',
                                fontSize: '0.8rem',
                                marginBottom: '0.25rem',
                                color: '#495057'
                              }}
                            >
                              Override Reason:
                            </label>
                            <input
                              id={`override-reason-${issue.id}`}
                              type="text"
                              placeholder="Explain why this override is necessary..."
                              value={overrideReason[issue.id] || ''}
                              onChange={(e) => setOverrideReason(prev => ({
                                ...prev,
                                [issue.id]: e.target.value
                              }))}
                              style={{
                                width: '100%',
                                padding: '0.375rem 0.5rem',
                                fontSize: '0.8rem',
                                border: '1px solid #ced4da',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOverrideIssue(issue);
                            }}
                            disabled={!overrideReason[issue.id]?.trim()}
                            style={{
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.8rem',
                              backgroundColor: '#ffc107',
                              color: '#000',
                              border: '1px solid #ffc107',
                              borderRadius: '3px',
                              cursor: overrideReason[issue.id]?.trim() ? 'pointer' : 'not-allowed',
                              opacity: overrideReason[issue.id]?.trim() ? 1 : 0.6
                            }}
                            data-testid={`override-button-${issue.id}`}
                          >
                            Override
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Override Info (if already overridden) */}
                    {issue.overridden && (
                      <div 
                        className="override-info"
                        style={{ 
                          padding: '0.75rem',
                          backgroundColor: '#e9ecef',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          marginBottom: '0.75rem'
                        }}
                      >
                        <h5 style={{ 
                          margin: '0 0 0.5rem 0',
                          color: '#495057',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span aria-hidden="true">🔧</span>
                          Override Applied
                        </h5>
                        <p style={{ 
                          margin: '0',
                          fontSize: '0.8rem',
                          color: '#6c757d'
                        }}>
                          This issue has been manually overridden and will not prevent deployment.
                        </p>
                        {onClearOverride && issue.field && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onClearOverride(issue.field!);
                            }}
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: 'transparent',
                              color: '#dc3545',
                              border: '1px solid #dc3545',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                            data-testid={`clear-override-${issue.id}`}
                          >
                            Clear Override
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Panel Footer */}
      {(errorCount > 0 || (warningCount > 0 && overriddenCount < warningCount)) && (
        <div 
          className="issues-panel-footer"
          style={{ 
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e9ecef'
          }}
        >
          <p style={{ 
            margin: 0,
            fontSize: '0.85rem',
            color: '#6c757d',
            fontStyle: 'italic'
          }}>
            {errorCount > 0 
              ? `❌ ${errorCount} error(s) must be resolved or overridden before saving.`
              : `⚠️ ${warningCount - overriddenCount} warning(s) should be reviewed before saving.`
            }
          </p>
        </div>
      )}

      <style>{`
        .issues-panel .issue-item:last-child {
          margin-bottom: 0;
        }
        
        .issues-panel .issue-header:hover {
          background-color: rgba(0, 123, 255, 0.05);
        }
        
        .issues-panel .issue-header:focus {
          outline: 2px solid #007bff;
          outline-offset: -2px;
        }
        
        .issues-panel .overridden {
          background-color: #f8f9fa !important;
        }
        
        .issues-panel .override-chip {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        
        .issues-panel .issue-type-group:not(:last-child) {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e9ecef;
        }
      `}</style>
    </div>
  );
}