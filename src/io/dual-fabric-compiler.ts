/**
 * WP-GPU1: Dual-Fabric Compiler
 * 
 * Compiles dual-fabric specifications into independent FGD outputs with combined BOM analysis.
 * Each fabric computes topology independently while sharing physical server resources.
 * 
 * Key Features:
 * - Independent FGD generation per fabric
 * - Combined BOM with per-fabric breakdown
 * - Shared resource tracking and optimization
 * - Cross-fabric validation integration
 */

import type { 
  DualFabricSpec, 
  DualFabricOutput, 
  FGDOutput,
  BOMAnalysis,
  SharedResourceReport
} from '../domain/dual-fabric'
import type { FabricSpec, DerivedTopology, WiringDiagram } from '../app.types'
import { computeDerived } from '../domain/topology'
import { CrossFabricValidator } from '../domain/cross-fabric-validator'
import { generateSharedResourceReport } from '../domain/dual-fabric'

// ====================================================================
// DUAL FABRIC COMPILER
// ====================================================================

export class DualFabricCompiler {
  
  /**
   * Compiles a dual-fabric specification into complete output with validation
   */
  static async compile(spec: DualFabricSpec): Promise<DualFabricOutput> {
    // First validate the dual-fabric spec
    const validation = CrossFabricValidator.quickValidate(spec)
    
    if (!validation.nicCountMatches || !validation.independentTopology) {
      throw new Error(
        `Dual-fabric compilation failed: ${validation.validationErrors.join(', ')}`
      )
    }
    
    // Compile frontend fabric
    const frontendFGD = await this.compileFabric(spec.frontend, spec, 'frontend')
    
    // Compile backend fabric
    const backendFGD = await this.compileFabric(spec.backend, spec, 'backend')
    
    // Generate combined BOM
    const combinedBOM = this.generateCombinedBOM(frontendFGD, backendFGD, spec)
    
    // Generate shared resource report
    const sharedResources = generateSharedResourceReport(spec)
    
    return {
      frontendFGD,
      backendFGD,
      combinedBOM,
      sharedResources,
      validation
    }
  }
  
  /**
   * Compiles a single fabric within the dual-fabric context
   */
  private static async compileFabric(
    fabricSpec: FabricSpec,
    dualSpec: DualFabricSpec,
    fabricType: 'frontend' | 'backend'
  ): Promise<FGDOutput> {
    // Calculate endpoints allocated to this fabric
    const endpoints = this.computeEndpointsForFabric(dualSpec, fabricType)
    
    // Create modified fabric spec with allocated endpoints
    const modifiedFabricSpec: FabricSpec = {
      ...fabricSpec,
      endpointCount: endpoints,
      // Update leaf classes with computed endpoint counts
      leafClasses: fabricSpec.leafClasses?.map(leafClass => ({
        ...leafClass,
        endpointProfiles: leafClass.endpointProfiles.map(profile => ({
          ...profile,
          count: this.computeProfileEndpoints(dualSpec, fabricType, profile.name)
        }))
      }))
    }
    
    // Compute topology for this fabric
    const topology = computeDerived(modifiedFabricSpec)
    
    if (!topology.isValid) {
      throw new Error(
        `${fabricType} fabric topology invalid: ${topology.validationErrors.join(', ')}`
      )
    }
    
    // Generate devices based on topology
    const devices = this.generateDevices(modifiedFabricSpec, topology, fabricType)
    
    // Generate connections based on allocation
    const connections = this.generateConnections(modifiedFabricSpec, topology, devices, fabricType)
    
    return {
      fabricId: `${dualSpec.id}-${fabricType}`,
      topology,
      devices,
      connections,
      metadata: {
        generatedAt: new Date(),
        fabricName: fabricSpec.name || `${fabricType} fabric`,
        totalDevices: devices.spines.length + devices.leaves.length + devices.servers.length
      }
    }
  }
  
