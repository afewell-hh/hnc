/**
 * WP-GPU1: Shared NIC Allocator
 * 
 * Handles the intelligent distribution of server NICs between frontend and backend fabrics.
 * Ensures NIC conservation, validates allocation constraints, and provides recommendations
 * for optimal NIC distribution based on workload patterns.
 */

import type { 
  SharedServerConfig, 
  NicAllocation, 
  DualFabricSpec,
  SharedResourceReport
} from './dual-fabric'

// ====================================================================
// NIC ALLOCATION TYPES
// ====================================================================

export interface NicAllocationStrategy {
  strategy: 'balanced' | 'frontend-heavy' | 'backend-heavy' | 'custom'
  frontendRatio?: number  // 0.0 to 1.0
  backendRatio?: number   // 0.0 to 1.0  
  purposes: Array<{
    purpose: 'compute' | 'storage' | 'gpu-interconnect' | 'management'
    targetFabric: 'frontend' | 'backend'
    priority: number // 1-5, higher = more important
  }>
}

export interface NicDistributionRecommendation {
  serverId: string
  recommendedAllocations: NicAllocation[]
  reasoning: string[]
  efficiency: number // 0-100%
  warnings: string[]
}

export interface NicAllocationAnalysis {
  totalServers: number
  totalNics: number
  currentAllocations: {
    frontend: number
    backend: number
    unallocated: number
  }
  utilizationScore: number // 0-100%
  recommendations: NicDistributionRecommendation[]
  issues: Array<{
    serverId: string
    type: 'over-allocation' | 'under-allocation' | 'imbalance' | 'inefficiency'
    message: string
    severity: 'low' | 'medium' | 'high'
  }>
}

// ====================================================================
// NIC ALLOCATION ENGINE
// ====================================================================

export class SharedNicAllocator {
  
  /**
   * Analyzes current NIC allocation and provides recommendations
   */
  static analyzeNicAllocation(spec: DualFabricSpec): NicAllocationAnalysis {
    const totalServers = spec.sharedServers.length
    const totalNics = spec.sharedServers.reduce((sum, server) => sum + server.totalNics, 0)
    
    const currentAllocations = {
      frontend: 0,
      backend: 0,
      unallocated: 0
    }
    
    const recommendations: NicDistributionRecommendation[] = []
    const issues: NicAllocationAnalysis['issues'] = []
    
    // Analyze each server
    for (const server of spec.sharedServers) {
      const serverAnalysis = this.analyzeServerNicAllocation(server)
      
      // Accumulate totals
      currentAllocations.frontend += serverAnalysis.allocatedNics.frontend
      currentAllocations.backend += serverAnalysis.allocatedNics.backend
      currentAllocations.unallocated += serverAnalysis.allocatedNics.unallocated
      
      // Generate recommendations
      const recommendation = this.generateServerRecommendation(server, spec)
      recommendations.push(recommendation)
      
      // Identify issues
      issues.push(...serverAnalysis.issues)
    }
    
    const utilizationScore = totalNics > 0 
      ? ((currentAllocations.frontend + currentAllocations.backend) / totalNics) * 100
      : 0
    
    return {
      totalServers,
      totalNics,
      currentAllocations,
      utilizationScore,
      recommendations,
      issues
    }
  }
  
  /**
   * Automatically distributes NICs across fabrics using specified strategy
   */
  static autoAllocateNics(
    servers: SharedServerConfig[],
    strategy: NicAllocationStrategy
  ): SharedServerConfig[] {
    return servers.map(server => {
      const autoAllocation = this.computeAutoAllocation(server, strategy)
      
      return {
        ...server,
        nicAllocations: autoAllocation
      }
    })
  }
  
  /**
   * Validates NIC allocation for a specific server
   */
  static validateServerAllocation(server: SharedServerConfig): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    
    const totalAllocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
    
    // Check for over-allocation
    if (totalAllocated > server.totalNics) {
      errors.push(
        `Server ${server.name} over-allocated: ${totalAllocated}/${server.totalNics} NICs`
      )
    }
    
    // Check for under-allocation
    if (totalAllocated < server.totalNics) {
      const unallocated = server.totalNics - totalAllocated
      warnings.push(
        `Server ${server.name} has ${unallocated} unallocated NICs`
      )
    }
    
    // Check for zero allocations
    if (totalAllocated === 0) {
      warnings.push(`Server ${server.name} has no NIC allocations`)
    }
    
