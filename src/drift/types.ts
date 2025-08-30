// Drift detection types and interfaces

export interface DriftStatus {
  hasDrift: boolean
  driftSummary: string[]
  lastChecked: Date
  affectedFiles: string[]
}

export interface DriftSummary {
  fabricId: string
  hasDrift: boolean
  categories: {
    switches: DriftCategory
    endpoints: DriftCategory
    connections: DriftCategory
  }
  affectedFiles: string[]
  lastChecked: Date
}

export interface DriftCategory {
  added: number
  removed: number
  modified: number
  details: string[]
}

export interface DriftChange {
  type: 'added' | 'removed' | 'modified'
  category: 'switch' | 'endpoint' | 'connection'
  itemId: string
  description: string
  details?: Record<string, any>
}

export interface DriftComparisonResult {
  hasDrift: boolean
  changes: DriftChange[]
  summary: DriftSummary
  performanceMetrics: {
    comparisonTimeMs: number
    memoryDiagramSize: number
    diskFilesTotalSize: number
  }
}

export interface DriftDetectionOptions {
  baseDir?: string
  includeMetadata?: boolean
  ignoreTimestamps?: boolean
  detailedComparison?: boolean
}