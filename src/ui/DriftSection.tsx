import { useEffect, useState } from 'react';
import { checkDrift, DriftResult } from '../services/drift.service';

interface DriftSectionProps {
  fabricId: string;
  driftStatus?: any; // Legacy prop - not used in new implementation
  onRefreshDrift?: () => void; // Legacy prop - not used in new implementation  
  isRefreshing?: boolean; // Legacy prop - not used in new implementation
  onShowDetails?: () => void; // Legacy prop - not used in new implementation
}

export function DriftSection({ fabricId }: DriftSectionProps) {
  const [res, setRes] = useState<DriftResult | null>(null);

  useEffect(() => {
    let alive = true;
    
    checkDrift()
      .then(r => alive && setRes(r))
      .catch(() => alive && setRes({ enabled: false, items: [] }));
    
    return () => { 
      alive = false; 
    };
  }, [fabricId]);

  // Loading state - provides anchor for tests
  if (!res) {
    return <div data-testid="drift-ready" />;
  }

  // Disabled state (browser/Storybook) - but still provide drift-ready anchor for tests
  if (!res.enabled) {
    return <div data-testid="drift-ready" />;
  }

  // Active state - render with safe array access
  const items = res?.items ?? [];

  return (
    <div data-testid="drift-section" style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, color: '#666' }}>Drift Status</h4>
      </div>
      
      <div style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
        {items.length === 0 ? (
          <em>No drift detected</em>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
            {items.map(item => (
              <li key={item.id}>{item.path}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}