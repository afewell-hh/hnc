import React from 'react';

interface AllocationErrorsProps {
  issues: string[];
}

export function AllocationErrors({ issues }: AllocationErrorsProps) {
  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      backgroundColor: '#fee', 
      border: '1px solid #fcc', 
      padding: '1rem', 
      marginBottom: '1rem',
      borderRadius: '4px' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ color: '#c33', marginRight: '0.5rem', fontSize: '1.2rem' }}>❌</span>
        <h4 style={{ margin: 0, color: '#c33' }}>Port Allocation Failed</h4>
      </div>
      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: '#800' }}>
        {issues.map((issue, index) => (
          <li key={index} style={{ marginBottom: '0.25rem' }}>
            {issue}
          </li>
        ))}
      </ul>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
        Cannot generate port allocation table
      </p>
    </div>
  );
}