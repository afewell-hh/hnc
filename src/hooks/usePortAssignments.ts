/**
 * WP-PIN1 Port Assignments Hook
 * React hook for managing port assignment state and operations
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import type {
  PortAssignment,
  PinResult,
  LockResult,
  ConstraintViolation,
  AssignmentDiff,
  PortOperation,
  PortHistory
} from '../types/port-assignment.types'
import { DefaultPinLockEngine } from '../domain/port-pin-engine'
import { DefaultDiffAnalyzer } from '../domain/assignment-diff'

export interface UsePortAssignmentsProps {
  switchModel?: string
  initialAssignments?: PortAssignment[]
  autoAssignments?: PortAssignment[]
  onAssignmentChange?: (assignments: PortAssignment[]) => void
  onViolationChange?: (violations: ConstraintViolation[]) => void
  enableHistory?: boolean
}

export interface UsePortAssignmentsReturn {
  // State
  assignments: PortAssignment[]
  violations: ConstraintViolation[]
  diff: AssignmentDiff | null
  selectedPort: string | null
  isLoading: boolean
  history: PortHistory

  // Actions
  pinAssignment: (portId: string, assignment: PortAssignment) => Promise<PinResult>
  unpinAssignment: (portId: string) => Promise<PinResult>
  lockPort: (portId: string, locked: boolean) => Promise<LockResult>
  selectPort: (portId: string | null) => void
  updateAssignment: (portId: string, updates: Partial<PortAssignment>) => Promise<void>
  revertToAuto: (portId: string) => Promise<void>
  validateAll: () => ConstraintViolation[]
  
  // History
  undo: () => boolean
  redo: () => boolean
  clearHistory: () => void
  
  // Utilities
  getAssignment: (portId: string) => PortAssignment | undefined
  getPinnedAssignments: () => PortAssignment[]
  getLockedPorts: () => string[]
  refreshDiff: () => void
}

export function usePortAssignments({
  switchModel = 'DS2000',
  initialAssignments = [],
  autoAssignments = [],
  onAssignmentChange,
  onViolationChange,
  enableHistory = true
}: UsePortAssignmentsProps = {}): UsePortAssignmentsReturn {
  
  // State
  const [assignments, setAssignments] = useState<PortAssignment[]>(initialAssignments)
  const [selectedPort, setSelectedPort] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<PortHistory>({
    operations: [],
    currentIndex: -1,
    canUndo: false,
    canRedo: false
  })

  // Initialize engines
  const pinLockEngine = useMemo(() => new DefaultPinLockEngine(switchModel), [switchModel])
  const diffAnalyzer = useMemo(() => new DefaultDiffAnalyzer(), [])

  // Compute violations
  const violations = useMemo(() => {
    return pinLockEngine.validateConstraints(assignments)
  }, [assignments, pinLockEngine])

  // Compute diff
  const diff = useMemo(() => {
    if (autoAssignments.length === 0) return null
    return diffAnalyzer.computeDiff(autoAssignments, assignments)
  }, [autoAssignments, assignments, diffAnalyzer])

  // Add operation to history
  const addToHistory = useCallback((operation: Omit<PortOperation, 'id' | 'timestamp'>) => {
    if (!enableHistory) return

    const newOperation: PortOperation = {
      ...operation,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }

    setHistory(prev => {
      // Remove any operations after current index (when undoing then making new changes)
      const operations = prev.operations.slice(0, prev.currentIndex + 1)
      operations.push(newOperation)
      
      // Limit history size (keep last 50 operations)
      if (operations.length > 50) {
        operations.shift()
      }
      
      const currentIndex = operations.length - 1
      
      return {
        operations,
        currentIndex,
        canUndo: currentIndex >= 0,
        canRedo: false
      }
    })
  }, [enableHistory])

  // Pin assignment
  const pinAssignment = useCallback(async (portId: string, assignment: PortAssignment): Promise<PinResult> => {
    setIsLoading(true)
    
    try {
      const currentAssignment = assignments.find(a => a.portId === portId)
      const result = pinLockEngine.pinAssignment(portId, assignment)
      
      if (result.success && result.assignment) {
        const before = currentAssignment || {
          portId,
          assignmentType: 'unused' as const,
          speed: '25G',
          pinned: false,
          locked: false
        }
        
        setAssignments(prev => {
          const newAssignments = prev.filter(a => a.portId !== portId)
          newAssignments.push(result.assignment!)
          return newAssignments.sort((a, b) => {
            const aNum = parseInt(a.portId.split('-')[0] || a.portId)
            const bNum = parseInt(b.portId.split('-')[0] || b.portId)
            return aNum - bNum
          })
        })
        
        addToHistory({
          type: 'pin',
          portId,
          before,
          after: result.assignment,
          reason: 'User pinned assignment'
        })
      }
      
      return result
    } finally {
      setIsLoading(false)
    }
  }, [assignments, pinLockEngine, addToHistory])

  // Unpin assignment
  const unpinAssignment = useCallback(async (portId: string): Promise<PinResult> => {
    setIsLoading(true)
    
    try {
      const currentAssignment = assignments.find(a => a.portId === portId)
      if (!currentAssignment || !currentAssignment.pinned) {
        return {
          success: false,
          portId,
          conflicts: [{
            type: 'logical',
            severity: 'error',
            message: 'Port is not pinned',
            affectedPorts: [portId]
          }]
        }
      }
      
      const unpinnedAssignment: PortAssignment = {
        ...currentAssignment,
        pinned: false,
        metadata: {
          ...currentAssignment.metadata,
          timestamp: new Date()
        }
      }
      
      setAssignments(prev => 
        prev.map(a => a.portId === portId ? unpinnedAssignment : a)
      )
      
      addToHistory({
        type: 'unpin',
        portId,
        before: currentAssignment,
        after: unpinnedAssignment,
        reason: 'User unpinned assignment'
      })
      
      return {
        success: true,
        portId,
        assignment: unpinnedAssignment
      }
    } finally {
      setIsLoading(false)
    }
  }, [assignments, addToHistory])

  // Lock/unlock port
  const lockPort = useCallback(async (portId: string, locked: boolean): Promise<LockResult> => {
    setIsLoading(true)
    
    try {
      const currentAssignment = assignments.find(a => a.portId === portId)
      const result = pinLockEngine.lockPort(portId, locked)
      
      if (result.success && currentAssignment) {
        const lockedAssignment: PortAssignment = {
          ...currentAssignment,
          locked,
          metadata: {
            ...currentAssignment.metadata,
            timestamp: new Date()
          }
        }
        
        setAssignments(prev => 
          prev.map(a => a.portId === portId ? lockedAssignment : a)
        )
        
        addToHistory({
          type: locked ? 'lock' : 'unlock',
          portId,
          before: currentAssignment,
          after: lockedAssignment,
          reason: `User ${locked ? 'locked' : 'unlocked'} port`
        })
      }
      
      return result
    } finally {
      setIsLoading(false)
    }
  }, [assignments, pinLockEngine, addToHistory])

  // Update assignment
  const updateAssignment = useCallback(async (portId: string, updates: Partial<PortAssignment>) => {
    const currentAssignment = assignments.find(a => a.portId === portId)
    if (!currentAssignment) return

    const updatedAssignment: PortAssignment = {
      ...currentAssignment,
      ...updates,
      portId, // Ensure portId can't be changed
      metadata: {
        ...currentAssignment.metadata,
        timestamp: new Date()
      }
    }

    setAssignments(prev => 
      prev.map(a => a.portId === portId ? updatedAssignment : a)
    )

    addToHistory({
      type: 'assign',
      portId,
      before: currentAssignment,
      after: updatedAssignment,
      reason: 'User updated assignment'
    })
  }, [assignments, addToHistory])

  // Revert to auto assignment
  const revertToAuto = useCallback(async (portId: string) => {
    const currentAssignment = assignments.find(a => a.portId === portId)
    const autoAssignment = autoAssignments.find(a => a.portId === portId)
    
    if (!currentAssignment) return
    
    if (autoAssignment) {
      // Revert to auto assignment
      const revertedAssignment: PortAssignment = {
        ...autoAssignment,
        pinned: false,
        locked: false,
        metadata: {
          assignedBy: 'auto',
          timestamp: new Date(),
          reason: 'Reverted to auto assignment'
        }
      }
      
      setAssignments(prev => 
        prev.map(a => a.portId === portId ? revertedAssignment : a)
      )
      
      addToHistory({
        type: 'assign',
        portId,
        before: currentAssignment,
        after: revertedAssignment,
        reason: 'Reverted to auto assignment'
      })
    } else {
      // Remove assignment (make unused)
      const unusedAssignment: PortAssignment = {
        portId,
        assignmentType: 'unused',
        speed: '25G',
        pinned: false,
        locked: false,
        metadata: {
          assignedBy: 'manual',
          timestamp: new Date(),
          reason: 'Reverted to unused'
        }
      }
      
      setAssignments(prev => 
        prev.map(a => a.portId === portId ? unusedAssignment : a)
      )
      
      addToHistory({
        type: 'unassign',
        portId,
        before: currentAssignment,
        after: unusedAssignment,
        reason: 'Reverted to unused'
      })
    }
  }, [assignments, autoAssignments, addToHistory])

  // Validate all assignments
  const validateAll = useCallback(() => {
    return pinLockEngine.validateConstraints(assignments)
  }, [assignments, pinLockEngine])

  // Undo operation
  const undo = useCallback(() => {
    if (!history.canUndo) return false
    
    const operation = history.operations[history.currentIndex]
    if (!operation) return false
    
    // Apply the reverse of the operation
    setAssignments(prev => 
      prev.map(a => a.portId === operation.portId ? operation.before : a)
    )
    
    setHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
      canUndo: prev.currentIndex > 0,
      canRedo: true
    }))
    
    return true
  }, [history])

  // Redo operation
  const redo = useCallback(() => {
    if (!history.canRedo) return false
    
    const operation = history.operations[history.currentIndex + 1]
    if (!operation) return false
    
    // Apply the operation
    setAssignments(prev => 
      prev.map(a => a.portId === operation.portId ? operation.after : a)
    )
    
    setHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      canUndo: true,
      canRedo: prev.currentIndex + 1 < prev.operations.length - 1
    }))
    
    return true
  }, [history])

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory({
      operations: [],
      currentIndex: -1,
      canUndo: false,
      canRedo: false
    })
  }, [])

  // Utility functions
  const getAssignment = useCallback((portId: string) => {
    return assignments.find(a => a.portId === portId)
  }, [assignments])

  const getPinnedAssignments = useCallback(() => {
    return assignments.filter(a => a.pinned)
  }, [assignments])

  const getLockedPorts = useCallback(() => {
    return assignments.filter(a => a.locked).map(a => a.portId)
  }, [assignments])

  const refreshDiff = useCallback(() => {
    // Diff is computed automatically via useMemo, this is just for manual refresh trigger
    // Could be used to trigger re-computation if needed
  }, [])

  // Effect: Notify about assignment changes
  useEffect(() => {
    onAssignmentChange?.(assignments)
  }, [assignments, onAssignmentChange])

  // Effect: Notify about violation changes
  useEffect(() => {
    onViolationChange?.(violations)
  }, [violations, onViolationChange])

  return {
    // State
    assignments,
    violations,
    diff,
    selectedPort,
    isLoading,
    history,

    // Actions
    pinAssignment,
    unpinAssignment,
    lockPort,
    selectPort: setSelectedPort,
    updateAssignment,
    revertToAuto,
    validateAll,

    // History
    undo,
    redo,
    clearHistory,

    // Utilities
    getAssignment,
    getPinnedAssignments,
    getLockedPorts,
    refreshDiff
  }
}