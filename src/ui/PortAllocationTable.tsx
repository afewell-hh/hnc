import React, { useState } from 'react';
import type { AllocationResult, ExtendedAllocationResult, LeafClass } from '../app.types';

interface PortAllocationTableProps {
  allocationResult?: AllocationResult;
  extendedAllocationResult?: ExtendedAllocationResult;
  spinesNeeded: number;
  leafClasses?: LeafClass[]; // For multi-class mode
  isMultiClassMode?: boolean;
}

export function PortAllocationTable({ 
  allocationResult, 
  extendedAllocationResult,
  spinesNeeded, 
  leafClasses = [],
  isMultiClassMode = false 
}: PortAllocationTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  // Determine which data to use
  const useExtended = isMultiClassMode && extendedAllocationResult;
  
  // Early return if no data
  if (!useExtended && (!allocationResult || allocationResult.leafMaps.length === 0)) {
    return null;
  }
  
  if (useExtended && (!extendedAllocationResult || extendedAllocationResult.leafClassAllocations.length === 0)) {
    return null;
  }

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
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

  const getLeafClassInfo = (classId: string) => {
    return leafClasses.find(lc => lc.id === classId) || {
      id: classId,
      name: classId,
      role: 'standard' as const,
      uplinksPerLeaf: 2
    };
  };

  // Render single allocation table (for legacy or per-class)
  const renderAllocationTable = (
    leafMaps: any[], 
    sectionId: string, 
    title: string, 
    subtitle?: string,
    leafClassInfo?: any
  ) => {
    const isExpanded = expandedSections.has(sectionId);
    const totalUplinks = leafMaps.length > 0 
      ? leafMaps[0].uplinks.length * leafMaps.length 
      : 0;

    return (
      <div 
        key={sectionId}
        data-testid={`port-allocation-${sectionId}`}
        style={{ 
          border: '1px solid #ccc', 
          padding: '1rem', 
          marginBottom: '1rem',
          borderRadius: '4px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {title} ({totalUplinks} uplinks across {spinesNeeded} spines)
            </h3>
            {subtitle && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                {subtitle}
              </p>
            )}
            {leafClassInfo && (
              <div style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                <span>Role: <strong>{leafClassInfo.role}</strong></span>
                {leafClassInfo.leafModelId && (
                  <span style={{ marginLeft: '1rem' }}>
                    Model: <strong>{leafClassInfo.leafModelId}</strong>
                  </span>
                )}
                <span style={{ marginLeft: '1rem' }}>
                  Uplinks: <strong>{leafClassInfo.uplinksPerLeaf}</strong>
                </span>
                {leafClassInfo.count && (
                  <span style={{ marginLeft: '1rem' }}>
                    Count: <strong>{leafClassInfo.count}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => toggleSection(sectionId)}
            aria-expanded={isExpanded}
            aria-controls={`allocation-table-${sectionId}`}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            data-testid={`toggle-${sectionId}`}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {isExpanded && (
          <div id={`allocation-table-${sectionId}`} role="region" aria-label={`${title} allocation details`}>
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table 
                style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}
                role="table"
                aria-label={`Port allocation for ${title}`}
              >
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th 
                      style={{ textAlign: 'left', padding: '0.5rem', borderRight: '1px solid #ccc' }}
                      scope="col"
                    >
                      Leaf ID
                    </th>
                    {Array.from({ length: spinesNeeded }, (_, i) => (
                      <th 
                        key={i} 
                        style={{ textAlign: 'left', padding: '0.5rem', borderRight: '1px solid #ccc' }}
                        scope="col"
                      >
                        To Spine {i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leafMaps.map((leafAllocation) => {
                    const uplinksBySpine = getUplinksBySpine(leafAllocation);
                    
                    return (
                      <tr 
                        key={leafAllocation.leafId} 
                        style={{ borderBottom: '1px solid #eee' }}
                        data-testid={`leaf-${leafAllocation.leafId}-allocation`}
                      >
                        <th 
                          scope="row"
                          style={{ padding: '0.5rem', borderRight: '1px solid #ccc', fontWeight: 'bold' }}
                        >
                          {leafAllocation.leafId}
                        </th>
                        {Array.from({ length: spinesNeeded }, (_, spineId) => (
                          <td 
                            key={spineId} 
                            style={{ padding: '0.5rem', borderRight: '1px solid #ccc' }}
                            data-testid={`leaf-${leafAllocation.leafId}-spine-${spineId}`}
                          >
                            {uplinksBySpine[spineId].join(', ') || '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Multi-class mode rendering
  if (useExtended && extendedAllocationResult) {
    const spineUtilization = extendedAllocationResult.spineUtilization;
    
    return (
      <div data-testid="port-allocation-multi-class" role="region" aria-label="Multi-class port allocation">
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Port Allocation by Leaf Class</h2>
          <div style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
            <strong>Overall Spine Utilization:</strong> {' '}
            {spineUtilization.map((utilization, index) => (
              <span key={index}>
                Spine {index}: {utilization}/{Math.max(...spineUtilization) + 24} ports
                {index < spineUtilization.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>

        {extendedAllocationResult.leafClassAllocations.map((classAllocation) => {
          const leafClassInfo = getLeafClassInfo(classAllocation.classId);
          const subtitle = `${classAllocation.totalEndpoints} endpoints • ${classAllocation.utilizationPercent.toFixed(1)}% utilization`;
          
          return renderAllocationTable(
            classAllocation.leafMaps,
            classAllocation.classId,
            leafClassInfo.name || classAllocation.classId,
            subtitle,
            leafClassInfo
          );
        })}
      </div>
    );
  }

  // Legacy single-class mode rendering
  if (allocationResult) {
    const totalUplinks = allocationResult.leafMaps.length > 0 
      ? allocationResult.leafMaps[0].uplinks.length * allocationResult.leafMaps.length 
      : 0;

    return renderAllocationTable(
      allocationResult.leafMaps,
      'all',
      'Port Allocation',
      `Legacy single-class mode • ${totalUplinks} total uplinks`
    );
  }

  return null;
}