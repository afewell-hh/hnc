/**
 * Transceiver Counter - WP-BOM2
 * Specialized module for accurate transceiver counting with per-link-end methodology
 */

import { SKUService, getOptimalMedium } from '../catalog/sku.service'
import { type WiringDiagram, type WiringConnection } from '../app.types' 
import { type ExternalLink, type ExplicitPort } from './external-link'

export interface TransceiverRequirement {
  speed: string
  medium: 'fiber' | 'dac' | 'aoc'
  reach: string
  count: number
  source: 'fabric-uplink' | 'server-access' | 'external-border'
  details: {
    connectionType: string
    fromDevice: string
    toDevice: string
  }
}

export interface TransceiverAllocation {
  sku: string
  description: string
  totalCount: number
  requirements: TransceiverRequirement[]
  costPerUnit: number
  totalCost: number
}

export interface TransceiverAnalysis {
  allocations: TransceiverAllocation[]
  summary: {
    totalTransceivers: number
    totalCost: number
    bySpeed: Record<string, number>
    byMedium: Record<string, number>
    bySource: Record<string, number>
  }
}

/**
 * Count transceivers using per-link-end methodology
 * Each physical connection requires transceivers at BOTH ends
 */
export function countTransceivers(
  wiringDiagram: WiringDiagram,
  externalLinks: ExternalLink[] = []
): TransceiverAnalysis {
  const requirements: TransceiverRequirement[] = []

  // 1. Fabric uplinks (leaf-spine connections)  
  countFabricUplinks(wiringDiagram, requirements)

  // 2. Server access connections
  countServerConnections(wiringDiagram, requirements)

  // 3. External border connections
  countExternalConnections(externalLinks, requirements)

  // 4. Allocate transceivers based on requirements
  const allocations = allocateTransceivers(requirements)

  // 5. Generate summary
  const summary = summarizeTransceivers(allocations, requirements)

  return { allocations, summary }
}

/**
 * Count fabric uplink transceivers (leaf to spine)
 */
function countFabricUplinks(wiringDiagram: WiringDiagram, requirements: TransceiverRequirement[]) {
  const uplinkConnections = wiringDiagram.connections.filter(c => c.type === 'uplink')

  for (const connection of uplinkConnections) {
    // Each uplink requires 2 transceivers: 1 at leaf, 1 at spine
    const speed = inferUplinkSpeed(connection, wiringDiagram)
    const medium = getOptimalMedium('3m') // Fabric interconnect typically short reach
    
    requirements.push({
      speed,
      medium,
      reach: '3m',
      count: 2, // Both ends of the connection
      source: 'fabric-uplink',
      details: {
        connectionType: 'uplink',
        fromDevice: connection.from.device,
        toDevice: connection.to.device
      }
    })
  }
}

/**
 * Count server access transceivers
 */
function countServerConnections(wiringDiagram: WiringDiagram, requirements: TransceiverRequirement[]) {
  const serverConnections = wiringDiagram.connections.filter(c => c.type === 'endpoint')

  for (const connection of serverConnections) {
    // Server connections: 1 transceiver at leaf end (server has built-in NIC)
    const speed = inferServerSpeed(connection, wiringDiagram)
    const medium = getOptimalMedium('3m')
    
    requirements.push({
      speed,
      medium,
      reach: '3m',
      count: 1, // Only leaf end needs transceiver
      source: 'server-access',
      details: {
        connectionType: 'endpoint',
        fromDevice: connection.from.device,
        toDevice: connection.to.device
      }
    })
  }
}

/**
 * Count external border transceivers
 */
function countExternalConnections(externalLinks: ExternalLink[], requirements: TransceiverRequirement[]) {
  for (const externalLink of externalLinks) {
    if (!externalLink.enabled) continue

    const ports = getExternalPorts(externalLink)
    
    for (const port of ports) {
      // Each external port requires 2 transceivers: 1 at border leaf, 1 at external router
      const medium: 'fiber' | 'dac' | 'aoc' = 'fiber' // External typically fiber for reach
      
      requirements.push({
        speed: port.speed,
        medium,
        reach: '10km', // External links typically longer reach
        count: port.count * 2, // Both ends for each port
        source: 'external-border',
        details: {
          connectionType: 'external',
          fromDevice: 'border-leaf',
          toDevice: externalLink.name
        }
      })
    }
  }
}

/**
 * Allocate transceiver SKUs based on requirements
 */
