/**
 * WP-PIN1 Pin/Lock History Hook
 * Specialized hook for managing undo/redo operations for port pin/lock operations
 */

import { useState, useCallback, useMemo } from 'react'
import type { PortOperation, PortHistory, PortAssignment } from '../types/port-assignment.types'

export interface UsePinLockHistoryProps {
  maxHistorySize?: number
  enablePersistence?: boolean
  storageKey?: string
}

export interface UsePinLockHistoryReturn {
  history: PortHistory
  addOperation: (operation: Omit<PortOperation, 'id' | 'timestamp'>) => void
  undo: () => PortOperation | null
  redo: () => PortOperation | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void
  getOperationsByPort: (portId: string) => PortOperation[]
  getRecentOperations: (count?: number) => PortOperation[]
  exportHistory: () => string
  importHistory: (historyJson: string) => boolean
}

export function usePinLockHistory({
  maxHistorySize = 50,
  enablePersistence = false,
  storageKey = 'port-pin-lock-history'
}: UsePinLockHistoryProps = {}): UsePinLockHistoryReturn {
  
  // Initialize from localStorage if persistence is enabled
  const [history, setHistory] = useState<PortHistory>(() => {
    if (enablePersistence && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            operations: parsed.operations.map((op: any) => ({
              ...op,
              timestamp: new Date(op.timestamp)
            })),
            currentIndex: parsed.currentIndex,
            canUndo: parsed.canUndo,
            canRedo: parsed.canRedo
          }
        }
      } catch (error) {
        console.warn('Failed to load pin/lock history from storage:', error)
      }
    }
    
    return {
      operations: [],
      currentIndex: -1,
      canUndo: false,
      canRedo: false
    }
  })

  // Persist to localStorage when history changes
  const persistHistory = useCallback((newHistory: PortHistory) => {
    if (enablePersistence && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHistory))
      } catch (error) {
        console.warn('Failed to persist pin/lock history:', error)
      }
    }
  }, [enablePersistence, storageKey])

  // Add operation to history
  const addOperation = useCallback((operation: Omit<PortOperation, 'id' | 'timestamp'>) => {
    const newOperation: PortOperation = {
      ...operation,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }

    setHistory(prev => {
      // Remove any operations after current index (when undoing then making new changes)
      const operations = prev.operations.slice(0, prev.currentIndex + 1)
      operations.push(newOperation)
      
      // Limit history size
      if (operations.length > maxHistorySize) {
        operations.shift()
      }
      
      const currentIndex = operations.length - 1
      const newHistory = {
        operations,
        currentIndex,
        canUndo: currentIndex >= 0,
        canRedo: false
      }

      persistHistory(newHistory)
      return newHistory
    })
  }, [maxHistorySize, persistHistory])

  // Undo last operation
  const undo = useCallback(() => {
    if (!history.canUndo) return null
    
    const operation = history.operations[history.currentIndex]
    if (!operation) return null
    
    setHistory(prev => {
      const newHistory = {
        ...prev,
        currentIndex: prev.currentIndex - 1,
        canUndo: prev.currentIndex > 0,
        canRedo: true
      }
      persistHistory(newHistory)
      return newHistory
    })
    
    return operation
  }, [history, persistHistory])

  // Redo operation
  const redo = useCallback(() => {
    if (!history.canRedo) return null
    
    const operation = history.operations[history.currentIndex + 1]
    if (!operation) return null
    
    setHistory(prev => {
      const newHistory = {
        ...prev,
        currentIndex: prev.currentIndex + 1,
        canUndo: true,
        canRedo: prev.currentIndex + 1 < prev.operations.length - 1
      }
      persistHistory(newHistory)
      return newHistory
    })
    
    return operation
  }, [history, persistHistory])

  // Clear history
  const clear = useCallback(() => {
    const newHistory = {
      operations: [],
      currentIndex: -1,
      canUndo: false,
      canRedo: false
    }
    
    setHistory(newHistory)
    persistHistory(newHistory)
  }, [persistHistory])

  // Get operations for specific port
  const getOperationsByPort = useCallback((portId: string) => {
    return history.operations.filter(op => op.portId === portId)
  }, [history.operations])

  // Get recent operations
  const getRecentOperations = useCallback((count = 10) => {
    return history.operations
      .slice(-count)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [history.operations])

  // Export history as JSON
  const exportHistory = useCallback(() => {
    return JSON.stringify({
      operations: history.operations.map(op => ({
        ...op,
        timestamp: op.timestamp.toISOString()
      })),
      currentIndex: history.currentIndex,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2)
  }, [history])

  // Import history from JSON
  const importHistory = useCallback((historyJson: string): boolean => {
    try {
      const parsed = JSON.parse(historyJson)
      
      if (!parsed.operations || !Array.isArray(parsed.operations)) {
        return false
      }

      const operations: PortOperation[] = parsed.operations.map((op: any) => ({
        ...op,
        timestamp: new Date(op.timestamp)
      }))

      const newHistory = {
        operations,
        currentIndex: parsed.currentIndex >= 0 ? Math.min(parsed.currentIndex, operations.length - 1) : -1,
        canUndo: operations.length > 0,
        canRedo: false
      }

      setHistory(newHistory)
      persistHistory(newHistory)
      return true
    } catch (error) {
      console.error('Failed to import history:', error)
      return false
    }
  }, [persistHistory])

  // Computed values
  const canUndo = useMemo(() => history.canUndo, [history.canUndo])
  const canRedo = useMemo(() => history.canRedo, [history.canRedo])

  return {
    history,
    addOperation,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    getOperationsByPort,
    getRecentOperations,
    exportHistory,
    importHistory
  }
}