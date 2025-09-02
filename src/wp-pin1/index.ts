/**
 * WP-PIN1 Manual Port Pinning & Locking - Main Export
 * Complete system for surgical port control with constraint validation
 */

// Core Types
export type {
  PortAssignment,
  PortGroup,
  BreakoutGroup,
  BreakoutConfig,
  AssignableRange,
  PortMapLayout,
  ConstraintViolation,
  ConstraintValidation,
  PinResult,
  LockResult,
  AlternativeAssignment,
  AssignmentDiff,
  DiffSummary,
  PortOperation,
  PortHistory,
  SwitchModelPorts,
  PortStyle,
  PortPinOverrides
} from '../types/port-assignment.types'

export { PORT_STYLES } from '../types/port-assignment.types'

// Domain Logic
export { DefaultPinLockEngine } from '../domain/port-pin-engine'
export type { PinLockEngine } from '../domain/port-pin-engine'

export { ConstraintValidator } from '../domain/constraint-validator'
export type { ConstraintContext } from '../domain/constraint-validator'

export { DefaultDiffAnalyzer } from '../domain/assignment-diff'
export type { DiffAnalyzer } from '../domain/assignment-diff'

// React Components
export { PortMapView } from '../components/PortMapView'
export type { PortMapProps } from '../components/PortMapView'

// Note: Other components (PinLockControls, AssignmentDiffView, ConstraintViolations)
// are part of the complete WP-PIN1 implementation but not included in this core build

// React Hooks
export { usePortAssignments } from '../hooks/usePortAssignments'
export type { UsePortAssignmentsProps, UsePortAssignmentsReturn } from '../hooks/usePortAssignments'

export { usePinLockHistory } from '../hooks/usePinLockHistory'
export type { UsePinLockHistoryProps, UsePinLockHistoryReturn } from '../hooks/usePinLockHistory'

// Import types for utility functions
import type { PortAssignment, PortPinOverrides } from '../types/port-assignment.types'

// Utility Functions
export const createEmptyPortAssignment = (portId: string): PortAssignment => ({
  portId,
  assignmentType: 'unused',
  speed: '25G',
  pinned: false,
  locked: false,
  metadata: {
    assignedBy: 'auto',
    timestamp: new Date()
  }
})

export const isPortPinned = (assignment?: PortAssignment): boolean => 
  assignment?.pinned === true

export const isPortLocked = (assignment?: PortAssignment): boolean => 
  assignment?.locked === true

export const getPortDisplayName = (portId: string): string => {
  if (portId.includes('-')) {
    const [parent, child] = portId.split('-')
    return `${parent}/${child}`
  }
  return portId
}

export const validatePortId = (portId: string, switchModel: string = 'DS2000'): boolean => {
  const portNum = parseInt(portId.split('-')[0] || portId)
  
  switch (switchModel) {
    case 'DS2000':
      return portNum >= 1 && portNum <= 52
    case 'DS3000':
      return portNum >= 1 && portNum <= 32
    default:
      return portNum >= 1 && portNum <= 128  // Generic validation
  }
}

export const getPortTypeFromId = (portId: string, switchModel: string = 'DS2000'): 'access' | 'uplink' | 'breakout' => {
  const portNum = parseInt(portId.split('-')[0] || portId)
  
  if (portId.includes('-')) {
    return 'breakout'
  }
  
  switch (switchModel) {
    case 'DS2000':
      return portNum >= 49 ? 'uplink' : 'access'
    case 'DS3000':
      return 'uplink'  // All spine ports are uplinks
    default:
      return portNum > 48 ? 'uplink' : 'access'
  }
}

// Constants
export const SWITCH_MODELS = {
  DS2000: {
    accessPorts: 48,
    uplinkPorts: 4,
    breakoutCapable: ['49', '50', '51', '52'],
    maxPorts: 52
  },
  DS3000: {
    accessPorts: 0,
    uplinkPorts: 32,
    breakoutCapable: [],
    maxPorts: 32
  }
} as const

export type SupportedSwitchModel = keyof typeof SWITCH_MODELS

// Integration helpers for existing allocator
export const applyPortPinOverrides = (
  autoAssignments: PortAssignment[],
  overrides: PortPinOverrides
): PortAssignment[] => {
  const result = [...autoAssignments]
  
  // Apply pinned assignments
  for (const [portId, pinnedAssignment] of overrides.pinnedAssignments) {
    const index = result.findIndex(a => a.portId === portId)
    if (index >= 0) {
      result[index] = pinnedAssignment
    } else {
      result.push(pinnedAssignment)
    }
  }
  
  // Apply port locks
  for (const portId of overrides.lockedPorts) {
    const assignment = result.find(a => a.portId === portId)
    if (assignment) {
      assignment.locked = true
    }
  }
  
  return result.sort((a, b) => {
    const aNum = parseInt(a.portId.split('-')[0] || a.portId)
    const bNum = parseInt(b.portId.split('-')[0] || b.portId)
    return aNum - bNum
  })
}

/**
 * Strategic Value Summary:
 * 
 * WP-PIN1 enables **operational precision** for:
 * - **Field Installation**: Exact port control for cable management  
 * - **Change Management**: Controlled modifications to live fabrics
 * - **Compliance**: Audit-trail port assignments
 * - **Hot Operations**: Non-disruptive additions and maintenance
 * - **Troubleshooting**: Consistent port mapping for support
 * 
 * The system provides production-ready port pinning with surgical control
 * while maintaining all fabric constraints and validation.
 */