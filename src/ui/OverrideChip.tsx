import React from 'react';
import type { FieldOverride } from '../app.types';
import { useUserMode } from '../contexts/UserModeContext';

interface OverrideChipProps {
  fieldPath: string;
  fieldOverrides: FieldOverride[];
  onClearOverride?: (fieldPath: string) => void;
  size?: 'small' | 'medium';
  variant?: 'inline' | 'tooltip';
  className?: string;
  forceVisible?: boolean; // Override user mode settings
}

export function OverrideChip({ 
  fieldPath, 
  fieldOverrides, 
  onClearOverride,
  size = 'small',
  variant = 'inline',
  className,
  forceVisible = false
}: OverrideChipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const { isExpert } = useUserMode();
  
  const override = fieldOverrides.find(o => o.fieldPath === fieldPath);
  
  if (!override) {
    return null;
  }
  
  // Only show override chips in expert mode (unless forceVisible is true)
  if (!forceVisible && !isExpert) {
    return null;
  }

  const chipStyles = {
    small: {
      fontSize: '0.65rem',
      padding: '0.125rem 0.375rem',
      height: '18px'
    },
    medium: {
      fontSize: '0.75rem',
      padding: '0.25rem 0.5rem',
      height: '22px'
    }
  };

  const chipStyle = {
    ...chipStyles[size],
    backgroundColor: '#ff6b35',
    color: 'white',
    borderRadius: '10px',
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    cursor: variant === 'tooltip' ? 'pointer' : 'default',
    border: 'none',
    outline: 'none',
    position: 'relative',
    animation: 'pulse-orange 2s infinite'
  } as React.CSSProperties;

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleChipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (variant === 'tooltip') {
      setShowTooltip(!showTooltip);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (variant === 'tooltip') {
        setShowTooltip(!showTooltip);
      }
    }
  };

  const handleClearOverride = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearOverride) {
      onClearOverride(fieldPath);
    }
    setShowTooltip(false);
  };

  return (
    <div 
      className={`override-chip-container ${className || ''}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <span
        className="override-chip"
        style={chipStyle}
        onClick={handleChipClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Override active for ${fieldPath}. ${override.reason}`}
        data-testid={`override-chip-${fieldPath.replace(/\./g, '-')}`}
        onMouseEnter={() => variant === 'tooltip' && setShowTooltip(true)}
        onMouseLeave={() => variant === 'tooltip' && setShowTooltip(false)}
      >
        <span aria-hidden="true">🔧</span>
        <span>Override Active</span>
      </span>

      {/* Tooltip */}
      {variant === 'tooltip' && showTooltip && (
        <div
          className="override-tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '0.25rem',
            padding: '0.75rem',
            backgroundColor: '#343a40',
            color: 'white',
            borderRadius: '6px',
            fontSize: '0.8rem',
            minWidth: '200px',
            maxWidth: '300px',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
          role="tooltip"
          aria-hidden="false"
        >
          {/* Tooltip Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '6px solid #343a40'
            }}
          />
          
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Field Override</strong>
          </div>
          
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ color: '#adb5bd', fontSize: '0.75rem' }}>Field:</div>
            <code style={{ 
              backgroundColor: '#495057', 
              padding: '0.125rem 0.25rem', 
              borderRadius: '3px',
              fontSize: '0.7rem'
            }}>
              {fieldPath}
            </code>
          </div>
          
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ color: '#adb5bd', fontSize: '0.75rem' }}>Reason:</div>
            <div style={{ fontSize: '0.75rem' }}>{override.reason}</div>
          </div>
          
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ color: '#adb5bd', fontSize: '0.75rem' }}>Applied:</div>
            <div style={{ fontSize: '0.75rem' }}>
              {formatDate(override.overriddenAt)} by {override.overriddenBy}
            </div>
          </div>
          
          {override.originalValue !== undefined && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ color: '#adb5bd', fontSize: '0.75rem' }}>Original → Current:</div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                <span style={{ color: '#dc3545' }}>{String(override.originalValue)}</span>
                {' → '}
                <span style={{ color: '#28a745' }}>{String(override.overriddenValue)}</span>
              </div>
            </div>
          )}
          
          {onClearOverride && (
            <div style={{ 
              paddingTop: '0.5rem', 
              borderTop: '1px solid #495057',
              textAlign: 'center'
            }}>
              <button
                onClick={handleClearOverride}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                data-testid={`clear-override-tooltip-${fieldPath.replace(/\./g, '-')}`}
              >
                Clear Override
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-orange {
          0% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.8; transform: scale(1); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        
        .override-chip:hover {
          background-color: #e55a2b !important;
          transform: scale(1.05);
        }
        
        .override-chip:focus {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

// Helper component to easily add override indicators to form fields
interface FieldWithOverrideProps {
  fieldPath: string;
  fieldOverrides: FieldOverride[];
  onClearOverride?: (fieldPath: string) => void;
  children: React.ReactNode;
  labelPosition?: 'inline' | 'above';
  forceVisible?: boolean; // Override user mode settings
}

export function FieldWithOverride({
  fieldPath,
  fieldOverrides,
  onClearOverride,
  children,
  labelPosition = 'inline',
  forceVisible = false
}: FieldWithOverrideProps) {
  const override = fieldOverrides.find(o => o.fieldPath === fieldPath);
  
  if (!override) {
    return <>{children}</>;
  }

  return (
    <div 
      className="field-with-override"
      style={{ position: 'relative' }}
      data-testid={`field-with-override-${fieldPath.replace(/\./g, '-')}`}
    >
      {children}
      <div 
        style={{ 
          display: labelPosition === 'inline' ? 'inline-block' : 'block',
          marginLeft: labelPosition === 'inline' ? '0.5rem' : '0',
          marginTop: labelPosition === 'above' ? '0.25rem' : '0'
        }}
      >
        <OverrideChip
          fieldPath={fieldPath}
          fieldOverrides={fieldOverrides}
          onClearOverride={onClearOverride}
          variant="tooltip"
          size="small"
          forceVisible={forceVisible}
        />
      </div>
    </div>
  );
}