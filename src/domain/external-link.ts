/**
 * External Link Domain - WP-EXT1
 * External connectivity with target bandwidth planning
 */

import type { BorderCapabilities } from './leaf-capability-filter'

export interface ExternalLink {
  id: string
  name: string
  mode: 'target-bandwidth' | 'explicit-ports'  // default: target-bandwidth
  
  // Target Bandwidth Mode
  targetGbps?: number
  preferredSpeed?: '10G' | '25G' | '100G' | '400G'
  
  // Explicit Ports Mode  
  explicitPorts?: ExplicitPort[]

  // Additional metadata
  description?: string
  category: 'vpc.external' | 'vpc.staticExternal'
  enabled?: boolean
}

export interface ExplicitPort {
  speed: '10G' | '25G' | '100G' | '400G'
  count: number
}

export interface BorderCapabilities {
  maxPorts: number
  availableSpeeds: ('10G' | '25G' | '100G' | '400G')[]
  breakoutCapability: Record<string, string[]>
  lagSupport: boolean
  maxPortsPerLag?: number
}

export interface ExternalLinkAllocation {
  externalLink: ExternalLink
  allocatedPorts: ExplicitPort[]
  totalBandwidthGbps: number
  efficiency: number  // percentage of target bandwidth achieved
  portWaste: number   // unused ports from breakout
  warnings: string[]
  errors: string[]
}

/**
 * Convert target bandwidth to explicit port allocation
 */
export function convertBandwidthToPorts(
  targetGbps: number,
  preferredSpeed?: string,
  availableCapabilities?: BorderCapabilities
): ExplicitPort[] {
  if (targetGbps <= 0) {
    return []
  }

  const capabilities = availableCapabilities || getDefaultBorderCapabilities()
  const speeds = capabilities.availableSpeeds.sort((a, b) => 
    parseSpeed(b) - parseSpeed(a) // Sort by speed descending
  )

  // Try preferred speed first if provided and available
  if (preferredSpeed && capabilities.availableSpeeds.includes(preferredSpeed as any)) {
    const allocation = allocateWithSpeed(targetGbps, preferredSpeed, capabilities)
    if (allocation.length > 0) {
      return allocation
    }
  }

  // Greedy fallback: use largest available speeds first, ensuring we meet the target
  const allocation = allocateGreedy(targetGbps, speeds, capabilities)
  
  // Verify allocation meets target bandwidth and respects port limits
  const totalPorts = allocation.reduce((sum, port) => sum + port.count, 0)
  const actualBandwidth = allocation.reduce((sum, port) => sum + (parseSpeed(port.speed) * port.count), 0)
  
  // Calculate maximum possible bandwidth with available ports
  const maxPossibleBandwidth = capabilities.maxPorts * parseSpeed(speeds[0]) // Use highest speed
  
  // If target is impossible to achieve even with all ports, return empty array
  if (targetGbps > maxPossibleBandwidth) {
    return []
  }
  
  if (actualBandwidth < targetGbps && totalPorts < capabilities.maxPorts && allocation.length > 0) {
    // If we're close but slightly under and have port capacity, add one more port of the smallest available speed
    const smallestSpeed = speeds[speeds.length - 1]
    const lastPortGroup = allocation.find(p => p.speed === smallestSpeed)
    if (lastPortGroup) {
      lastPortGroup.count += 1
    } else {
      allocation.push({ speed: smallestSpeed as any, count: 1 })
    }
  }
  
  return allocation
}

/**
 * Allocate ports using a specific speed
 */
function allocateWithSpeed(
  targetGbps: number,
  speed: string,
  capabilities: BorderCapabilities
): ExplicitPort[] {
  const speedValue = parseSpeed(speed)
  const portsNeeded = Math.ceil(targetGbps / speedValue)
  
  if (portsNeeded > capabilities.maxPorts) {
    return [] // Cannot satisfy with this speed
  }

  return [{ speed: speed as any, count: portsNeeded }]
}

/**
 * Greedy allocation using largest speeds first
 */