  /**
   * Generates combined BOM with per-fabric breakdown
   */
  private static generateCombinedBOM(
    frontendFGD: FGDOutput,
    backendFGD: FGDOutput,
    spec: DualFabricSpec
  ): BOMAnalysis {
    // Generate individual BOMs
    const frontendBOM = this.generateFabricBOM(frontendFGD, 'frontend')
    const backendBOM = this.generateFabricBOM(backendFGD, 'backend')
    
    // Combine switches
    const switches = this.combineBOMItems(
      frontendBOM.switches,
      backendBOM.switches,
      'switches'
    )
    
    // Combine servers (servers are shared, so we need to merge carefully)
    const servers = this.combineSharedServers(spec)
    
    // Combine cables
    const cables = this.combineBOMItems(
      frontendBOM.cables,
      backendBOM.cables,
      'cables'
    )
    
    // Combine transceivers
    const transceivers = this.combineBOMItems(
      frontendBOM.transceivers,
      backendBOM.transceivers,
      'transceivers'
    )
    
    // Calculate summary
    const summary = {
      frontendCost: frontendBOM.summary.totalCost,
      backendCost: backendBOM.summary.totalCost,
      sharedCost: servers.reduce((sum, server) => sum + (server.totalCost || 0), 0),
      totalCost: 0
    }
    summary.totalCost = summary.frontendCost + summary.backendCost + summary.sharedCost
    
    return {
      switches,
      servers,
      cables,
      transceivers,
      summary
    }
  }
  
  /**
   * Computes endpoints allocated to a specific fabric
   */
  private static computeEndpointsForFabric(
    spec: DualFabricSpec,
    fabricType: 'frontend' | 'backend'
  ): number {
    return spec.sharedServers.reduce((total, server) => {
      const fabricNics = server.nicAllocations
        .filter(alloc => alloc.targetFabric === fabricType)
        .reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      return total + fabricNics
    }, 0)
  }
  
  /**
   * Computes endpoints for a specific endpoint profile within a fabric
   */
  private static computeProfileEndpoints(
    spec: DualFabricSpec,
    fabricType: 'frontend' | 'backend',
    profileName: string
  ): number {
    // For now, distribute endpoints evenly across profiles
    // This could be enhanced with more sophisticated allocation logic
    const totalEndpoints = this.computeEndpointsForFabric(spec, fabricType)
    const fabric = fabricType === 'frontend' ? spec.frontend : spec.backend
    
    const profileCount = fabric.leafClasses?.reduce((sum, leafClass) => 
      sum + leafClass.endpointProfiles.length, 0) || 1
    
    return Math.floor(totalEndpoints / profileCount)
  }
  
  /**
   * Generates devices for a fabric based on topology
   */
  private static generateDevices(
    fabricSpec: FabricSpec,
    topology: DerivedTopology,
    fabricType: 'frontend' | 'backend'
  ) {
    const spines = Array.from({ length: topology.spinesNeeded }, (_, i) => ({
      id: `${fabricType}-spine-${i + 1}`,
      model: fabricSpec.spineModelId,
      ports: 48, // DS3000 default
      type: 'spine' as const,
      fabricType
    }))
    
    const leaves = Array.from({ length: topology.leavesNeeded }, (_, i) => ({
      id: `${fabricType}-leaf-${i + 1}`,
      model: fabricSpec.leafModelId,
      ports: 48, // DS2000 default
      type: 'leaf' as const,
      fabricType
    }))
    
    // Servers are generated based on NIC allocations
    const servers = this.generateFabricServers(fabricSpec, fabricType)
    
    return {
      spines,
      leaves,
      servers
    }
  }
  
  /**
   * Generates server devices for a specific fabric
   */
  private static generateFabricServers(
    fabricSpec: FabricSpec,
    fabricType: 'frontend' | 'backend'
  ) {
    // Server generation would be based on the dual-fabric spec's shared servers
    // For now, return a basic structure
    return []
  }
  
