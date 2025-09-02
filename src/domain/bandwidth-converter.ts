/**
 * Bandwidth Converter - WP-EXT1
 * Advanced bandwidth to ports conversion with optimization algorithms
 */

import type { ExplicitPort, BorderCapabilities } from './external-link'

export interface ConversionOptions {
  preferredSpeed?: '10G' | '25G' | '100G' | '400G'
  allowBreakout?: boolean
  optimizeFor?: 'efficiency' | 'simplicity' | 'cost'
  maxPortWaste?: number  // percentage (0-100)
  lagCompatible?: boolean
}

export interface ConversionResult {
  ports: ExplicitPort[]
  efficiency: number      // percentage of target bandwidth achieved
  simplicity: number      // lower = fewer different speeds used
  estimatedCost: number   // relative cost units
  portWaste: number       // unused ports from breakout
  breakoutRequired: BreakoutRequirement[]
  warnings: string[]
}

export interface BreakoutRequirement {
  parentSpeed: '100G' | '400G'
  childSpeed: '10G' | '25G' | '100G'
  parentPorts: number
  childPortsGenerated: number
  childPortsUsed: number
  efficiency: number
}

/**
 * Advanced bandwidth conversion with multiple optimization strategies
 */
export function convertBandwidthToPortsAdvanced(
  targetGbps: number,
  capabilities: BorderCapabilities,
  options: ConversionOptions = {}
): ConversionResult {
  const opts: Required<ConversionOptions> = {
    preferredSpeed: '100G',
    allowBreakout: true,
    optimizeFor: 'efficiency',
    maxPortWaste: 20,
    lagCompatible: false,
    ...options
  }

  // Generate all possible allocation strategies
  const strategies = generateAllocationStrategies(targetGbps, capabilities, opts)
  
  // Score and rank strategies
  const scoredStrategies = strategies.map(strategy => ({
    ...strategy,
    score: calculateStrategyScore(strategy, opts)
  }))

  // Select best strategy based on optimization preference
  const bestStrategy = selectBestStrategy(scoredStrategies, opts.optimizeFor)
  
  return bestStrategy
}

/**
 * Generate all feasible allocation strategies
 */
function generateAllocationStrategies(
  targetGbps: number,
  capabilities: BorderCapabilities,
  options: Required<ConversionOptions>
): ConversionResult[] {
  const strategies: ConversionResult[] = []

  // Strategy 1: Preferred speed only
  if (options.preferredSpeed) {
    const preferredStrategy = createSingleSpeedStrategy(
      targetGbps,
      options.preferredSpeed,
      capabilities
    )
    if (preferredStrategy) {
      strategies.push(preferredStrategy)
    }
  }

  // Strategy 2: Largest speeds first (greedy)
  const greedyStrategy = createGreedyStrategy(targetGbps, capabilities)
  if (greedyStrategy) {
    strategies.push(greedyStrategy)
  }

  // Strategy 3: Breakout-optimized if allowed
  if (options.allowBreakout) {
    const breakoutStrategies = createBreakoutStrategies(targetGbps, capabilities)
    strategies.push(...breakoutStrategies)
  }

  // Strategy 4: LAG-compatible if required
  if (options.lagCompatible) {
    const lagStrategies = createLAGCompatibleStrategies(targetGbps, capabilities)
    strategies.push(...lagStrategies)
  }

  // Strategy 5: Cost-optimized
  const costStrategy = createCostOptimizedStrategy(targetGbps, capabilities)
  if (costStrategy) {
    strategies.push(costStrategy)
  }

  return strategies.filter(s => 
    s.efficiency >= 80 && // Minimum efficiency threshold
    s.portWaste <= options.maxPortWaste
  )
}

/**
 * Create single-speed allocation strategy
 */