function allocateGreedy(
  targetGbps: number,
  availableSpeeds: string[],
  capabilities: BorderCapabilities
): ExplicitPort[] {
  const allocation: ExplicitPort[] = []
  let remainingBandwidth = targetGbps
  let remainingPorts = capabilities.maxPorts

  for (const speed of availableSpeeds) {
    if (remainingBandwidth <= 0 || remainingPorts <= 0) break

    const speedValue = parseSpeed(speed)
    const maxPortsOfThisSpeed = Math.floor(remainingPorts)
    const portsNeeded = Math.min(
      Math.ceil(remainingBandwidth / speedValue),
      maxPortsOfThisSpeed
    )

    if (portsNeeded > 0) {
      allocation.push({ speed: speed as any, count: portsNeeded })
      remainingBandwidth -= portsNeeded * speedValue
      remainingPorts -= portsNeeded
    }
  }

  return allocation
}

/**
 * Parse speed string to numeric value
 */
function parseSpeed(speed: string): number {
  const numericValue = parseInt(speed.replace('G', ''))
  return numericValue
}

/**
 * Calculate total bandwidth from explicit port allocation
 */
export function calculateTotalBandwidth(ports: ExplicitPort[]): number {
  return ports.reduce((total, port) => {
    return total + (parseSpeed(port.speed) * port.count)
  }, 0)
}

/**
 * Validate external link configuration
 */
