import { loadFGD, fabricExists } from '../io/fgd.js'
import type { WiringDiagram } from '../app.types.js'
import type { 
  DriftStatus, 
  DriftSummary, 
  DriftChange, 
  DriftComparisonResult, 
  DriftDetectionOptions,
  DriftCategory
} from './types.js'

/**
 * Core drift detector that compares in-memory wiring diagram vs YAML on disk
 * Detects added/removed/modified servers, switches, connections
 */
export async function detectDrift(
  fabricId: string, 
  currentDiagram: WiringDiagram,
  options: DriftDetectionOptions = {}
): Promise<DriftStatus> {
  const startTime = Date.now()
  
  try {
    // Check if fabric files exist on disk
    const exists = await fabricExists(fabricId, options.baseDir)
    if (!exists) {
      // No files on disk = no drift (nothing to compare against)
      return {
        hasDrift: false,
        driftSummary: ['No files found on disk - nothing to compare against'],
        lastChecked: new Date(),
        affectedFiles: []
      }
    }

    // Load diagram from disk
    const loadResult = await loadFGD({ fabricId, baseDir: options.baseDir })
    if (!loadResult.success || !loadResult.diagram) {
      throw new Error(loadResult.error || 'Failed to load diagram from disk')
    }

    // Generate detailed comparison
    const comparisonResult = generateDriftReport(currentDiagram, loadResult.diagram, options)
    
    return {
      hasDrift: comparisonResult.hasDrift,
      driftSummary: buildDriftSummaryStrings(comparisonResult.changes),
      lastChecked: new Date(),
      affectedFiles: loadResult.filesRead
    }

  } catch (error) {
    // Handle errors gracefully - if we can't detect drift, report no drift
    return {
      hasDrift: false,
      driftSummary: [`Error detecting drift: ${error instanceof Error ? error.message : 'Unknown error'}`],
      lastChecked: new Date(),
      affectedFiles: []
    }
  }
}

/**
 * Generates a detailed drift report comparing two wiring diagrams
 */
export function generateDriftReport(
  current: WiringDiagram, 
  onDisk: WiringDiagram,
  options: DriftDetectionOptions = {}
): DriftComparisonResult {
  const startTime = Date.now()
  const changes: DriftChange[] = []

  // Compare switches (spines and leaves)
  const switchChanges = compareDevices(
    [...current.devices.spines, ...current.devices.leaves],
    [...onDisk.devices.spines, ...onDisk.devices.leaves],
    'switch'
  )
  changes.push(...switchChanges)

  // Compare endpoints/servers
  const endpointChanges = compareDevices(
    current.devices.servers,
    onDisk.devices.servers,
    'endpoint'
  )
  changes.push(...endpointChanges)

  // Compare connections
  const connectionChanges = compareConnections(current.connections, onDisk.connections)
  changes.push(...connectionChanges)

  // Build categorized summary
  const summary: DriftSummary = {
    fabricId: current.metadata.fabricName || 'unknown',
    hasDrift: changes.length > 0,
    categories: {
      switches: categorizeDriftChanges(changes.filter(c => c.category === 'switch')),
      endpoints: categorizeDriftChanges(changes.filter(c => c.category === 'endpoint')),
      connections: categorizeDriftChanges(changes.filter(c => c.category === 'connection'))
    },
    affectedFiles: [], // Will be populated by caller
    lastChecked: new Date()
  }

  const endTime = Date.now()

  return {
    hasDrift: changes.length > 0,
    changes,
    summary,
    performanceMetrics: {
      comparisonTimeMs: endTime - startTime,
      memoryDiagramSize: estimateDiagramSize(current),
      diskFilesTotalSize: estimateDiagramSize(onDisk)
    }
  }
}

/**
 * Compare device arrays (switches or endpoints) and identify changes
 */
function compareDevices(
  current: Array<{ id: string; [key: string]: any }>,
  onDisk: Array<{ id: string; [key: string]: any }>,
  category: 'switch' | 'endpoint'
): DriftChange[] {
  const changes: DriftChange[] = []
  
  const currentIds = new Set(current.map(d => d.id))
  const diskIds = new Set(onDisk.map(d => d.id))
  
  // Map for efficient lookups
  const currentMap = new Map(current.map(d => [d.id, d]))
  const diskMap = new Map(onDisk.map(d => [d.id, d]))

  // Find added devices (in memory but not on disk)
  for (const id of currentIds) {
    if (!diskIds.has(id)) {
      const device = currentMap.get(id)!
      changes.push({
        type: 'added',
        category,
        itemId: id,
        description: `${category} '${id}' added (model: ${device.model || device.type || 'unknown'})`,
        details: device
      })
    }
  }

  // Find removed devices (on disk but not in memory)
  for (const id of diskIds) {
    if (!currentIds.has(id)) {
      const device = diskMap.get(id)!
      changes.push({
        type: 'removed',
        category,
        itemId: id,
        description: `${category} '${id}' removed (was: ${device.model || device.type || 'unknown'})`,
        details: device
      })
    }
  }

  // Find modified devices (in both, but different)
  for (const id of currentIds) {
    if (diskIds.has(id)) {
      const currentDevice = currentMap.get(id)!
      const diskDevice = diskMap.get(id)!
      
      if (!deepEqual(currentDevice, diskDevice)) {
        const differences = findObjectDifferences(currentDevice, diskDevice)
        changes.push({
          type: 'modified',
          category,
          itemId: id,
          description: `${category} '${id}' modified (${differences.join(', ')})`,
          details: { current: currentDevice, disk: diskDevice }
        })
      }
    }
  }

  return changes
}