function createSingleSpeedStrategy(
  targetGbps: number,
  speed: string,
  capabilities: BorderCapabilities
): ConversionResult | null {
  const speedValue = parseSpeed(speed)
  const portsNeeded = Math.ceil(targetGbps / speedValue)
  
  if (portsNeeded > capabilities.maxPorts) {
    return null // Not feasible
  }

  const providedBandwidth = portsNeeded * speedValue
  const efficiency = Math.min(100, (targetGbps / providedBandwidth) * 100)

  return {
    ports: [{ speed: speed as any, count: portsNeeded }],
    efficiency: Math.round(efficiency),
    simplicity: 100, // Single speed = maximum simplicity
    estimatedCost: calculatePortsCost([{ speed: speed as any, count: portsNeeded }]),
    portWaste: 0, // No breakout waste for single speed
    breakoutRequired: [],
    warnings: efficiency < 90 ? [`${Math.round(100 - efficiency)}% overprovisioned`] : []
  }
}

/**
 * Create greedy allocation strategy (largest speeds first)
 */
function createGreedyStrategy(
  targetGbps: number,
  capabilities: BorderCapabilities
): ConversionResult {
  const allocation: ExplicitPort[] = []
  let remainingBandwidth = targetGbps
  let remainingPorts = capabilities.maxPorts

  const sortedSpeeds = capabilities.availableSpeeds
    .sort((a, b) => parseSpeed(b) - parseSpeed(a))

  for (const speed of sortedSpeeds) {
    if (remainingBandwidth <= 0 || remainingPorts <= 0) break

    const speedValue = parseSpeed(speed)
    const maxPortsOfThisSpeed = remainingPorts
    const optimalPorts = Math.ceil(remainingBandwidth / speedValue)
    const portsToUse = Math.min(optimalPorts, maxPortsOfThisSpeed)

    if (portsToUse > 0) {
      allocation.push({ speed: speed as any, count: portsToUse })
      remainingBandwidth -= portsToUse * speedValue
      remainingPorts -= portsToUse
    }
  }

  const providedBandwidth = calculateTotalBandwidth(allocation)
  const efficiency = Math.min(100, (targetGbps / providedBandwidth) * 100)
  const uniqueSpeeds = allocation.length
  const simplicity = Math.max(0, 100 - (uniqueSpeeds - 1) * 20) // Penalty for multiple speeds

  return {
    ports: allocation,
    efficiency: Math.round(efficiency),
    simplicity: Math.round(simplicity),
    estimatedCost: calculatePortsCost(allocation),
    portWaste: 0,
    breakoutRequired: [],
    warnings: []
  }
}

/**
 * Create breakout-optimized strategies
 */
function createBreakoutStrategies(
  targetGbps: number,
  capabilities: BorderCapabilities
): ConversionResult[] {
  const strategies: ConversionResult[] = []

  // Try each breakout pattern
  Object.entries(capabilities.breakoutCapability).forEach(([parentSpeed, patterns]) => {
    patterns.forEach(pattern => {
      const breakoutStrategy = createBreakoutStrategy(
        targetGbps,
        parentSpeed,
        pattern,
        capabilities
      )
      if (breakoutStrategy) {
        strategies.push(breakoutStrategy)
      }
    })
  })

  return strategies
}

/**
 * Create single breakout strategy
 */
