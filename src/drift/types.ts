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

// FKS (Fabric Services) specific drift detection types
export interface FksDriftItem {
  id: string
  path: string
  type: 'switch' | 'server' | 'connection' | 'configuration'
  severity: 'low' | 'medium' | 'high'
  description: string
  fgdValue?: any
  k8sValue?: any
  timestamp: string
}

export interface FksDriftResult {
  enabled: boolean
  hasDrift: boolean
  items: FksDriftItem[]
  lastChecked: Date
  k8sApiStatus: 'healthy' | 'degraded' | 'unavailable'
  comparisonTimeMs: number
}

export interface FksDriftDetectionOptions {
  fabricId?: string
  includeHealthyResources?: boolean
  severityThreshold?: 'low' | 'medium' | 'high'
  k8sApiTimeout?: number
}

// Union type for backward compatibility
export interface DriftResult {
  enabled: boolean
  items: Array<{ id: string; path: string }> | FksDriftItem[]
  // FKS-specific fields (optional for backward compatibility)
  hasDrift?: boolean
  lastChecked?: Date
  k8sApiStatus?: 'healthy' | 'degraded' | 'unavailable'
  comparisonTimeMs?: number
}