  /**
   * Generates connections for a fabric based on allocation
   */
  private static generateConnections(
    fabricSpec: FabricSpec,
    topology: DerivedTopology,
    devices: any,
    fabricType: 'frontend' | 'backend'
  ) {
    const connections: any[] = []
    
    // Generate spine-to-leaf connections
    const uplinksPerLeaf = fabricSpec.leafClasses?.[0]?.uplinksPerLeaf || 
                          fabricSpec.uplinksPerLeaf || 2
    
    for (let leafIdx = 0; leafIdx < devices.leaves.length; leafIdx++) {
      for (let uplinkIdx = 0; uplinkIdx < uplinksPerLeaf; uplinkIdx++) {
        const spineIdx = (leafIdx * uplinksPerLeaf + uplinkIdx) % devices.spines.length
        
        connections.push({
          from: {
            device: devices.leaves[leafIdx].id,
            port: `Et1/${uplinkIdx + 1}`
          },
          to: {
            device: devices.spines[spineIdx].id,
            port: `Et1/${leafIdx * uplinksPerLeaf + uplinkIdx + 1}`
          },
          type: 'uplink'
        })
      }
    }
    
    // Server-to-leaf connections would be generated based on NIC allocations
    // This would be enhanced with actual server allocation logic
    
    return connections
  }
  
  /**
   * Generates BOM for a single fabric
   */
  private static generateFabricBOM(
    fgd: FGDOutput,
    fabricType: 'frontend' | 'backend'
  ): BOMAnalysis {
    const switches = [
      ...fgd.devices.spines.map(spine => ({
        model: spine.model,
        quantity: 1,
        unitCost: fabricType === 'frontend' ? 50000 : 45000, // Mock pricing
        totalCost: fabricType === 'frontend' ? 50000 : 45000,
        fabric: fabricType as 'frontend' | 'backend'
      })),
      ...fgd.devices.leaves.map(leaf => ({
        model: leaf.model,
        quantity: 1,
        unitCost: 25000, // Mock pricing
        totalCost: 25000,
        fabric: fabricType as 'frontend' | 'backend'
      }))
    ]
    
    const servers: BOMAnalysis['servers'] = []
    
    const cables = fgd.connections.map((conn, idx) => ({
      type: 'DAC-3m',
      length: '3m',
      quantity: 1,
      unitCost: 100,
      totalCost: 100,
      fabric: fabricType as 'frontend' | 'backend'
    }))
    
    const transceivers = fgd.connections.map((conn, idx) => ({
      type: '25G-SFP28',
      quantity: 2, // One per connection end
      unitCost: 150,
      totalCost: 300,
      fabric: fabricType as 'frontend' | 'backend'
    }))
    
    const totalCost = switches.reduce((sum, item) => sum + item.totalCost, 0) +
                     servers.reduce((sum, item) => sum + item.totalCost, 0) +
                     cables.reduce((sum, item) => sum + item.totalCost, 0) +
                     transceivers.reduce((sum, item) => sum + item.totalCost, 0)
    
    return {
      switches,
      servers,
      cables,
      transceivers,
      summary: {
        totalCost,
        frontendCost: fabricType === 'frontend' ? totalCost : 0,
        backendCost: fabricType === 'backend' ? totalCost : 0,
        sharedCost: 0
      }
    }
  }
  
  /**
   * Combines BOM items from multiple fabrics
   */
  private static combineBOMItems<T extends { model?: string; type?: string; quantity: number; totalCost?: number }>(
    frontendItems: T[],
    backendItems: T[],
    itemType: string
  ): T[] {
    const combined: T[] = []
    const itemMap = new Map<string, T>()
    
    // Process frontend items
    for (const item of frontendItems) {
      const key = item.model || item.type || `${itemType}-item`
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!
        existing.quantity += item.quantity
        existing.totalCost = (existing.totalCost || 0) + (item.totalCost || 0)
      } else {
        itemMap.set(key, { ...item })
      }
    }
    
