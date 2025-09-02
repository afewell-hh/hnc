/**
 * BOM Compiler Engine - WP-BOM2  
 * Converts wiring diagrams and external links to accurate Bill of Materials
 */

import { SKUService } from '../catalog/sku.service'
import { calculateBreakoutFeasibility, type LeafModel } from './leaf-capability-filter'
import { type ExternalLink, type ExplicitPort } from './external-link'
import { type WiringDiagram, type WiringDevice, type WiringConnection } from '../app.types'

export interface BOMItem {
  sku: string
  description: string
  quantity: number
  source: 'switch-hardware' | 'leaf-uplink' | 'spine-downlink' | 'external-link' | 'server-connection' | 'breakout-cable'
  unitPrice?: number
  totalPrice?: number
  category: 'switch' | 'transceiver' | 'breakout' | 'cable'
  details?: {
    deviceId?: string
    connectionType?: string
    speed?: string
    medium?: string
  }
}

export interface BOMSummary {
  totalSwitches: number
  totalTransceivers: number
  totalBreakouts: number
  totalCables: number
  totalCost: number
  costBreakdown: Record<string, number>
  utilizationStats: {
    averagePortUtilization: number
    transceiverEfficiency: number
  }
}

export interface BOMAnalysis {
  switches: BOMItem[]
  transceivers: BOMItem[]  
  breakouts: BOMItem[]
  cables: BOMItem[]
  summary: BOMSummary
  metadata: {
    fabricName: string
    generatedAt: Date
    wiringDeviceCount: number
    connectionCount: number
    externalLinkCount: number
  }
}

/**
 * Main BOM compilation function
 * Analyzes wiring diagram and external links to produce comprehensive BOM
 */
