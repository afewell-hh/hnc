// Bulk Operations Types for WP-BULK1
// Enables bulk renaming and class reassignment with preview and validation

import type { LeafClass, EndpointProfile, FabricGuard } from '../app.types'

// Pattern-based renaming configuration
export interface RenamingPattern {
  id: string
  name: string
  type: 'regex' | 'template' | 'prefix' | 'suffix'
  pattern: string
  replacement: string
  target: 'devices' | 'classes' | 'profiles'
  description?: string
}

// Pre-defined common renaming patterns
export const COMMON_PATTERNS: RenamingPattern[] = [
  {
    id: 'server-to-srv',
    name: 'Server → Srv',
    type: 'regex',
    pattern: '^server-(.+)$',
    replacement: 'srv-$1',
    target: 'devices',
    description: 'Changes server-* to srv-*'
  },
  {
    id: 'leaf-to-switch',
    name: 'Leaf → Switch',
    type: 'regex', 
    pattern: '^leaf-(.+)$',
    replacement: 'switch-$1',
    target: 'devices',
    description: 'Changes leaf-* to switch-*'
  },
  {
    id: 'add-dc-prefix',
    name: 'Add DC Prefix',
    type: 'prefix',
    pattern: '',
    replacement: 'dc1-',
    target: 'devices',
    description: 'Adds dc1- prefix to all devices'
  }
]

// Class reassignment configuration
export interface ClassReassignment {
  sourceClassId: string
  targetClassId: string
  endpointFilters?: {
    profileNames?: string[]
    minCount?: number
    maxCount?: number
  }
  moveEndpoints?: {
    profileName: string
    count: number
  }[]
}

// Bulk operation types
export type BulkOperationType = 'rename' | 'reassign' | 'modify'

export interface BulkOperation {
  id: string
  type: BulkOperationType
  name: string
  description: string
  renamingPattern?: RenamingPattern
  classReassignments?: ClassReassignment[]
  modifications?: Record<string, any>
  createdAt: Date
}

// Change tracking for preview system
export interface ChangeRecord {
  id: string
  type: 'rename' | 'reassign' | 'modify' | 'add' | 'remove'
  target: 'class' | 'profile' | 'device' | 'property'
  path: string // dot-notation path to the changed item
  before: any
  after: any
  impact: 'low' | 'medium' | 'high'
  warnings?: string[]
  errors?: string[]
}

// Deterministic diff result
export interface BulkOperationDiff {
  operationId: string
  timestamp: Date
  changes: ChangeRecord[]
  summary: {
    totalChanges: number
    byType: Record<ChangeRecord['type'], number>
    byTarget: Record<ChangeRecord['target'], number>
    byImpact: Record<ChangeRecord['impact'], number>
  }
  capacityImpact: {
    beforeCapacity: CapacitySnapshot
    afterCapacity: CapacitySnapshot
    changedClasses: string[]
    warnings: string[]
    errors: string[]
  }
  validation: {
    isValid: boolean
    errors: string[]
    warnings: string[]
    guards: FabricGuard[]
  }
  // Deterministic hash for comparison and change detection
  hash: string
}

// Capacity snapshot for impact analysis
export interface CapacitySnapshot {
  totalEndpoints: number
  totalCapacity: number
  utilizationPercent: number
  byClass: Record<string, {
    leafCount: number
    endpointCount: number
    capacity: number
    utilization: number
  }>
  oversubscriptionRatio: number
}

// Bulk operation execution result
export interface BulkOperationResult {
  operationId: string
  success: boolean
  appliedChanges: ChangeRecord[]
  failedChanges: ChangeRecord[]
  rollbackAvailable: boolean
  rollbackData?: any
  timestamp: Date
  duration: number // execution time in milliseconds
}

// Undo/Redo support
export interface BulkOperationHistory {
  operations: (BulkOperation & { result: BulkOperationResult })[]
  currentIndex: number
  canUndo: boolean
  canRedo: boolean
}

// Progress tracking for large operations
export interface BulkOperationProgress {
  operationId: string
  status: 'preparing' | 'validating' | 'applying' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  processedChanges: number
  totalChanges: number
  startTime: Date
  estimatedCompletion?: Date
  errors?: string[]
}

// Validation rules for bulk operations
export interface BulkOperationValidator {
  validatePattern: (pattern: RenamingPattern) => { isValid: boolean; errors: string[] }
  validateReassignment: (reassignment: ClassReassignment, leafClasses: LeafClass[]) => { isValid: boolean; errors: string[] }
  validateCapacityImpact: (before: CapacitySnapshot, after: CapacitySnapshot) => { isValid: boolean; errors: string[]; warnings: string[] }
  validateNamingConflicts: (changes: ChangeRecord[]) => { hasConflicts: boolean; conflicts: Array<{ path: string; conflictsWith: string[] }> }
}

// Filter and selection utilities
export interface SelectionFilter {
  classIds?: string[]
  profileNames?: string[]
  deviceTypes?: string[]
  namePatterns?: string[]
  minCapacity?: number
  maxCapacity?: number
  tags?: string[]
}

export interface BulkOperationSelection {
  leafClasses: string[]
  endpointProfiles: Array<{ classId: string; profileName: string }>
  filters: SelectionFilter
  excludeIds: string[]
}