export function validateExternalLink(
  externalLink: ExternalLink,
  borderCapabilities?: BorderCapabilities
): ExternalLinkAllocation {
  const allocation: ExternalLinkAllocation = {
    externalLink,
    allocatedPorts: [],
    totalBandwidthGbps: 0,
    efficiency: 0,
    portWaste: 0,
    warnings: [],
    errors: []
  }

  try {
    // Validate basic fields
    if (!externalLink.name?.trim()) {
      allocation.errors.push('External link name is required')
    }

    if (externalLink.mode === 'target-bandwidth') {
      if (!externalLink.targetGbps || externalLink.targetGbps <= 0) {
        allocation.errors.push('Target bandwidth must be greater than 0')
      } else {
        // Calculate port allocation
        allocation.allocatedPorts = convertBandwidthToPorts(
          externalLink.targetGbps,
          externalLink.preferredSpeed,
          borderCapabilities
        )
        
        if (allocation.allocatedPorts.length === 0) {
          allocation.errors.push('Cannot satisfy bandwidth requirements with available border capacity')
        }
      }
    } else if (externalLink.mode === 'explicit-ports') {
      if (!externalLink.explicitPorts || externalLink.explicitPorts.length === 0) {
        allocation.errors.push('At least one port specification is required in explicit mode')
      } else {
        allocation.allocatedPorts = [...externalLink.explicitPorts]
      }
    }

    // Calculate metrics if we have valid allocation
    if (allocation.allocatedPorts.length > 0) {
      allocation.totalBandwidthGbps = calculateTotalBandwidth(allocation.allocatedPorts)
      
      if (externalLink.mode === 'target-bandwidth' && externalLink.targetGbps) {
        allocation.efficiency = Math.round(
          (Math.min(allocation.totalBandwidthGbps, externalLink.targetGbps) / 
           externalLink.targetGbps) * 100
        )
        
        if (allocation.totalBandwidthGbps > externalLink.targetGbps) {
          const excess = allocation.totalBandwidthGbps - externalLink.targetGbps
          allocation.warnings.push(
            `Overprovisioned by ${excess}Gbps (${Math.round(excess/externalLink.targetGbps*100)}% excess)`
          )
        }
      } else {
        allocation.efficiency = 100 // Explicit mode assumed to be what user wants
      }

      // Validate against border capabilities
      if (borderCapabilities) {
        const totalPorts = allocation.allocatedPorts.reduce((sum, p) => sum + p.count, 0)
        if (totalPorts > borderCapabilities.maxPorts) {
          allocation.errors.push(
            `Requires ${totalPorts} ports but border leaf only supports ${borderCapabilities.maxPorts}`
          )
        }

        // Check speed compatibility
        for (const portSpec of allocation.allocatedPorts) {
          if (!borderCapabilities.availableSpeeds.includes(portSpec.speed)) {
            allocation.errors.push(`${portSpec.speed} not supported by border leaf`)
          }
        }
      } else {
        // If no capabilities provided and we have a very large requirement, flag it
        const totalPorts = allocation.allocatedPorts.reduce((sum, p) => sum + p.count, 0)
        if (totalPorts > 128) { // Reasonable default maximum
          allocation.errors.push(`Requires ${totalPorts} ports which exceeds typical border capacity`)
        }
      }
    }

  } catch (error) {
    allocation.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return allocation
}

/**
 * Check divisibility across spine count for external links
 */
export function checkExternalDivisibility(
  externalLinks: ExternalLink[],
  spineCount: number,
  borderCapabilities?: BorderCapabilities
): { valid: boolean; severity: 'error' | 'warning' | 'ok'; messages: string[] } {
  if (spineCount === 0) {
    return {
      valid: false,
      severity: 'error',
      messages: ['Spine count must be greater than 0 for external link validation']
    }
  }

  const messages: string[] = []
  let worstSeverity: 'error' | 'warning' | 'ok' = 'ok'

  for (const link of externalLinks) {
    if (!link.enabled) continue

    const allocation = validateExternalLink(link, borderCapabilities)
    if (allocation.errors.length > 0) {
      messages.push(`${link.name}: ${allocation.errors.join(', ')}`)
      worstSeverity = 'error'
      continue
    }

    const totalPorts = allocation.allocatedPorts.reduce((sum, p) => sum + p.count, 0)
    
    if (totalPorts % spineCount !== 0) {
      const remainder = totalPorts % spineCount
      const wastePercentage = (remainder / totalPorts) * 100
      
      if (wastePercentage > 50) {
        messages.push(
          `${link.name}: ${remainder} ports cannot be evenly distributed across ${spineCount} spines (${Math.round(wastePercentage)}% waste)`
        )
        if (worstSeverity !== 'error') worstSeverity = 'error'
      } else if (wastePercentage > 10) {
        messages.push(
          `${link.name}: Uneven distribution across spines - ${remainder} unused connections (${Math.round(wastePercentage)}% waste)`
        )
        if (worstSeverity === 'ok') worstSeverity = 'warning'
      } else if (remainder > 0) {
        messages.push(
          `${link.name}: Minor inefficiency - ${remainder} unused connections (${Math.round(wastePercentage)}% waste)`
        )
        if (worstSeverity === 'ok') worstSeverity = 'warning'
      }
    }
  }

  return {
    valid: worstSeverity !== 'error',
    severity: worstSeverity,
    messages
  }
}

/**
 * Get default border capabilities for systems without explicit border config
 */
export function getDefaultBorderCapabilities(): BorderCapabilities {
  return {
    maxPorts: 32,
    availableSpeeds: ['10G', '25G', '100G', '400G'],
    breakoutCapability: {
      '100G': ['4x25G'],
      '400G': ['4x100G', '16x25G']
    },
    lagSupport: true,
    maxPortsPerLag: 8
  }
}

/**
 * Create a new external link with defaults
 */
export function createExternalLink(
  name: string,
  category: 'vpc.external' | 'vpc.staticExternal' = 'vpc.external'
): ExternalLink {
  return {
    id: `ext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    mode: 'target-bandwidth',
    category,
    enabled: true,
    targetGbps: 100, // Default to 100Gbps
    preferredSpeed: '100G'
  }
}

/**
 * Convert external link to explicit ports mode
 */
export function convertToExplicitMode(
  externalLink: ExternalLink,
  borderCapabilities?: BorderCapabilities
): ExternalLink {
  if (externalLink.mode === 'explicit-ports') {
    return externalLink // Already explicit
  }

  const explicitPorts = externalLink.targetGbps 
    ? convertBandwidthToPorts(externalLink.targetGbps, externalLink.preferredSpeed, borderCapabilities)
    : []

  return {
    ...externalLink,
    mode: 'explicit-ports',
    explicitPorts,
    // Clear target bandwidth fields since we're now explicit
    targetGbps: undefined,
    preferredSpeed: undefined
  }
}

/**
 * Convert external link to target bandwidth mode
 */
export function convertToBandwidthMode(
  externalLink: ExternalLink,
  targetGbps?: number
): ExternalLink {
  if (externalLink.mode === 'target-bandwidth') {
    return { ...externalLink, targetGbps: targetGbps || externalLink.targetGbps }
  }

  const calculatedBandwidth = externalLink.explicitPorts 
    ? calculateTotalBandwidth(externalLink.explicitPorts)
    : targetGbps || 100

  return {
    ...externalLink,
    mode: 'target-bandwidth',
    targetGbps: calculatedBandwidth,
    preferredSpeed: '100G',
    // Clear explicit ports since we're now target-based
    explicitPorts: undefined
  }
}