    // Process backend items
    for (const item of backendItems) {
      const key = item.model || item.type || `${itemType}-item`
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!
        existing.quantity += item.quantity
        existing.totalCost = (existing.totalCost || 0) + (item.totalCost || 0)
      } else {
        itemMap.set(key, { ...item })
      }
    }
    
    return Array.from(itemMap.values())
  }
  
  /**
   * Combines shared servers from dual-fabric spec
   */
  private static combineSharedServers(spec: DualFabricSpec): BOMAnalysis['servers'] {
    return spec.sharedServers.map(server => ({
      type: server.serverType || 'general-purpose',
      quantity: 1,
      unitCost: this.estimateServerCost(server),
      totalCost: this.estimateServerCost(server),
      fabric: 'shared' as const
    }))
  }
  
  /**
   * Estimates server cost based on configuration
   */
  private static estimateServerCost(server: any): number {
    const baseCost = 10000 // Base server cost
    const nicCost = server.totalNics * 500 // Cost per NIC
    const typeCostMultiplier = server.serverType === 'gpu-compute' ? 3 : 
                              server.serverType === 'storage' ? 1.5 : 1
    
    return Math.round((baseCost + nicCost) * typeCostMultiplier)
  }
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Validates that a dual-fabric spec can be compiled
 */
export function validateDualFabricCompilation(spec: DualFabricSpec): {
  canCompile: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Basic structure validation
  if (!spec.frontend || !spec.backend) {
    errors.push('Both frontend and backend fabric specifications are required')
  }
  
  if (spec.sharedServers.length === 0) {
    warnings.push('No shared servers defined - dual fabric will have no endpoints')
  }
  
  // NIC allocation validation
  for (const server of spec.sharedServers) {
    const allocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
    
    if (allocated > server.totalNics) {
      errors.push(`Server ${server.name}: Over-allocated NICs (${allocated}/${server.totalNics})`)
    }
    
    if (allocated < server.totalNics) {
      warnings.push(`Server ${server.name}: Under-allocated NICs (${allocated}/${server.totalNics})`)
    }
  }
  
  // Fabric endpoint validation
  const frontendEndpoints = spec.sharedServers.reduce((sum, server) => 
    sum + server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'frontend')
      .reduce((nicSum, alloc) => nicSum + alloc.nicCount, 0), 0)
      
  const backendEndpoints = spec.sharedServers.reduce((sum, server) => 
    sum + server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'backend')
      .reduce((nicSum, alloc) => nicSum + alloc.nicCount, 0), 0)
  
  if (frontendEndpoints === 0) {
    warnings.push('Frontend fabric has no allocated endpoints')
  }
  
  if (backendEndpoints === 0) {
    warnings.push('Backend fabric has no allocated endpoints')
  }
  
  return {
    canCompile: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Computes resource utilization summary for dual-fabric spec
 */
export function computeDualFabricUtilization(spec: DualFabricSpec) {
  const totalServers = spec.sharedServers.length
  const totalNics = spec.sharedServers.reduce((sum, server) => sum + server.totalNics, 0)
  
  const frontendNics = spec.sharedServers.reduce((sum, server) => 
    sum + server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'frontend')
      .reduce((nicSum, alloc) => nicSum + alloc.nicCount, 0), 0)
      
  const backendNics = spec.sharedServers.reduce((sum, server) => 
    sum + server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'backend')
      .reduce((nicSum, alloc) => nicSum + alloc.nicCount, 0), 0)
  
  const allocatedNics = frontendNics + backendNics
  const utilizationPercent = totalNics > 0 ? (allocatedNics / totalNics) * 100 : 0
  
  return {
    totalServers,
    totalNics,
    frontendNics,
    backendNics,
    allocatedNics,
    unallocatedNics: totalNics - allocatedNics,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10
  }
}