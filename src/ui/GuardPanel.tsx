import React from 'react';
import type { FabricGuard, ESLAGGuard, MCLAGGuard } from '../app.types';

interface GuardPanelProps {
  guards: FabricGuard[];
}

export function GuardPanel({ guards }: GuardPanelProps) {
  if (!guards || guards.length === 0) {
    return null;
  }

  const getGuardIcon = (guardType: string): string => {
    switch (guardType) {
      case 'ES_LAG_INVALID':
        return '⚠️';
      case 'MC_LAG_ODD_LEAF_COUNT':
        return '🔗';
      default:
        return '❌';
    }
  };

  const getGuardSeverity = (guardType: string): 'error' | 'warning' => {
    // All current guard types are errors that prevent valid topology
    return 'error';
  };

  const renderESLAGGuard = (guard: ESLAGGuard) => (
    <div className="guard-item" role="alert" aria-live="polite">
      <div className="guard-header">
        <span className="guard-icon" aria-hidden="true">{getGuardIcon(guard.guardType)}</span>
        <span className="guard-type">ES-LAG Constraint Violation</span>
      </div>
      <div className="guard-message">{guard.message}</div>
      <div className="guard-details">
        <strong>Class:</strong> {guard.details.leafClassId}<br/>
        <strong>Profile:</strong> {guard.details.profileName}<br/>
        <strong>Required NICs:</strong> {guard.details.requiredNics}<br/>
        <strong>Actual NICs:</strong> {guard.details.actualNics}
      </div>
      <div className="guard-guidance">
        💡 <strong>Action needed:</strong> Update the endpoint profile to have at least {guard.details.requiredNics} NICs 
        or disable ES-LAG for this profile.
      </div>
    </div>
  );

  const renderMCLAGGuard = (guard: MCLAGGuard) => (
    <div className="guard-item" role="alert" aria-live="polite">
      <div className="guard-header">
        <span className="guard-icon" aria-hidden="true">{getGuardIcon(guard.guardType)}</span>
        <span className="guard-type">MC-LAG Constraint Violation</span>
      </div>
      <div className="guard-message">{guard.message}</div>
      <div className="guard-details">
        <strong>Class ID:</strong> {guard.details.classId}<br/>
        <strong>Leaf Count:</strong> {guard.details.leafCount}<br/>
        <strong>MC-LAG Enabled:</strong> {guard.details.mcLagEnabled ? 'Yes' : 'No'}
      </div>
      <div className="guard-guidance">
        💡 <strong>Action needed:</strong> MC-LAG requires an even number of leaves. 
        Adjust the endpoint count or disable MC-LAG for this class.
      </div>
    </div>
  );

  const renderGuard = (guard: FabricGuard, index: number) => {
    const baseProps = {
      key: index,
      'data-testid': `guard-${guard.guardType.toLowerCase()}-${index}`,
      className: `guard-violation guard-severity-${getGuardSeverity(guard.guardType)}`
    };

    switch (guard.guardType) {
      case 'ES_LAG_INVALID':
        return <div {...baseProps}>{renderESLAGGuard(guard as ESLAGGuard)}</div>;
      case 'MC_LAG_ODD_LEAF_COUNT':
        return <div {...baseProps}>{renderMCLAGGuard(guard as MCLAGGuard)}</div>;
      default:
        return (
          <div {...baseProps} role="alert" aria-live="polite">
            <div className="guard-item">
              <div className="guard-header">
                <span className="guard-icon" aria-hidden="true">{getGuardIcon((guard as any).guardType)}</span>
                <span className="guard-type">Unknown Constraint Violation</span>
              </div>
              <div className="guard-message">{(guard as any).message}</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="guard-panel"
      data-testid="guard-panel"
      role="region"
      aria-label="Fabric constraint violations"
      style={{
        border: '2px solid #dc3545',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: '#fff5f5'
      }}
    >
      <div className="guard-panel-header" style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          margin: 0, 
          color: '#dc3545',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span aria-hidden="true">🛡️</span>
          Constraint Violations ({guards.length})
        </h3>
        <p style={{ 
          margin: '0.5rem 0 0 0', 
          fontSize: '0.9rem', 
          color: '#6c757d' 
        }}>
          The following constraints must be resolved before the topology can be saved:
        </p>
      </div>

      <div className="guard-list" role="list">
        {guards.map(renderGuard)}
      </div>

      <style>{`
        .guard-item {
          padding: 1rem;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          background: white;
        }
        
        .guard-severity-error {
          border-left: 4px solid #dc3545;
        }
        
        .guard-severity-warning {
          border-left: 4px solid #ffc107;
        }
        
        .guard-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        
        .guard-icon {
          font-size: 1.2rem;
        }
        
        .guard-type {
          color: #dc3545;
        }
        
        .guard-message {
          margin-bottom: 0.5rem;
          color: #495057;
        }
        
        .guard-details {
          font-size: 0.9rem;
          color: #6c757d;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }
        
        .guard-guidance {
          font-size: 0.9rem;
          padding: 0.5rem;
          background-color: #e7f3ff;
          border: 1px solid #b6d7ff;
          border-radius: 4px;
          color: #004085;
        }
        
        .guard-list > div:last-child .guard-item {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}