function createBreakoutStrategy(
  targetGbps: number,
  parentSpeed: string,
  breakoutPattern: string,
  capabilities: BorderCapabilities
): ConversionResult | null {
  // Parse breakout pattern (e.g., "4x25G")
  const match = breakoutPattern.match(/(\d+)x(\d+G)/)
  if (!match) return null

  const breakoutFactor = parseInt(match[1])
  const childSpeed = match[2]
  const childSpeedValue = parseSpeed(childSpeed)
  
  const childPortsNeeded = Math.ceil(targetGbps / childSpeedValue)
  const parentPortsNeeded = Math.ceil(childPortsNeeded / breakoutFactor)
  
  if (parentPortsNeeded > capabilities.maxPorts) {
    return null // Not feasible
  }

  const childPortsGenerated = parentPortsNeeded * breakoutFactor
  const portWaste = Math.max(0, childPortsGenerated - childPortsNeeded)
  const wastePercentage = (portWaste / childPortsGenerated) * 100

  if (wastePercentage > 50) {
    return null // Too wasteful
  }

  const providedBandwidth = childPortsNeeded * childSpeedValue
  const efficiency = Math.min(100, (targetGbps / providedBandwidth) * 100)

  const breakoutReq: BreakoutRequirement = {
    parentSpeed: parentSpeed as any,
    childSpeed: childSpeed as any,
    parentPorts: parentPortsNeeded,
    childPortsGenerated,
    childPortsUsed: childPortsNeeded,
    efficiency: Math.round((childPortsNeeded / childPortsGenerated) * 100)
  }

  return {
    ports: [{ speed: childSpeed as any, count: childPortsNeeded }],
    efficiency: Math.round(efficiency),
    simplicity: 80, // Breakout reduces simplicity slightly
    estimatedCost: calculateBreakoutCost(parentPortsNeeded, parentSpeed, childPortsNeeded, childSpeed),
    portWaste: portWaste,
    breakoutRequired: [breakoutReq],
    warnings: wastePercentage > 20 ? [`${Math.round(wastePercentage)}% port waste from breakout`] : []
  }
}

/**
 * Create LAG-compatible strategies
 */
function createLAGCompatibleStrategies(
  targetGbps: number,
  capabilities: BorderCapabilities
): ConversionResult[] {
  if (!capabilities.lagSupport) {
    return []
  }

  const maxLagSize = capabilities.maxPortsPerLag || 8
  const strategies: ConversionResult[] = []

  // For each speed, try to create LAG-aligned allocations
  for (const speed of capabilities.availableSpeeds) {
    const speedValue = parseSpeed(speed)
    const portsNeeded = Math.ceil(targetGbps / speedValue)
    
    // Align to LAG boundaries
    const lagCount = Math.ceil(portsNeeded / maxLagSize)
    const alignedPorts = lagCount * maxLagSize

    if (alignedPorts <= capabilities.maxPorts) {
      const providedBandwidth = alignedPorts * speedValue
      const efficiency = Math.min(100, (targetGbps / providedBandwidth) * 100)

      strategies.push({
        ports: [{ speed: speed as any, count: alignedPorts }],
        efficiency: Math.round(efficiency),
        simplicity: 90, // LAG alignment is fairly simple
        estimatedCost: calculatePortsCost([{ speed: speed as any, count: alignedPorts }]),
        portWaste: 0,
        breakoutRequired: [],
        warnings: [`Aligned for ${lagCount} LAG group(s) of ${maxLagSize} ports each`]
      })
    }
  }

  return strategies
}

/**
 * Create cost-optimized strategy
 */
function createCostOptimizedStrategy(
  targetGbps: number,
  capabilities: BorderCapabilities
): ConversionResult | null {
  // Cost optimization typically favors lower speeds and higher port utilization
  const costRankedSpeeds = capabilities.availableSpeeds
    .sort((a, b) => {
      const costA = getSpeedCostPerGbps(a)
      const costB = getSpeedCostPerGbps(b)
      return costA - costB
    })

  // Use cheapest speed that can handle the bandwidth
  for (const speed of costRankedSpeeds) {
    const speedValue = parseSpeed(speed)
    const portsNeeded = Math.ceil(targetGbps / speedValue)
    
    if (portsNeeded <= capabilities.maxPorts) {
      const providedBandwidth = portsNeeded * speedValue
      const efficiency = Math.min(100, (targetGbps / providedBandwidth) * 100)

      return {
        ports: [{ speed: speed as any, count: portsNeeded }],
        efficiency: Math.round(efficiency),
        simplicity: 95, // Single speed = high simplicity
        estimatedCost: calculatePortsCost([{ speed: speed as any, count: portsNeeded }]),
        portWaste: 0,
        breakoutRequired: [],
        warnings: []
      }
    }
  }

  return null
}

/**
 * Calculate strategy score for ranking
 */