    // Validate individual allocations
    for (const alloc of server.nicAllocations) {
      if (alloc.nicCount <= 0) {
        errors.push(`Server ${server.name}: Invalid NIC count ${alloc.nicCount}`)
      }
      
      if (!this.isValidNicSpeed(alloc.nicSpeed)) {
        warnings.push(`Server ${server.name}: Unusual NIC speed ${alloc.nicSpeed}`)
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Optimizes NIC allocation for maximum efficiency
   */
  static optimizeNicAllocation(spec: DualFabricSpec): DualFabricSpec {
    const optimizedServers = spec.sharedServers.map(server => {
      const optimized = this.optimizeServerAllocation(server, spec)
      return optimized
    })
    
    return {
      ...spec,
      sharedServers: optimizedServers
    }
  }
  
  // ====================================================================
  // PRIVATE HELPER METHODS
  // ====================================================================
  
  private static analyzeServerNicAllocation(server: SharedServerConfig) {
    const allocatedNics = {
      frontend: 0,
      backend: 0,
      unallocated: 0
    }
    
    const issues: NicAllocationAnalysis['issues'] = []
    
    for (const alloc of server.nicAllocations) {
      if (alloc.targetFabric === 'frontend') {
        allocatedNics.frontend += alloc.nicCount
      } else if (alloc.targetFabric === 'backend') {
        allocatedNics.backend += alloc.nicCount
      }
    }
    
    const totalAllocated = allocatedNics.frontend + allocatedNics.backend
    allocatedNics.unallocated = server.totalNics - totalAllocated
    
    // Detect issues
    if (totalAllocated > server.totalNics) {
      issues.push({
        serverId: server.id,
        type: 'over-allocation',
        message: `Over-allocated by ${totalAllocated - server.totalNics} NICs`,
        severity: 'high'
      })
    }
    
    if (allocatedNics.unallocated > server.totalNics * 0.2) {
      issues.push({
        serverId: server.id,
        type: 'under-allocation',
        message: `${allocatedNics.unallocated} NICs unallocated (${Math.round((allocatedNics.unallocated / server.totalNics) * 100)}%)`,
        severity: 'medium'
      })
    }
    
    // Check for imbalance
    const imbalanceThreshold = 0.8
    if (allocatedNics.frontend > 0 && allocatedNics.backend > 0) {
      const ratio = Math.min(allocatedNics.frontend, allocatedNics.backend) / 
                    Math.max(allocatedNics.frontend, allocatedNics.backend)
      
      if (ratio < 1 - imbalanceThreshold) {
        issues.push({
          serverId: server.id,
          type: 'imbalance',
          message: `Significant NIC imbalance between fabrics (${allocatedNics.frontend}:${allocatedNics.backend})`,
          severity: 'low'
        })
      }
    }
    
    return {
      allocatedNics,
      issues
    }
  }
  
  private static generateServerRecommendation(
    server: SharedServerConfig,
    spec: DualFabricSpec
  ): NicDistributionRecommendation {
    const reasoning: string[] = []
    const warnings: string[] = []
    
    // Analyze server type and generate recommendations
    const serverType = server.serverType || 'general-purpose'
    const totalNics = server.totalNics
    
    let recommendedAllocations: NicAllocation[] = []
    
    switch (serverType) {
      case 'gpu-compute':
        // GPU servers typically need more frontend NICs for compute
        const frontendNics = Math.ceil(totalNics * 0.7)
        const backendNics = totalNics - frontendNics
        
        recommendedAllocations = [
          {
            nicCount: frontendNics,
            nicSpeed: '25G',
            targetFabric: 'frontend',
            purpose: 'gpu-interconnect'
          },
          {
            nicCount: backendNics,
            nicSpeed: '100G',
            targetFabric: 'backend',
            purpose: 'storage'
          }
        ]
        
        reasoning.push(`GPU compute servers benefit from more frontend NICs for parallel workloads`)
        reasoning.push(`${frontendNics} frontend NICs for GPU interconnect, ${backendNics} backend NICs for storage`)
        break
        
      case 'storage':
        // Storage servers need more backend NICs
        const storageFrontend = Math.floor(totalNics * 0.3)
        const storageBackend = totalNics - storageFrontend
        
        recommendedAllocations = [
          {
            nicCount: storageFrontend,
            nicSpeed: '25G',
            targetFabric: 'frontend',
            purpose: 'compute'
          },
          {
            nicCount: storageBackend,
            nicSpeed: '100G',
            targetFabric: 'backend',
            purpose: 'storage'
          }
        ]
        
        reasoning.push(`Storage servers benefit from more backend NICs for high-throughput data access`)
        break
        
      default:
        // General purpose - balanced allocation
        const balancedFrontend = Math.ceil(totalNics / 2)
        const balancedBackend = totalNics - balancedFrontend
        
        recommendedAllocations = [
          {
            nicCount: balancedFrontend,
            nicSpeed: '25G',
            targetFabric: 'frontend',
            purpose: 'compute'
          },
          {
            nicCount: balancedBackend,
            nicSpeed: '25G',
            targetFabric: 'backend',
            purpose: 'storage'
          }
        ]
        
        reasoning.push(`Balanced allocation for general-purpose servers`)
        break
    }
    
    // Calculate efficiency score
    const efficiency = this.calculateAllocationEfficiency(recommendedAllocations, server)
    
    return {
      serverId: server.id,
      recommendedAllocations,
      reasoning,
      efficiency,
      warnings
    }
  }
  
  private static computeAutoAllocation(
    server: SharedServerConfig,
    strategy: NicAllocationStrategy
  ): NicAllocation[] {
    const totalNics = server.totalNics
    
    switch (strategy.strategy) {
      case 'balanced':
        return this.createBalancedAllocation(server, totalNics)
        
      case 'frontend-heavy':
        return this.createFrontendHeavyAllocation(server, totalNics)
        
      case 'backend-heavy':
        return this.createBackendHeavyAllocation(server, totalNics)
        
      case 'custom':
        return this.createCustomAllocation(server, strategy)
        
      default:
        return this.createBalancedAllocation(server, totalNics)
    }
  }
  
  private static createBalancedAllocation(
    server: SharedServerConfig,
    totalNics: number
  ): NicAllocation[] {
    const frontendNics = Math.ceil(totalNics / 2)
    const backendNics = totalNics - frontendNics
    
    return [
      {
        nicCount: frontendNics,
        nicSpeed: '25G',
        targetFabric: 'frontend',
        purpose: 'compute'
      },
      {
        nicCount: backendNics,
        nicSpeed: '25G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  }
  
  private static createFrontendHeavyAllocation(
    server: SharedServerConfig,
    totalNics: number
  ): NicAllocation[] {
    const frontendNics = Math.ceil(totalNics * 0.75)
    const backendNics = totalNics - frontendNics
    
    return [
      {
        nicCount: frontendNics,
        nicSpeed: '25G',
        targetFabric: 'frontend',
        purpose: 'compute'
      },
      ...(backendNics > 0 ? [{
        nicCount: backendNics,
        nicSpeed: '25G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }] : [])
    ]
  }
  
  private static createBackendHeavyAllocation(
    server: SharedServerConfig,
    totalNics: number
  ): NicAllocation[] {
    const backendNics = Math.ceil(totalNics * 0.75)
    const frontendNics = totalNics - backendNics
    
    return [
      ...(frontendNics > 0 ? [{
        nicCount: frontendNics,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'compute' as const
      }] : []),
      {
        nicCount: backendNics,
        nicSpeed: '25G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  }
  
  private static createCustomAllocation(
    server: SharedServerConfig,
    strategy: NicAllocationStrategy
  ): NicAllocation[] {
    const frontendRatio = strategy.frontendRatio || 0.5
    const backendRatio = strategy.backendRatio || (1 - frontendRatio)
    
    const frontendNics = Math.floor(server.totalNics * frontendRatio)
    const backendNics = Math.floor(server.totalNics * backendRatio)
    
    return [
      ...(frontendNics > 0 ? [{
        nicCount: frontendNics,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'compute' as const
      }] : []),
      ...(backendNics > 0 ? [{
        nicCount: backendNics,
        nicSpeed: '25G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }] : [])
    ]
  }
  
  private static optimizeServerAllocation(
    server: SharedServerConfig,
    spec: DualFabricSpec
  ): SharedServerConfig {
    // For now, return the server as-is
    // This would implement advanced optimization logic based on workload patterns
    return server
  }
  
  private static calculateAllocationEfficiency(
    allocations: NicAllocation[],
    server: SharedServerConfig
  ): number {
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
    const utilization = totalAllocated / server.totalNics
    
    // Simple efficiency calculation - could be enhanced with workload-aware scoring
    return Math.min(utilization * 100, 100)
  }
  
  private static isValidNicSpeed(speed: string): boolean {
    const validSpeeds = ['1G', '10G', '25G', '40G', '50G', '100G', '200G', '400G']
    return validSpeeds.includes(speed)
  }
}

// ====================================================================
// NIC ALLOCATION UTILITIES
// ====================================================================

export function createDefaultNicAllocation(
  totalNics: number,
  serverType: 'gpu-compute' | 'storage' | 'general-purpose' = 'general-purpose'
): NicAllocation[] {
  return SharedNicAllocator.autoAllocateNics([{
    id: 'temp',
    name: 'temp',
    totalNics,
    serverType,
    nicAllocations: []
  }], {
    strategy: 'balanced',
    purposes: []
  })[0].nicAllocations
}

export function validateNicAllocationSum(allocations: NicAllocation[], totalNics: number): boolean {
  const sum = allocations.reduce((total, alloc) => total + alloc.nicCount, 0)
  return sum === totalNics
}

export function getNicAllocationSummary(allocations: NicAllocation[]): {
  frontend: number
  backend: number
  total: number
} {
  const summary = { frontend: 0, backend: 0, total: 0 }
  
  for (const alloc of allocations) {
    if (alloc.targetFabric === 'frontend') {
      summary.frontend += alloc.nicCount
    } else if (alloc.targetFabric === 'backend') {
      summary.backend += alloc.nicCount
    }
    summary.total += alloc.nicCount
  }
  
  return summary
}