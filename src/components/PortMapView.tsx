/**
 * WP-PIN1 Port Map View Component
 * Visual representation of switch frontplate with port pinning capabilities
 */

import React, { useState, useCallback, useMemo } from 'react'
import type {
  PortAssignment,
  PortMapLayout,
  PortGroup,
  BreakoutGroup,
  AssignableRange,
  PinResult,
  LockResult
} from '../types/port-assignment.types'

export interface PortMapProps {
  switchModel: string
  currentAssignments: PortAssignment[]
  assignableRanges: AssignableRange[]
  breakoutConfiguration: Map<string, { parentSpeed: string; childSpeed: string; childCount: number }>
  onPortPin: (port: string, assignment: PortAssignment) => Promise<PinResult>
  onPortLock: (port: string, locked: boolean) => Promise<LockResult>
  onPortSelect?: (port: string) => void
  selectedPort?: string
  readOnly?: boolean
  showPortLabels?: boolean
  compactView?: boolean
}

export const PortMapView: React.FC<PortMapProps> = ({
  switchModel,
  currentAssignments,
  assignableRanges,
  breakoutConfiguration,
  onPortPin,
  onPortLock,
  onPortSelect,
  selectedPort,
  readOnly = false,
  showPortLabels = true,
  compactView = false
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [loading, setLoading] = useState<Set<string>>(new Set())
  
  // Create assignment lookup map for performance
  const assignmentMap = useMemo(() => 
    new Map(currentAssignments.map(a => [a.portId, a])),
    [currentAssignments]
  )

  // Generate port layout based on switch model
  const portLayout = useMemo((): PortMapLayout => {
    switch (switchModel) {
      case 'DS2000':
        return {
          accessPorts: [
            { name: 'Access 1-12', portIds: Array.from({length: 12}, (_, i) => `${i + 1}`), type: 'access', startIndex: 0, endIndex: 11 },
            { name: 'Access 13-24', portIds: Array.from({length: 12}, (_, i) => `${i + 13}`), type: 'access', startIndex: 12, endIndex: 23 },
            { name: 'Access 25-36', portIds: Array.from({length: 12}, (_, i) => `${i + 25}`), type: 'access', startIndex: 24, endIndex: 35 },
            { name: 'Access 37-48', portIds: Array.from({length: 12}, (_, i) => `${i + 37}`), type: 'access', startIndex: 36, endIndex: 47 }
          ],
          uplinkPorts: [
            { name: 'Uplinks 49-52', portIds: ['49', '50', '51', '52'], type: 'uplink', startIndex: 48, endIndex: 51 }
          ],
          breakoutPorts: [
            { 
              name: 'Breakout 49', portIds: ['49', '49-1', '49-2', '49-3', '49-4'], type: 'breakout', 
              startIndex: 48, endIndex: 48, parentPort: '49', childPorts: ['49-1', '49-2', '49-3', '49-4'], 
              breakoutCapable: true, currentConfig: breakoutConfiguration.get('49') ? { ...breakoutConfiguration.get('49')!, enabled: true } : undefined
            },
            { 
              name: 'Breakout 50', portIds: ['50', '50-1', '50-2', '50-3', '50-4'], type: 'breakout',
              startIndex: 49, endIndex: 49, parentPort: '50', childPorts: ['50-1', '50-2', '50-3', '50-4'], 
              breakoutCapable: true, currentConfig: breakoutConfiguration.get('50') ? { ...breakoutConfiguration.get('50')!, enabled: true } : undefined
            },
            { 
              name: 'Breakout 51', portIds: ['51', '51-1', '51-2', '51-3', '51-4'], type: 'breakout',
              startIndex: 50, endIndex: 50, parentPort: '51', childPorts: ['51-1', '51-2', '51-3', '51-4'], 
              breakoutCapable: true, currentConfig: breakoutConfiguration.get('51') ? { ...breakoutConfiguration.get('51')!, enabled: true } : undefined
            },
            { 
              name: 'Breakout 52', portIds: ['52', '52-1', '52-2', '52-3', '52-4'], type: 'breakout',
              startIndex: 51, endIndex: 51, parentPort: '52', childPorts: ['52-1', '52-2', '52-3', '52-4'], 
              breakoutCapable: true, currentConfig: breakoutConfiguration.get('52') ? { ...breakoutConfiguration.get('52')!, enabled: true } : undefined
            }
          ],
          totalPorts: 52
        }
      case 'DS3000':
        return {
          accessPorts: [],
          uplinkPorts: [
            { name: 'Spine 1-16', portIds: Array.from({length: 16}, (_, i) => `${i + 1}`), type: 'uplink', startIndex: 0, endIndex: 15 },
            { name: 'Spine 17-32', portIds: Array.from({length: 16}, (_, i) => `${i + 17}`), type: 'uplink', startIndex: 16, endIndex: 31 }
          ],
          breakoutPorts: [],
          totalPorts: 32
        }
      default:
        return {
          accessPorts: [],
          uplinkPorts: [
            { name: 'Generic Ports', portIds: Array.from({length: 24}, (_, i) => `${i + 1}`), type: 'uplink', startIndex: 0, endIndex: 23 }
          ],
          breakoutPorts: [],
          totalPorts: 24
        }
    }
  }, [switchModel, breakoutConfiguration])

  // Handle port pin operation
  const handlePortPin = useCallback(async (portId: string, assignment: PortAssignment) => {
    if (readOnly) return
    
    setLoading(prev => new Set(prev).add(portId))
    try {
      const result = await onPortPin(portId, assignment)
      return result
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(portId)
        return newSet
      })
    }
  }, [onPortPin, readOnly])

  // Handle port lock operation
  const handlePortLock = useCallback(async (portId: string, locked: boolean) => {
    if (readOnly) return
    
    setLoading(prev => new Set(prev).add(portId))
    try {
      const result = await onPortLock(portId, locked)
      return result
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(portId)
        return newSet
      })
    }
  }, [onPortLock, readOnly])

  // Render individual port cell
  const renderPortCell = (portId: string) => {
    const assignment = assignmentMap.get(portId)
    const isSelected = selectedPort === portId
    const isLoading = loading.has(portId)
    const isDragOver = dragOver === portId
    
    return (
      <PortCell
        key={portId}
        portId={portId}
        assignment={assignment}
        isSelected={isSelected}
        isLoading={isLoading}
        isDragOver={isDragOver}
        showLabel={showPortLabels}
        compact={compactView}
        readOnly={readOnly}
        onSelect={() => onPortSelect?.(portId)}
        onPin={(assignment) => handlePortPin(portId, assignment)}
        onLock={(locked) => handlePortLock(portId, locked)}
      />
    )
  }

  // Render port group
  const renderPortGroup = (group: PortGroup) => {
    return (
      <div 
        key={group.name}
        className={`port-group ${group.type}`}
        data-testid={`port-group-${group.type}`}
      >
        <div className="group-header">
          <span className="group-name">{group.name}</span>
          <span className="group-type">{group.type.toUpperCase()}</span>
        </div>
        <div className={`port-grid ${compactView ? 'compact' : 'normal'}`}>
          {group.portIds.map(portId => renderPortCell(portId))}
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`port-map-view ${switchModel.toLowerCase()} ${compactView ? 'compact' : 'normal'}`}
      data-testid="port-map-view"
    >
      <div className="port-map-header">
        <h3 className="switch-model">{switchModel} Port Map</h3>
        <div className="port-stats">
          <span>Total: {portLayout.totalPorts}</span>
          <span>Assigned: {currentAssignments.filter(a => a.assignmentType !== 'unused').length}</span>
          <span>Pinned: {currentAssignments.filter(a => a.pinned).length}</span>
          <span>Locked: {currentAssignments.filter(a => a.locked).length}</span>
        </div>
      </div>

      <div className="port-map-body">
        {portLayout.accessPorts.map(group => renderPortGroup(group))}
        {portLayout.uplinkPorts.map(group => renderPortGroup(group))}
      </div>
    </div>
  )
}

