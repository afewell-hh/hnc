import React, { useState } from 'react';
import type { AllocationResult } from '../app.types';

interface PortAllocationTableProps {
  allocationResult: AllocationResult;
  spinesNeeded: number;
}

export function PortAllocationTable({ allocationResult, spinesNeeded }: PortAllocationTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!allocationResult || allocationResult.leafMaps.length === 0) {
    return null;
  }

  const totalUplinks = allocationResult.leafMaps.length > 0 
    ? allocationResult.leafMaps[0].uplinks.length * allocationResult.leafMaps.length 
    : 0;

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getUplinksBySpine = (leafAllocation: any) => {
    const uplinksBySpine: { [spineId: number]: string[] } = {};
    
    // Initialize empty arrays for each spine
    for (let i = 0; i < spinesNeeded; i++) {
      uplinksBySpine[i] = [];
    }
    
    // Group uplinks by spine
    leafAllocation.uplinks.forEach((uplink: any) => {
      uplinksBySpine[uplink.toSpine].push(uplink.port);
    });
    
    return uplinksBySpine;
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>
          Port Allocation ({totalUplinks} uplinks across {spinesNeeded} spines)
        </h3>
        <button
          onClick={toggleExpanded}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderRight: '1px solid #ccc' }}>
                    Leaf ID
                  </th>
                  {Array.from({ length: spinesNeeded }, (_, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '0.5rem', borderRight: '1px solid #ccc' }}>
                      To Spine {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocationResult.leafMaps.map((leafAllocation) => {
                  const uplinksBySpine = getUplinksBySpine(leafAllocation);
                  
                  return (
                    <tr key={leafAllocation.leafId} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', borderRight: '1px solid #ccc', fontWeight: 'bold' }}>
                        {leafAllocation.leafId}
                      </td>
                      {Array.from({ length: spinesNeeded }, (_, spineId) => (
                        <td key={spineId} style={{ padding: '0.5rem', borderRight: '1px solid #ccc' }}>
                          {uplinksBySpine[spineId].join(', ') || '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
            <strong>Spine Utilization:</strong> {' '}
            {allocationResult.spineUtilization.map((utilization, index) => (
              <span key={index}>
                Spine {index}: {utilization}/{allocationResult.spineUtilization.reduce((max, current) => Math.max(max, current), 0) + 24} ports
                {index < allocationResult.spineUtilization.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}