/**
 * Compare connection arrays and identify changes
 */
function compareConnections(
  current: Array<{ from: any; to: any; type: string }>,
  onDisk: Array<{ from: any; to: any; type: string }>
): DriftChange[] {
  const changes: DriftChange[] = []
  
  // Create comparable keys for connections
  const getConnectionKey = (conn: any) => 
    `${conn.from.device}:${conn.from.port}->${conn.to.device}:${conn.to.port}`
  
  const currentKeys = new Set(current.map(getConnectionKey))
  const diskKeys = new Set(onDisk.map(getConnectionKey))
  
  const currentMap = new Map(current.map(c => [getConnectionKey(c), c]))
  const diskMap = new Map(onDisk.map(c => [getConnectionKey(c), c]))

  // Find added connections
  for (const key of currentKeys) {
    if (!diskKeys.has(key)) {
      const conn = currentMap.get(key)!
      changes.push({
        type: 'added',
        category: 'connection',
        itemId: key,
        description: `Connection added: ${conn.from.device}:${conn.from.port} -> ${conn.to.device}:${conn.to.port}`,
        details: conn
      })
    }
  }

  // Find removed connections
  for (const key of diskKeys) {
    if (!currentKeys.has(key)) {
      const conn = diskMap.get(key)!
      changes.push({
        type: 'removed',
        category: 'connection',
        itemId: key,
        description: `Connection removed: ${conn.from.device}:${conn.from.port} -> ${conn.to.device}:${conn.to.port}`,
        details: conn
      })
    }
  }

  // Find modified connections
  for (const key of currentKeys) {
    if (diskKeys.has(key)) {
      const currentConn = currentMap.get(key)!
      const diskConn = diskMap.get(key)!
      
      if (!deepEqual(currentConn, diskConn)) {
        const differences = findObjectDifferences(currentConn, diskConn)
        changes.push({
          type: 'modified',
          category: 'connection',
          itemId: key,
          description: `Connection modified: ${key} (${differences.join(', ')})`,
          details: { current: currentConn, disk: diskConn }
        })
      }
    }
  }

  return changes
}

/**
 * Categorize drift changes by type for summary
 */
function categorizeDriftChanges(changes: DriftChange[]): DriftCategory {
  return {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    modified: changes.filter(c => c.type === 'modified').length,
    details: changes.map(c => c.description)
  }
}

/**
 * Build human-readable drift summary strings
 */
function buildDriftSummaryStrings(changes: DriftChange[]): string[] {
  if (changes.length === 0) {
    return ['No drift detected - in-memory topology matches files on disk']
  }

  const summary: string[] = []
  const byCategory = groupBy(changes, c => c.category)
  
  for (const [category, categoryChanges] of byCategory) {
    const byType = groupBy(categoryChanges, c => c.type)
    const parts: string[] = []
    
    if (byType.get('added')?.length) {
      parts.push(`${byType.get('added')!.length} added`)
    }
    if (byType.get('removed')?.length) {
      parts.push(`${byType.get('removed')!.length} removed`)
    }
    if (byType.get('modified')?.length) {
      parts.push(`${byType.get('modified')!.length} modified`)
    }
    
    if (parts.length > 0) {
      summary.push(`${category}s: ${parts.join(', ')}`)
    }
  }

  return summary
}

// Utility functions
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  
  if (keysA.length !== keysB.length) return false
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }
  
  return true
}

function findObjectDifferences(current: any, disk: any): string[] {
  const differences: string[] = []
  const allKeys = new Set([...Object.keys(current), ...Object.keys(disk)])
  
  for (const key of allKeys) {
    if (!(key in current)) {
      differences.push(`removed ${key}`)
    } else if (!(key in disk)) {
      differences.push(`added ${key}`)
    } else if (!deepEqual(current[key], disk[key])) {
      differences.push(`${key} changed`)
    }
  }
  
  return differences
}

function groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of array) {
    const key = keyFn(item)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }
  return groups
}

function estimateDiagramSize(diagram: WiringDiagram): number {
  // Rough estimate of object size for performance tracking
  return JSON.stringify(diagram).length
}