// Simplified Port Cell Component
interface PortCellProps {
  portId: string
  assignment?: PortAssignment
  isSelected: boolean
  isLoading: boolean
  isDragOver: boolean
  showLabel: boolean
  compact: boolean
  readOnly: boolean
  onSelect: () => void
  onPin: (assignment: PortAssignment) => Promise<PinResult | undefined>
  onLock: (locked: boolean) => Promise<LockResult | undefined>
}

const PortCell: React.FC<PortCellProps> = ({
  portId,
  assignment,
  isSelected,
  isLoading,
  showLabel,
  compact,
  onSelect
}) => {
  const getPortStyle = () => {
    if (!assignment || assignment.assignmentType === 'unused') return 'unused'
    if (assignment.pinned) return 'pinned'
    if (assignment.locked) return 'locked'
    return 'assigned'
  }

  const portStyle = getPortStyle()
  
  return (
    <div
      className={`port-cell ${portStyle} ${isSelected ? 'selected' : ''} ${isLoading ? 'loading' : ''} ${compact ? 'compact' : 'normal'}`}
      data-testid={`port-${portId}`}
      onClick={onSelect}
    >
      {showLabel && (
        <div className="port-label">{portId}</div>
      )}
      
      {assignment && assignment.assignmentType !== 'unused' && assignment.assignedTo && (
        <div className="port-info">
          <div className="assigned-to" title={assignment.assignedTo}>
            {assignment.assignedTo.length > 8 ? 
              assignment.assignedTo.substring(0, 8) + '...' : 
              assignment.assignedTo
            }
          </div>
          {assignment.speed && (
            <div className="port-speed">{assignment.speed}</div>
          )}
        </div>
      )}
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  )
}