function allocateTransceivers(requirements: TransceiverRequirement[]): TransceiverAllocation[] {
  // Group requirements by speed, medium, and reach for optimal SKU selection
  const allocationMap = new Map<string, {
    sku: string
    totalCount: number
    requirements: TransceiverRequirement[]
  }>()

  for (const req of requirements) {
    try {
      const sku = SKUService.getTransceiverSKU(req.speed, req.reach, req.medium)
      const key = `${sku}`
      
      if (!allocationMap.has(key)) {
        allocationMap.set(key, {
          sku,
          totalCount: 0,
          requirements: []
        })
      }

      const allocation = allocationMap.get(key)!
      allocation.totalCount += req.count
      allocation.requirements.push(req)
    } catch (error) {
      console.warn(`Failed to allocate transceiver for ${req.speed}: ${error}`)
      
      // Fallback to generic SKU
      const fallbackSku = `GEN-${req.speed.replace('G', 'G')}-TRANSCEIVER`
      const key = fallbackSku
      
      if (!allocationMap.has(key)) {
        allocationMap.set(key, {
          sku: fallbackSku,
          totalCount: 0,
          requirements: []
        })
      }

      const allocation = allocationMap.get(key)!
      allocation.totalCount += req.count
      allocation.requirements.push(req)
    }
  }

  // Convert to final allocations with pricing
  return Array.from(allocationMap.values()).map(allocation => {
    const details = SKUService.getSKUDetails(allocation.sku)
    
    return {
      sku: allocation.sku,
      description: details.description,
      totalCount: allocation.totalCount,
      requirements: allocation.requirements,
      costPerUnit: details.price,
      totalCost: details.price * allocation.totalCount
    }
  }).sort((a, b) => a.sku.localeCompare(b.sku))
}

/**
 * Generate transceiver summary statistics
 */
function summarizeTransceivers(
  allocations: TransceiverAllocation[],
  requirements: TransceiverRequirement[]
): TransceiverAnalysis['summary'] {
  const totalTransceivers = allocations.reduce((sum, a) => sum + a.totalCount, 0)
  const totalCost = allocations.reduce((sum, a) => sum + a.totalCost, 0)

  const bySpeed: Record<string, number> = {}
  const byMedium: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  for (const req of requirements) {
    bySpeed[req.speed] = (bySpeed[req.speed] || 0) + req.count
    byMedium[req.medium] = (byMedium[req.medium] || 0) + req.count
    bySource[req.source] = (bySource[req.source] || 0) + req.count
  }

  return {
    totalTransceivers,
    totalCost,
    bySpeed,
    byMedium,
    bySource
  }
}

// Helper functions

/**
 * Infer uplink speed from connection context
 */
function inferUplinkSpeed(connection: WiringConnection, wiringDiagram: WiringDiagram): string {
  // Look for speed hints in port names or device models
  const portName = connection.from.port.toLowerCase()
  
  if (portName.includes('400g') || portName.includes('400')) return '400G'
  if (portName.includes('100g') || portName.includes('100')) return '100G'
  if (portName.includes('25g') || portName.includes('25')) return '25G'
  
  // Default to 100G for modern fabric uplinks
  return '100G'
}

/**
 * Infer server connection speed
 */
function inferServerSpeed(connection: WiringConnection, wiringDiagram: WiringDiagram): string {
  const portName = connection.to.port.toLowerCase()
  
  if (portName.includes('100g')) return '100G'
  if (portName.includes('10g')) return '10G'
  
  // Default to 25G for modern server connections
  return '25G'
}

/**
 * Get external link port specifications
 */
function getExternalPorts(externalLink: ExternalLink): ExplicitPort[] {
  if (externalLink.mode === 'explicit-ports' && externalLink.explicitPorts) {
    return externalLink.explicitPorts
  }

  // Convert target bandwidth to ports
  if (externalLink.mode === 'target-bandwidth' && externalLink.targetGbps) {
    const speed = externalLink.preferredSpeed || '100G'
    const speedValue = parseInt(speed.replace('G', ''))
    const portsNeeded = Math.ceil(externalLink.targetGbps / speedValue)
    
    return [{ speed: speed as any, count: portsNeeded }]
  }

  return []
}

/**
 * Validate transceiver count against wiring diagram
 */
export function validateTransceiverCount(
  wiringDiagram: WiringDiagram,
  transceiverAnalysis: TransceiverAnalysis
): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  // Check total connection count vs transceiver count
  const totalConnections = wiringDiagram.connections.length
  const uplinkConnections = wiringDiagram.connections.filter(c => c.type === 'uplink').length
  const serverConnections = wiringDiagram.connections.filter(c => c.type === 'endpoint').length

  // Expected: 2 per uplink + 1 per server connection
  const expectedMinimum = (uplinkConnections * 2) + serverConnections
  const actualCount = transceiverAnalysis.summary.totalTransceivers

  if (actualCount < expectedMinimum) {
    errors.push(`Insufficient transceivers: expected minimum ${expectedMinimum}, got ${actualCount}`)
  }

  // Check for reasonable ratios
  const transceiverToConnectionRatio = actualCount / (totalConnections || 1)
  if (transceiverToConnectionRatio < 1.0) {
    warnings.push(`Low transceiver-to-connection ratio: ${transceiverToConnectionRatio.toFixed(2)}`)
  } else if (transceiverToConnectionRatio > 3.0) {
    warnings.push(`High transceiver-to-connection ratio: ${transceiverToConnectionRatio.toFixed(2)} - check for overprovisioning`)
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  }
}