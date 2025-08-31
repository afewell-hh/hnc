import React from 'react';
import type { Issue, FieldOverride } from '../app.types';
import type { ImportConflict, ConflictResolutionAction } from '../domain/import-conflict-resolver';

interface IssuesPanelProps {
  issues: Issue[];
  fieldOverrides?: FieldOverride[];
  importConflicts?: ImportConflict[];
  onOverrideIssue?: (issueId: string, reason: string) => void;
  onClearOverride?: (fieldPath: string) => void;
  onResolveImportConflict?: (conflictId: string, actionType: 'accept' | 'reject' | 'modify', modifyValue?: any) => void;
  className?: string;
}

export function IssuesPanel({ 
  issues, 
  fieldOverrides = [],
  importConflicts = [],
  onOverrideIssue, 
  onClearOverride,
  onResolveImportConflict,
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
  const importConflictCount = importConflicts.length;
  const unresolvedConflictCount = importConflicts.filter(c => !c.overridden).length;

  if (issueCount === 0 && importConflictCount === 0) {
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
          {importConflictCount > 0 && (
            <span style={{ color: '#e83e8c' }}>
              <span aria-hidden="true">⚡</span> {unresolvedConflictCount}/{importConflictCount} Import Conflicts
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

      {/* Import Conflicts Section */}
      {importConflicts.length > 0 && (
        <div className="import-conflicts-section" style={{ marginBottom: '1rem' }}>
          <h4 style={{ 
            margin: '0 0 0.75rem 0',
            color: '#e83e8c',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid #e83e8c'
          }}>
            <span aria-hidden="true">⚡</span>
            Import Conflicts ({unresolvedConflictCount} unresolved)
          </h4>
          
          {importConflicts.map((conflict, index) => (
            <ImportConflictItem
              key={conflict.id}
              conflict={conflict}
              onResolve={onResolveImportConflict}
            />
          ))}
        </div>
      )}

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
                            backgroundColor: issue.category === 'import-conflict' ? '#e83e8c' : '#6c757d',
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: 'bold'
                          }}
                          aria-label={issue.category === 'import-conflict' ? 'This import conflict has been resolved' : 'This issue has been manually overridden'}
                        >
                          {issue.category === 'import-conflict' ? 'IMPORT RESOLVED' : 'OVERRIDDEN'}
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

/**
 * Component for rendering individual import conflicts with resolution actions
 */
interface ImportConflictItemProps {
  conflict: ImportConflict;
  onResolve?: (conflictId: string, actionType: 'accept' | 'reject' | 'modify', modifyValue?: any) => void;
}

function ImportConflictItem({ conflict, onResolve }: ImportConflictItemProps) {
  const [modifyValue, setModifyValue] = React.useState<string>('');
  const [selectedAction, setSelectedAction] = React.useState<'accept' | 'reject' | 'modify' | null>(null);

  const getConflictTypeIcon = (conflictType: string): string => {
    switch (conflictType) {
      case 'value': return '🔄';
      case 'capacity': return '📊';
      case 'constraint': return '⚠️';
      case 'topology': return '🔗';
      case 'model': return '🔧';
      default: return '⚡';
    }
  };

  const getConflictTypeColor = (conflictType: string): string => {
    switch (conflictType) {
      case 'value': return '#007bff';
      case 'capacity': return '#dc3545';
      case 'constraint': return '#ffc107';
      case 'topology': return '#17a2b8';
      case 'model': return '#6f42c1';
      default: return '#e83e8c';
    }
  };

  const handleResolve = (actionType: 'accept' | 'reject' | 'modify') => {
    if (!onResolve) return;
    
    if (actionType === 'modify' && !modifyValue.trim()) {
      return; // Don't resolve without a modify value
    }
    
    onResolve(
      conflict.id, 
      actionType, 
      actionType === 'modify' ? modifyValue.trim() : undefined
    );
  };

  if (conflict.overridden) {
    // Show resolved state
    return (
      <div 
        className="import-conflict-resolved"
        style={{
          border: '1px solid #28a745',
          borderLeft: '4px solid #28a745',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '0.75rem',
          backgroundColor: '#d4edda',
          opacity: 0.8
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.5rem',
          color: '#155724'
        }}>
          <span aria-hidden="true">✅</span>
          <strong>{conflict.title}</strong>
          <span 
            className="resolved-chip"
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          >
            RESOLVED
          </span>
        </div>
        <p style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.9rem', color: '#155724' }}>
          {conflict.message}
        </p>
      </div>
    );
  }

  return (
    <div 
      className="import-conflict-item"
      data-testid={`import-conflict-${conflict.id}`}
      style={{
        border: '1px solid #dee2e6',
        borderLeft: `4px solid ${getConflictTypeColor(conflict.importMetadata.conflictType)}`,
        borderRadius: '4px',
        padding: '1rem',
        marginBottom: '0.75rem',
        backgroundColor: 'white'
      }}
    >
      {/* Conflict Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.25rem'
        }}>
          <span aria-hidden="true">
            {getConflictTypeIcon(conflict.importMetadata.conflictType)}
          </span>
          <strong style={{ color: getConflictTypeColor(conflict.importMetadata.conflictType) }}>
            {conflict.title}
          </strong>
          <span 
            className="conflict-type-badge"
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: getConflictTypeColor(conflict.importMetadata.conflictType),
              color: 'white',
              borderRadius: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}
          >
            {conflict.importMetadata.conflictType}
          </span>
          <span 
            className="confidence-badge"
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: conflict.importMetadata.confidence === 'high' ? '#28a745' : 
                             conflict.importMetadata.confidence === 'medium' ? '#ffc107' : '#6c757d',
              color: 'white',
              borderRadius: '12px'
            }}
          >
            {conflict.importMetadata.confidence} confidence
          </span>
        </div>
        
        <p style={{ 
          margin: 0, 
          color: '#495057',
          fontSize: '0.9rem'
        }}>
          {conflict.message}
        </p>
        
        {/* Value Comparison */}
        <div style={{ 
          display: 'flex',
          gap: '1rem',
          margin: '0.75rem 0',
          padding: '0.75rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '0.85rem'
        }}>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#dc3545' }}>Imported:</strong>
            <br />
            <code style={{ 
              backgroundColor: '#fff5f5',
              padding: '0.25rem',
              borderRadius: '3px',
              border: '1px solid #f5c6cb'
            }}>
              {JSON.stringify(conflict.importMetadata.importedValue)}
            </code>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#007bff' }}>Current:</strong>
            <br />
            <code style={{ 
              backgroundColor: '#f8f9ff',
              padding: '0.25rem',
              borderRadius: '3px',
              border: '1px solid #b8c6f0'
            }}>
              {JSON.stringify(conflict.importMetadata.computedValue)}
            </code>
          </div>
        </div>
      </div>

      {/* Resolution Actions */}
      <div className="conflict-resolution-actions">
        <h5 style={{ 
          margin: '0 0 0.5rem 0',
          color: '#495057',
          fontSize: '0.9rem'
        }}>
          Choose Resolution:
        </h5>
        
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {conflict.resolutionActions.map((action, actionIndex) => (
            <div 
              key={actionIndex}
              className="resolution-action"
              style={{
                border: selectedAction === action.type ? '2px solid #007bff' : '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '0.75rem',
                backgroundColor: selectedAction === action.type ? '#f8f9ff' : 'white',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedAction(action.type)}
            >
              <div style={{ 
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <input
                  type="radio"
                  name={`conflict-action-${conflict.id}`}
                  checked={selectedAction === action.type}
                  onChange={() => setSelectedAction(action.type)}
                  style={{ marginTop: '0.125rem' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.85rem' }}>
                    {action.label}
                  </strong>
                  <p style={{ 
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.8rem',
                    color: '#6c757d'
                  }}>
                    {action.description}
                  </p>
                  
                  {action.type === 'modify' && selectedAction === 'modify' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter new value..."
                        value={modifyValue}
                        onChange={(e) => setModifyValue(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.8rem',
                          border: '1px solid #ced4da',
                          borderRadius: '3px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  
                  {action.affectedFields.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                        Will affect: {action.affectedFields.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Resolve Button */}
        <div style={{ 
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => {
              if (selectedAction) {
                handleResolve(selectedAction);
              }
            }}
            disabled={!selectedAction || (selectedAction === 'modify' && !modifyValue.trim())}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              backgroundColor: selectedAction ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedAction && (selectedAction !== 'modify' || modifyValue.trim()) ? 'pointer' : 'not-allowed',
              opacity: selectedAction && (selectedAction !== 'modify' || modifyValue.trim()) ? 1 : 0.6
            }}
            data-testid={`resolve-conflict-${conflict.id}`}
          >
            Resolve Conflict
          </button>
        </div>
      </div>
    </div>
  );
}