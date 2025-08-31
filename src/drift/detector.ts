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

// ===== FKS DRIFT DETECTION (HNC v0.4) =====

import type { FksDriftItem, FksDriftResult, FksDriftDetectionOptions } from './types.js';
import type { FabricServicesApiResponse, SwitchStatus, ServerStatus, ConnectionStatus } from './mock-fks-api.js';

/**
 * FKS drift detection class - compares FGD YAML with K8s Fabric Services API
 */
export class FksDriftDetector {
  private fabricId: string;
  private options: FksDriftDetectionOptions;

  constructor(fabricId: string = 'default-fabric', options: FksDriftDetectionOptions = {}) {
    this.fabricId = fabricId;
    this.options = {
      includeHealthyResources: false,
      severityThreshold: 'medium',
      k8sApiTimeout: 5000,
      ...options
    };
  }

  /**
   * Main drift detection method - compares FGD with K8s API response
   */
  async detectDrift(k8sApiResponse: FabricServicesApiResponse, fgdDiagram?: WiringDiagram): Promise<FksDriftResult> {
    const startTime = performance.now();
    const lastChecked = new Date();

    let diagram = fgdDiagram;
    if (!diagram) {
      // Load FGD diagram from storage if not provided
      try {
        const loadResult = await loadFGD({ fabricId: this.fabricId });
        if (!loadResult.success || !loadResult.diagram) {
          return {
            enabled: true,
            hasDrift: false,
            items: [{
              id: 'fgd-load-error',
              path: `fgd/${this.fabricId}`,
              type: 'configuration',
              severity: 'high',
              description: 'Failed to load FGD diagram for comparison',
              timestamp: lastChecked.toISOString()
            }],
            lastChecked,
            k8sApiStatus: 'healthy',
            comparisonTimeMs: performance.now() - startTime
          };
        }
        diagram = loadResult.diagram;
      } catch (error) {
        return {
          enabled: true,
          hasDrift: false,
          items: [{
            id: 'fgd-load-exception',
            path: `fgd/${this.fabricId}`,
            type: 'configuration',
            severity: 'high',
            description: `Exception loading FGD: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: lastChecked.toISOString()
          }],
          lastChecked,
          k8sApiStatus: 'healthy',
          comparisonTimeMs: performance.now() - startTime
        };
      }
    }

    // Perform drift comparison
    const driftItems: FksDriftItem[] = [];

    // Compare switches (combine spines and leaves)
    const allSwitches = [...diagram.devices.spines, ...diagram.devices.leaves];
    const switchDriftItems = this.compareSwitches(allSwitches, k8sApiResponse.items.switches);
    driftItems.push(...switchDriftItems);

    // Compare servers/endpoints
    const serverDriftItems = this.compareServers(diagram.devices.servers, k8sApiResponse.items.servers);
    driftItems.push(...serverDriftItems);

    // Compare connections
    const connectionDriftItems = this.compareConnections(diagram.connections, k8sApiResponse.items.connections);
    driftItems.push(...connectionDriftItems);

    // Determine K8s API health status
    const k8sApiStatus = this.assessK8sApiHealth(k8sApiResponse);

    // Filter by severity threshold
    const filteredItems = this.filterBySeverity(driftItems);

    const comparisonTimeMs = performance.now() - startTime;

    return {
      enabled: true,
      hasDrift: filteredItems.length > 0,
      items: filteredItems,
      lastChecked,
      k8sApiStatus,
      comparisonTimeMs
    };
  }

  /**
   * Compare FGD switches with K8s switch status
   */
  private compareSwitches(fgdSwitches: Array<{ id: string; model: string; ports: number }>, k8sSwitches: SwitchStatus[]): FksDriftItem[] {
    const driftItems: FksDriftItem[] = [];
    const timestamp = new Date().toISOString();

    // Create maps for efficient lookup - normalize names for comparison
    const fgdSwitchMap = new Map(fgdSwitches.map(sw => [sw.id.toLowerCase(), sw]));
    const k8sSwitchMap = new Map(k8sSwitches.map(sw => [sw.metadata.name.toLowerCase(), sw]));

    // Check for missing switches in K8s
    for (const fgdSwitch of fgdSwitches) {
      if (!k8sSwitchMap.has(fgdSwitch.id.toLowerCase())) {
        driftItems.push({
          id: `missing-switch-${fgdSwitch.id.toLowerCase()}`,
          path: `switches/${fgdSwitch.id}`,
          type: 'switch',
          severity: 'high',
          description: `Switch ${fgdSwitch.id} missing from K8s cluster`,
          fgdValue: fgdSwitch.id,
          k8sValue: null,
          timestamp
        });
      }
    }

    // Check for unexpected switches in K8s
    for (const k8sSwitch of k8sSwitches) {
      if (!fgdSwitchMap.has(k8sSwitch.metadata.name.toLowerCase())) {
        const switchName = k8sSwitch.metadata.name.charAt(0).toUpperCase() + k8sSwitch.metadata.name.slice(1);
        driftItems.push({
          id: `unexpected-switch-${k8sSwitch.metadata.name}`,
          path: `switches/${switchName}`,
          type: 'switch',
          severity: 'medium',
          description: `Unexpected switch ${switchName} found in K8s cluster`,
          fgdValue: null,
          k8sValue: k8sSwitch.metadata.name,
          timestamp
        });
      }
    }

    // Compare existing switches for configuration drift
    for (const fgdSwitch of fgdSwitches) {
      const k8sSwitch = k8sSwitchMap.get(fgdSwitch.id.toLowerCase());
      if (k8sSwitch) {
        // Check model mismatch
        if (fgdSwitch.model !== k8sSwitch.spec.model) {
          driftItems.push({
            id: `switch-model-mismatch-${fgdSwitch.id.toLowerCase()}`,
            path: `switches/${fgdSwitch.id}/model`,
            type: 'switch',
            severity: 'high',
            description: `Switch ${fgdSwitch.id} model mismatch`,
            fgdValue: fgdSwitch.model,
            k8sValue: k8sSwitch.spec.model,
            timestamp
          });
        }

        // Check port count mismatch
        const fgdPortCount = fgdSwitch.ports;
        const k8sPortCount = k8sSwitch.spec.ports.total;
        if (fgdPortCount !== k8sPortCount) {
          driftItems.push({
            id: `switch-port-count-${fgdSwitch.id.toLowerCase()}`,
            path: `switches/${fgdSwitch.id}/ports`,
            type: 'switch',
            severity: 'medium',
            description: `Switch ${fgdSwitch.id} port count mismatch`,
            fgdValue: fgdPortCount,
            k8sValue: k8sPortCount,
            timestamp
          });
        }

        // Check for degraded switch health
        if (k8sSwitch.status.health !== 'Healthy') {
          driftItems.push({
            id: `switch-health-${fgdSwitch.id.toLowerCase()}`,
            path: `switches/${fgdSwitch.id}/health`,
            type: 'switch',
            severity: k8sSwitch.status.health === 'Failed' ? 'high' : 'medium',
            description: `Switch ${fgdSwitch.id} health status: ${k8sSwitch.status.health}`,
            fgdValue: 'Healthy',
            k8sValue: k8sSwitch.status.health,
            timestamp
          });
        }
      }
    }

    return driftItems;
  }

  /**
   * Compare FGD servers with K8s server status
   */
  private compareServers(fgdServers: Array<{ id: string; type: string; connections: number }>, k8sServers: ServerStatus[]): FksDriftItem[] {
    const driftItems: FksDriftItem[] = [];
    const timestamp = new Date().toISOString();

    const fgdServerMap = new Map(fgdServers.map(srv => [srv.id.toLowerCase(), srv]));
    const k8sServerMap = new Map(k8sServers.map(srv => [srv.metadata.name.toLowerCase(), srv]));

    // Check for missing servers in K8s
    for (const fgdServer of fgdServers) {
      if (!k8sServerMap.has(fgdServer.id.toLowerCase())) {
        driftItems.push({
          id: `missing-server-${fgdServer.id.toLowerCase()}`,
          path: `servers/${fgdServer.id}`,
          type: 'server',
          severity: 'high',
          description: `Server ${fgdServer.id} missing from K8s cluster`,
          fgdValue: fgdServer.id,
          k8sValue: null,
          timestamp
        });
      }
    }

    // Check for unexpected servers in K8s
    for (const k8sServer of k8sServers) {
      if (!fgdServerMap.has(k8sServer.metadata.name.toLowerCase())) {
        const normalizedName = k8sServer.metadata.name.charAt(0).toUpperCase() + k8sServer.metadata.name.slice(1);
        driftItems.push({
          id: `unexpected-server-${k8sServer.metadata.name}`,
          path: `servers/${normalizedName}`,
          type: 'server',
          severity: 'low',
          description: `Unexpected server ${normalizedName} found in K8s cluster`,
          fgdValue: null,
          k8sValue: k8sServer.metadata.name,
          timestamp
        });
      }
    }

    // Compare existing servers for configuration drift
    for (const fgdServer of fgdServers) {
      const k8sServer = k8sServerMap.get(fgdServer.id.toLowerCase());
      if (k8sServer) {
        // Check connectivity status
        if (k8sServer.status.connectivity !== 'Connected') {
          driftItems.push({
            id: `server-connectivity-${fgdServer.id.toLowerCase()}`,
            path: `servers/${fgdServer.id}/connectivity`,
            type: 'server',
            severity: k8sServer.status.connectivity === 'Disconnected' ? 'high' : 'medium',
            description: `Server ${fgdServer.id} connectivity: ${k8sServer.status.connectivity}`,
            fgdValue: 'Connected',
            k8sValue: k8sServer.status.connectivity,
            timestamp
          });
        }

        // Skip switch connection check - not available in current data model
      }
    }

    return driftItems;
  }

  /**
   * Compare FGD connections with K8s connection status
   */
  private compareConnections(fgdConnections: WiringDiagram['connections'], k8sConnections: ConnectionStatus[]): FksDriftItem[] {
    const driftItems: FksDriftItem[] = [];
    const timestamp = new Date().toISOString();

    // Create connection identifiers for comparison
    const fgdConnectionMap = new Map(
      fgdConnections.map(conn => [
        `${conn.from.device}-${conn.from.port}-${conn.to.device}-${conn.to.port}`,
        conn
      ])
    );

    const k8sConnectionMap = new Map(
      k8sConnections.map(conn => [
        `${conn.spec.source.device}-${conn.spec.source.port}-${conn.spec.target.device}-${conn.spec.target.port}`,
        conn
      ])
    );

    // Check for missing connections in K8s
    for (const [connId, fgdConnection] of fgdConnectionMap) {
      if (!k8sConnectionMap.has(connId)) {
        driftItems.push({
          id: `missing-connection-${connId.toLowerCase()}`,
          path: `connections/${connId}`,
          type: 'connection',
          severity: 'high',
          description: `Connection ${fgdConnection.from.device}:${fgdConnection.from.port} → ${fgdConnection.to.device}:${fgdConnection.to.port} missing from K8s`,
          fgdValue: `${fgdConnection.from.device}:${fgdConnection.from.port} → ${fgdConnection.to.device}:${fgdConnection.to.port}`,
          k8sValue: null,
          timestamp
        });
      }
    }

    // Check for unexpected connections in K8s
    for (const [connId, k8sConnection] of k8sConnectionMap) {
      if (!fgdConnectionMap.has(connId)) {
        driftItems.push({
          id: `unexpected-connection-${connId.toLowerCase()}`,
          path: `connections/${connId}`,
          type: 'connection',
          severity: 'medium',
          description: `Unexpected connection ${k8sConnection.spec.source.device}:${k8sConnection.spec.source.port} → ${k8sConnection.spec.target.device}:${k8sConnection.spec.target.port} found in K8s`,
          fgdValue: null,
          k8sValue: `${k8sConnection.spec.source.device}:${k8sConnection.spec.source.port} → ${k8sConnection.spec.target.device}:${k8sConnection.spec.target.port}`,
          timestamp
        });
      }
    }

    // Check connection health for existing connections
    for (const [connId, k8sConnection] of k8sConnectionMap) {
      if (fgdConnectionMap.has(connId)) {
        // Check link status
        if (k8sConnection.status.linkStatus !== 'Up') {
          const fgdConnection = fgdConnectionMap.get(connId)!;
          driftItems.push({
            id: `connection-status-${connId.toLowerCase()}`,
            path: `connections/${connId}/status`,
            type: 'connection',
            severity: k8sConnection.status.linkStatus === 'Down' ? 'high' : 'medium',
            description: `Connection ${fgdConnection.from.device}:${fgdConnection.from.port} → ${fgdConnection.to.device}:${fgdConnection.to.port} status: ${k8sConnection.status.linkStatus}`,
            fgdValue: 'Up',
            k8sValue: k8sConnection.status.linkStatus,
            timestamp
          });
        }

        // Check for errors
        if (k8sConnection.status.errors > 0) {
          const fgdConnection = fgdConnectionMap.get(connId)!;
          driftItems.push({
            id: `connection-errors-${connId.toLowerCase()}`,
            path: `connections/${connId}/errors`,
            type: 'connection',
            severity: k8sConnection.status.errors > 10 ? 'high' : 'low',
            description: `Connection ${fgdConnection.from.device}:${fgdConnection.from.port} → ${fgdConnection.to.device}:${fgdConnection.to.port} has ${k8sConnection.status.errors} errors`,
            fgdValue: 0,
            k8sValue: k8sConnection.status.errors,
            timestamp
          });
        }
      }
    }

    return driftItems;
  }

  /**
   * Assess K8s API health based on response patterns
   */
  private assessK8sApiHealth(apiResponse: FabricServicesApiResponse): 'healthy' | 'degraded' | 'unavailable' {
    // Check for signs of degraded API health
    const totalResources = apiResponse.items.switches.length + apiResponse.items.servers.length + apiResponse.items.connections.length;
    
    if (totalResources === 0) {
      return 'unavailable';
    }

    // Check for failed conditions across resources
    let failedConditions = 0;
    let totalConditions = 0;

    [...apiResponse.items.switches, ...apiResponse.items.servers, ...apiResponse.items.connections].forEach(resource => {
      totalConditions += resource.status.conditions.length;
      failedConditions += resource.status.conditions.filter(c => c.status === 'False').length;
    });

    const failureRate = totalConditions > 0 ? failedConditions / totalConditions : 0;

    if (failureRate > 0.5) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Filter drift items by severity threshold
   */
  private filterBySeverity(driftItems: FksDriftItem[]): FksDriftItem[] {
    if (this.options.severityThreshold === 'low') {
      return driftItems;
    }

    const severityOrder = { low: 0, medium: 1, high: 2 };
    const threshold = severityOrder[this.options.severityThreshold!];

    return driftItems.filter(item => severityOrder[item.severity] >= threshold);
  }
}

/**
 * Convenience function for quick FKS drift detection
 */
export async function detectFksDrift(
  fabricId: string,
  k8sApiResponse: FabricServicesApiResponse,
  fgdDiagram?: WiringDiagram,
  options?: FksDriftDetectionOptions
): Promise<FksDriftResult> {
  const detector = new FksDriftDetector(fabricId, options);
  return detector.detectDrift(k8sApiResponse, fgdDiagram);
}