function calculateStrategyScore(
  result: ConversionResult,
  optimizeFor: 'efficiency' | 'simplicity' | 'cost'
): number {
  let score = 0

  switch (optimizeFor) {
    case 'efficiency':
      score = result.efficiency * 0.6 + 
              result.simplicity * 0.2 + 
              (100 - result.portWaste) * 0.2
      break
    
    case 'simplicity':
      score = result.simplicity * 0.6 + 
              result.efficiency * 0.3 + 
              (100 - result.portWaste) * 0.1
      break
    
    case 'cost':
      // Lower cost = higher score (invert cost with max 1000 assumption)
      const costScore = Math.max(0, 100 - (result.estimatedCost / 10))
      score = costScore * 0.5 + 
              result.efficiency * 0.3 + 
              result.simplicity * 0.2
      break
  }

  // Penalties
  score -= result.warnings.length * 5
  score -= result.breakoutRequired.length * 10

  return Math.max(0, Math.round(score))
}

/**
 * Select best strategy based on optimization preference
 */
function selectBestStrategy(
  strategies: (ConversionResult & { score: number })[],
  optimizeFor: 'efficiency' | 'simplicity' | 'cost'
): ConversionResult {
  if (strategies.length === 0) {
    // Fallback: return empty result
    return {
      ports: [],
      efficiency: 0,
      simplicity: 0,
      estimatedCost: 0,
      portWaste: 0,
      breakoutRequired: [],
      warnings: ['No feasible allocation strategy found']
    }
  }

  // Sort by score and return best
  const sorted = strategies.sort((a, b) => b.score - a.score)
  const best = sorted[0]

  // Remove the score property for return
  const { score, ...result } = best
  return result
}

/**
 * Helper functions
 */
function parseSpeed(speed: string): number {
  return parseInt(speed.replace('G', ''))
}

function calculateTotalBandwidth(ports: ExplicitPort[]): number {
  return ports.reduce((total, port) => total + (parseSpeed(port.speed) * port.count), 0)
}

function calculatePortsCost(ports: ExplicitPort[]): number {
  return ports.reduce((total, port) => {
    const speedCost = getSpeedCost(port.speed)
    return total + (speedCost * port.count)
  }, 0)
}

function calculateBreakoutCost(
  parentPorts: number,
  parentSpeed: string,
  childPorts: number,
  childSpeed: string
): number {
  // Breakout cost = parent port cost + breakout module cost
  const parentCost = getSpeedCost(parentSpeed) * parentPorts
  const breakoutModuleCost = parentPorts * 50 // Arbitrary breakout cost
  return parentCost + breakoutModuleCost
}

function getSpeedCost(speed: string): number {
  // Rough relative costs (arbitrary units)
  switch (speed) {
    case '10G': return 100
    case '25G': return 150
    case '100G': return 400
    case '400G': return 1200
    default: return 200
  }
}

function getSpeedCostPerGbps(speed: string): number {
  const cost = getSpeedCost(speed)
  const gbps = parseSpeed(speed)
  return cost / gbps
}

/**
 * Simple bandwidth conversion for basic use cases
 */
export function convertBandwidthToPortsSimple(
  targetGbps: number,
  preferredSpeed?: string,
  maxPorts: number = 48
): ExplicitPort[] {
  const speed = preferredSpeed || '100G'
  const speedValue = parseSpeed(speed)
  const portsNeeded = Math.ceil(targetGbps / speedValue)
  
  if (portsNeeded > maxPorts) {
    // Try next larger speed
    const largerSpeeds = ['100G', '400G'].filter(s => parseSpeed(s) > speedValue)
    if (largerSpeeds.length > 0) {
      return convertBandwidthToPortsSimple(targetGbps, largerSpeeds[0], maxPorts)
    }
    
    // Fallback to maximum ports at preferred speed
    return [{ speed: speed as any, count: maxPorts }]
  }
  
  return [{ speed: speed as any, count: portsNeeded }]
}