export function compileBOM(
  wiringDiagram: WiringDiagram,
  externalLinks: ExternalLink[] = [],
  leafModels: LeafModel[] = [],
  spineModels: LeafModel[] = [] // Reusing LeafModel interface for consistency
): BOMAnalysis {
  try {
    const bomItems = {
      switches: [] as BOMItem[],
      transceivers: [] as BOMItem[],
      breakouts: [] as BOMItem[],
      cables: [] as BOMItem[]
    }

    // 1. Count switch hardware
    countSwitches(wiringDiagram, bomItems.switches)

    // 2. Count transceivers (per physical link end)
    countTransceivers(wiringDiagram, externalLinks, bomItems.transceivers)

    // 3. Count breakout cables  
    countBreakouts(wiringDiagram, leafModels, bomItems.breakouts)

    // 4. Count additional cables if needed
    countCables(wiringDiagram, bomItems.cables)

    // 5. Calculate pricing for all items
    addPricingToBOM(bomItems)

    // 6. Generate summary
    const summary = calculateBOMSummary(bomItems, wiringDiagram)

    return {
      switches: bomItems.switches,
      transceivers: bomItems.transceivers,
      breakouts: bomItems.breakouts,
      cables: bomItems.cables,
      summary,
      metadata: {
        fabricName: wiringDiagram.metadata?.fabricName || 'Unknown Fabric',
        generatedAt: new Date(),
        wiringDeviceCount: getTotalDeviceCount(wiringDiagram),
        connectionCount: wiringDiagram.connections.length,
        externalLinkCount: externalLinks.length
      }
    }
  } catch (error) {
    throw new Error(`BOM compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Count switch hardware requirements
 */
function countSwitches(wiringDiagram: WiringDiagram, switches: BOMItem[]) {
  // Group devices by model
  const switchCounts = new Map<string, number>()

  // Count spines
  for (const spine of wiringDiagram.devices.spines) {
    switchCounts.set(spine.model, (switchCounts.get(spine.model) || 0) + 1)
  }

  // Count leaves  
  for (const leaf of wiringDiagram.devices.leaves) {
    switchCounts.set(leaf.model, (switchCounts.get(leaf.model) || 0) + 1)
  }

  // Convert to BOM items
  for (const [model, count] of switchCounts) {
    const sku = SKUService.getSwitchSKU(model)
    switches.push({
      sku,
      description: SKUService.getSKUDetails(sku).description,
      quantity: count,
      source: 'switch-hardware',
      category: 'switch',
      details: {
        deviceId: model
      }
    })
  }
}

/**
 * Count transceivers with per-link-end methodology
 * Critical: Each physical connection requires transceivers at BOTH ends
 */
function countTransceivers(
  wiringDiagram: WiringDiagram,
  externalLinks: ExternalLink[],
  transceivers: BOMItem[]
) {
  const transceiverCounts = new Map<string, number>()

  // 1. Internal fabric connections (leaf-spine)
  for (const connection of wiringDiagram.connections) {
    if (connection.type === 'uplink') {
      // Each uplink requires 2 transceivers: 1 at leaf, 1 at spine
      const speed = inferConnectionSpeed(connection, wiringDiagram)
      const sku = SKUService.getTransceiverSKU(speed, '100m', 'dac') // Default to DAC for fabric interconnect
      
      // Add 2 transceivers per uplink connection
      transceiverCounts.set(sku, (transceiverCounts.get(sku) || 0) + 2)
    } else if (connection.type === 'endpoint') {
      // Server connections: 1 transceiver at leaf end (server typically has built-in NIC)
      const speed = inferConnectionSpeed(connection, wiringDiagram)
      const sku = SKUService.getTransceiverSKU(speed, '3m', 'dac')
      
      transceiverCounts.set(sku, (transceiverCounts.get(sku) || 0) + 1)
    }
  }

  // 2. External link connections  
  for (const externalLink of externalLinks) {
    if (!externalLink.enabled) continue

    const ports = getExternalLinkPorts(externalLink)
    for (const port of ports) {
      // Each external link port requires 2 transceivers: 1 at border leaf, 1 at external router
      const sku = SKUService.getTransceiverSKU(port.speed, '10km', 'fiber') // External links typically fiber LR
      
      transceiverCounts.set(sku, (transceiverCounts.get(sku) || 0) + (port.count * 2))
    }
  }

  // Convert to BOM items
  for (const [sku, count] of transceiverCounts) {
    transceivers.push({
      sku,
      description: SKUService.getSKUDetails(sku).description,
      quantity: count,
      source: count > 100 ? 'leaf-uplink' : 'server-connection', // Heuristic for source classification
      category: 'transceiver'
    })
  }
}

/**
 * Count breakout cables based on wiring requirements  
 */
function countBreakouts(
  wiringDiagram: WiringDiagram,
  leafModels: LeafModel[],
  breakouts: BOMItem[]
) {
  // Analyze connections to identify breakout patterns
  const breakoutRequirements = new Map<string, number>()

  // Look for server connections that might require breakouts
  const serverConnections = wiringDiagram.connections.filter(c => c.type === 'endpoint')
  
  // Group by target leaf to analyze port usage patterns
  const leafPortUsage = new Map<string, Set<string>>()
  
  for (const connection of serverConnections) {
    const leafId = connection.to.device
    if (!leafPortUsage.has(leafId)) {
      leafPortUsage.set(leafId, new Set())
    }
    leafPortUsage.get(leafId)!.add(connection.to.port)
  }

  // Check for breakout patterns in port naming
  for (const [leafId, ports] of leafPortUsage) {
    const portList = Array.from(ports)
    
    // Look for breakout port naming patterns (e.g., "eth1/1/1", "eth1/1/2", etc.)
    const breakoutPorts = portList.filter(port => /\/\d+\/\d+$/.test(port))
    
    if (breakoutPorts.length > 0) {
      // Group by parent port (e.g., "eth1/1" from "eth1/1/1")
      const parentPorts = new Set(breakoutPorts.map(port => port.replace(/\/\d+$/, '')))
      
      for (const parentPort of parentPorts) {
        const childPorts = breakoutPorts.filter(port => port.startsWith(parentPort + '/'))
        
        if (childPorts.length >= 4) {
          // Likely 100G -> 4x25G breakout
          const sku = SKUService.getBreakoutSKU('100G', '25G', 4, 'dac')
          breakoutRequirements.set(sku, (breakoutRequirements.get(sku) || 0) + 1)
        }
      }
    }
  }

  // Convert to BOM items
  for (const [sku, count] of breakoutRequirements) {
    breakouts.push({
      sku,
      description: SKUService.getSKUDetails(sku).description,
      quantity: count,
      source: 'breakout-cable',
      category: 'breakout'
    })
  }
}

/**
 * Count additional cables (if needed beyond transceivers)
 */
function countCables(wiringDiagram: WiringDiagram, cables: BOMItem[]) {
  // For now, transceivers/DACs handle most connectivity
  // This function reserved for future cable requirements like patch panels
  
  // Example: Management cables
  const managementConnections = wiringDiagram.devices.spines.length + wiringDiagram.devices.leaves.length
  
  if (managementConnections > 0) {
    cables.push({
      sku: 'GEN-CAT6A-3M',
      description: 'Management network cables',
      quantity: managementConnections,
      source: 'switch-hardware',
      category: 'cable',
      details: {
        connectionType: 'management'
      }
    })
  }
}

/**
 * Add pricing information to all BOM items
 */
function addPricingToBOM(bomItems: { switches: BOMItem[], transceivers: BOMItem[], breakouts: BOMItem[], cables: BOMItem[] }) {
  const allItems = [...bomItems.switches, ...bomItems.transceivers, ...bomItems.breakouts, ...bomItems.cables]
  
  for (const item of allItems) {
    const details = SKUService.getSKUDetails(item.sku)
    item.unitPrice = details.price
    item.totalPrice = details.price * item.quantity
  }
}

/**
 * Calculate BOM summary statistics
 */
function calculateBOMSummary(
  bomItems: { switches: BOMItem[], transceivers: BOMItem[], breakouts: BOMItem[], cables: BOMItem[] },
  wiringDiagram: WiringDiagram
): BOMSummary {
  const totalSwitches = bomItems.switches.reduce((sum, item) => sum + item.quantity, 0)
  const totalTransceivers = bomItems.transceivers.reduce((sum, item) => sum + item.quantity, 0)
  const totalBreakouts = bomItems.breakouts.reduce((sum, item) => sum + item.quantity, 0)
  const totalCables = bomItems.cables.reduce((sum, item) => sum + item.quantity, 0)

  const costBreakdown: Record<string, number> = {}
  let totalCost = 0

  for (const category of ['switches', 'transceivers', 'breakouts', 'cables'] as const) {
    const categoryCost = bomItems[category].reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    costBreakdown[category] = categoryCost
    totalCost += categoryCost
  }

  // Calculate utilization stats
  const totalPorts = getTotalPortCount(wiringDiagram)
  const usedPorts = wiringDiagram.connections.length * 2 // Each connection uses 2 ports
  const averagePortUtilization = totalPorts > 0 ? (usedPorts / totalPorts) * 100 : 0

  const expectedTransceivers = wiringDiagram.connections.length * 2 // 2 per connection
  const transceiverEfficiency = expectedTransceivers > 0 ? (totalTransceivers / expectedTransceivers) * 100 : 0

  return {
    totalSwitches,
    totalTransceivers,
    totalBreakouts, 
    totalCables,
    totalCost,
    costBreakdown,
    utilizationStats: {
      averagePortUtilization: Math.round(averagePortUtilization),
      transceiverEfficiency: Math.round(transceiverEfficiency)
    }
  }
}

// Helper functions

/**
 * Infer connection speed from wiring diagram context
 */
function inferConnectionSpeed(connection: WiringConnection, wiringDiagram: WiringDiagram): string {
  // Look up device models to infer speeds
  const fromDevice = findDevice(connection.from.device, wiringDiagram)
  const toDevice = findDevice(connection.to.device, wiringDiagram)

  // Default speed inference based on connection type and device types
  if (connection.type === 'uplink') {
    // Leaf to spine typically 100G in modern fabrics
    return '100G'
  } else if (connection.type === 'endpoint') {
    // Server connections typically 25G
    return '25G' 
  }

  return '25G' // Fallback
}

/**
 * Find device in wiring diagram
 */
function findDevice(deviceId: string, wiringDiagram: WiringDiagram): WiringDevice | null {
  // Search all device types
  const allDevices = [
    ...wiringDiagram.devices.spines,
    ...wiringDiagram.devices.leaves,
    ...wiringDiagram.devices.servers
  ]

  return allDevices.find(d => d.id === deviceId) || null
}

/**
 * Get external link port specifications
 */
function getExternalLinkPorts(externalLink: ExternalLink): ExplicitPort[] {
  if (externalLink.mode === 'explicit-ports' && externalLink.explicitPorts) {
    return externalLink.explicitPorts
  }

  // Convert from target bandwidth if needed
  if (externalLink.mode === 'target-bandwidth' && externalLink.targetGbps) {
    // Simplified conversion - in practice would use external-link functions
    const speed = externalLink.preferredSpeed || '100G'
    const speedValue = parseInt(speed.replace('G', ''))
    const portsNeeded = Math.ceil(externalLink.targetGbps / speedValue)
    
    return [{ speed: speed as any, count: portsNeeded }]
  }

  return []
}

/**
 * Get total device count from wiring diagram
 */
function getTotalDeviceCount(wiringDiagram: WiringDiagram): number {
  return wiringDiagram.devices.spines.length + 
         wiringDiagram.devices.leaves.length + 
         wiringDiagram.devices.servers.length
}

/**
 * Get total port count across all devices
 */
function getTotalPortCount(wiringDiagram: WiringDiagram): number {
  return wiringDiagram.devices.spines.reduce((sum, d) => sum + d.ports, 0) +
         wiringDiagram.devices.leaves.reduce((sum, d) => sum + d.ports, 0) +
         wiringDiagram.devices.servers.reduce((sum, d) => sum + (d.connections || 1), 0)
}