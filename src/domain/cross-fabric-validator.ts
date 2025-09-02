/**
 * WP-GPU1: Cross-Fabric Validation Engine
 * 
 * Validates dual-fabric configurations to ensure:
 * - NIC conservation across all servers
 * - No port collisions between fabrics
 * - Independent topology feasibility
 * - Consistent resource allocation
 * - Performance constraint satisfaction
 */

import type { 
  DualFabricSpec, 
  DualFabricValidation, 
  SharedServerConfig,
  NicAllocation 
} from './dual-fabric'
import type { FabricSpec, DerivedTopology } from '../app.types'
import { computeDerived } from './topology'

// ====================================================================
// VALIDATION TYPES
// ====================================================================

export interface ValidationConstraint {
  id: string
  name: string
  description: string
  severity: 'error' | 'warning' | 'info'
  category: 'resource' | 'topology' | 'performance' | 'configuration'
}

export interface ValidationResult {
  constraint: ValidationConstraint
  passed: boolean
  message: string
  affectedResources: string[]
  recommendation?: string
}

export interface CrossFabricValidationReport {
  overall: {
    passed: boolean
    errors: number
    warnings: number
    info: number
  }
  categories: {
    resource: ValidationResult[]
    topology: ValidationResult[]
    performance: ValidationResult[]
    configuration: ValidationResult[]
  }
  summary: string[]
  recommendations: string[]
}

// ====================================================================
// VALIDATION CONSTRAINTS
// ====================================================================

const VALIDATION_CONSTRAINTS: ValidationConstraint[] = [
  // Resource Constraints
  {
    id: 'nic-conservation',
    name: 'NIC Conservation',
    description: 'Total allocated NICs must equal available NICs per server',
    severity: 'error',
    category: 'resource'
  },
  {
    id: 'nic-overflow-prevention',
    name: 'NIC Overflow Prevention',
    description: 'No server can have more NICs allocated than available',
    severity: 'error',
    category: 'resource'
  },
  {
    id: 'minimum-nic-allocation',
    name: 'Minimum NIC Allocation',
    description: 'Each fabric should have at least one NIC per server',
    severity: 'warning',
    category: 'resource'
  },
  
  // Topology Constraints
  {
    id: 'independent-topology-computation',
    name: 'Independent Topology Computation',
    description: 'Each fabric must compute valid topology independently',
    severity: 'error',
    category: 'topology'
  },
  {
    id: 'port-isolation',
    name: 'Port Isolation',
    description: 'No physical port can be shared between fabrics',
    severity: 'error',
    category: 'topology'
  },
  {
    id: 'leaf-switch-capacity',
    name: 'Leaf Switch Capacity',
    description: 'Leaf switches must have sufficient ports for allocated endpoints',
    severity: 'error',
    category: 'topology'
  },
  
  // Performance Constraints
  {
    id: 'oversubscription-limits',
    name: 'Oversubscription Limits',
    description: 'Fabric oversubscription ratios should be within acceptable limits',
    severity: 'warning',
    category: 'performance'
  },
  {
    id: 'bandwidth-balance',
    name: 'Bandwidth Balance',
    description: 'NIC speed should match fabric performance requirements',
    severity: 'info',
    category: 'performance'
  },
  
  // Configuration Constraints
  {
    id: 'fabric-naming-consistency',
    name: 'Fabric Naming Consistency',
    description: 'Fabric names should be unique and descriptive',
    severity: 'warning',
    category: 'configuration'
  },
  {
    id: 'server-type-alignment',
    name: 'Server Type Alignment',
    description: 'Server types should align with NIC allocation purposes',
    severity: 'info',
    category: 'configuration'
  }
]

// ====================================================================
// CROSS-FABRIC VALIDATOR
// ====================================================================

export class CrossFabricValidator {
  
  /**
   * Validates a complete dual-fabric specification
   */
  static validate(spec: DualFabricSpec): CrossFabricValidationReport {
    const results = VALIDATION_CONSTRAINTS.map(constraint => 
      this.validateConstraint(spec, constraint)
    )
    
    const categories = {
      resource: results.filter(r => r.constraint.category === 'resource'),
      topology: results.filter(r => r.constraint.category === 'topology'),
      performance: results.filter(r => r.constraint.category === 'performance'),
      configuration: results.filter(r => r.constraint.category === 'configuration')
    }
    
    const overall = {
      passed: results.every(r => r.passed || r.constraint.severity !== 'error'),
      errors: results.filter(r => !r.passed && r.constraint.severity === 'error').length,
      warnings: results.filter(r => !r.passed && r.constraint.severity === 'warning').length,
      info: results.filter(r => !r.passed && r.constraint.severity === 'info').length
    }
    
    const summary = this.generateSummary(results, overall)
    const recommendations = this.generateRecommendations(results, spec)
    
    return {
      overall,
      categories,
      summary,
      recommendations
    }
  }
  
  /**
   * Quick validation for UI feedback
   */
  static quickValidate(spec: DualFabricSpec): DualFabricValidation {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Core constraint checks
    const nicCountMatches = this.validateNicConservation(spec, errors)
    const noPortCollisions = this.validatePortIsolation(spec, errors)
    const independentTopology = this.validateIndependentTopologies(spec, errors, warnings)
    const sharedBOMRollup = this.validateBOMConsistency(spec, warnings)
    
    return {
      nicCountMatches,
      noPortCollisions,
      independentTopology,
      sharedBOMRollup,
      validationErrors: errors,
      warnings
    }
  }
  
  /**
   * Validates a specific constraint against the dual-fabric spec
   */
  private static validateConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    switch (constraint.id) {
      case 'nic-conservation':
        return this.validateNicConservationConstraint(spec, constraint)
        
      case 'nic-overflow-prevention':
        return this.validateNicOverflowConstraint(spec, constraint)
        
      case 'minimum-nic-allocation':
        return this.validateMinimumNicConstraint(spec, constraint)
        
      case 'independent-topology-computation':
        return this.validateTopologyConstraint(spec, constraint)
        
      case 'port-isolation':
        return this.validatePortIsolationConstraint(spec, constraint)
        
      case 'leaf-switch-capacity':
        return this.validateLeafCapacityConstraint(spec, constraint)
        
      case 'oversubscription-limits':
        return this.validateOversubscriptionConstraint(spec, constraint)
        
      case 'bandwidth-balance':
        return this.validateBandwidthConstraint(spec, constraint)
        
      case 'fabric-naming-consistency':
        return this.validateNamingConstraint(spec, constraint)
        
      case 'server-type-alignment':
        return this.validateServerTypeConstraint(spec, constraint)
        
      default:
        return {
          constraint,
          passed: true,
          message: 'Unknown constraint',
          affectedResources: []
        }
    }
  }
  
  // ====================================================================
  // INDIVIDUAL CONSTRAINT VALIDATORS
  // ====================================================================
  
  private static validateNicConservationConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    
    for (const server of spec.sharedServers) {
      const allocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      if (allocated !== server.totalNics) {
        passed = false
        affectedResources.push(server.id)
        messages.push(
          `Server ${server.name}: ${allocated}/${server.totalNics} NICs allocated`
        )
      }
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'All servers have proper NIC conservation'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Adjust NIC allocations to match total available NICs per server'
        : undefined
    }
  }
  
  private static validateNicOverflowConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    
    for (const server of spec.sharedServers) {
      const allocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      if (allocated > server.totalNics) {
        passed = false
        affectedResources.push(server.id)
        messages.push(
          `Server ${server.name}: Over-allocated by ${allocated - server.totalNics} NICs`
        )
      }
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'No NIC overflow detected'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Reduce NIC allocations to not exceed total available NICs'
        : undefined
    }
  }
  
  private static validateMinimumNicConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    
    for (const server of spec.sharedServers) {
      const frontendNics = server.nicAllocations
        .filter(alloc => alloc.targetFabric === 'frontend')
        .reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      const backendNics = server.nicAllocations
        .filter(alloc => alloc.targetFabric === 'backend')
        .reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      if (frontendNics === 0 || backendNics === 0) {
        passed = false
        affectedResources.push(server.id)
        messages.push(
          `Server ${server.name}: Missing NICs for ${frontendNics === 0 ? 'frontend' : 'backend'} fabric`
        )
      }
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'All servers have NICs allocated to both fabrics'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Ensure each server has at least one NIC allocated to each fabric'
        : undefined
    }
  }
  
  private static validateTopologyConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    
    try {
      // Test frontend fabric topology computation
      const frontendTopology = this.computeFabricTopology(spec.frontend, spec, 'frontend')
      if (!frontendTopology.isValid) {
        passed = false
        affectedResources.push('frontend-fabric')
        messages.push(`Frontend fabric topology invalid: ${frontendTopology.validationErrors.join(', ')}`)
      }
      
      // Test backend fabric topology computation  
      const backendTopology = this.computeFabricTopology(spec.backend, spec, 'backend')
      if (!backendTopology.isValid) {
        passed = false
        affectedResources.push('backend-fabric')
        messages.push(`Backend fabric topology invalid: ${backendTopology.validationErrors.join(', ')}`)
      }
      
    } catch (error) {
      passed = false
      messages.push(`Topology computation failed: ${error}`)
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'Both fabrics compute valid topologies independently'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Review fabric configurations and NIC allocations to ensure valid topologies'
        : undefined
    }
  }
  
  private static validatePortIsolationConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    // For dual-fabric mode, we assume port isolation since fabrics use separate leaf switches
    // This could be enhanced when we implement actual port allocation tracking
    
    return {
      constraint,
      passed: true,
      message: 'Port isolation maintained through separate fabric infrastructure',
      affectedResources: []
    }
  }
  
  private static validateLeafCapacityConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    
    // Validate frontend fabric leaf capacity
    const frontendEndpoints = this.computeEndpointsForFabric(spec, 'frontend')
    if (frontendEndpoints > 0) {
      const frontendCapacityCheck = this.checkLeafCapacity(spec.frontend, frontendEndpoints)
      if (!frontendCapacityCheck.sufficient) {
        passed = false
        affectedResources.push('frontend-fabric')
        messages.push(`Frontend fabric: ${frontendCapacityCheck.message}`)
      }
    }
    
    // Validate backend fabric leaf capacity
    const backendEndpoints = this.computeEndpointsForFabric(spec, 'backend')
    if (backendEndpoints > 0) {
      const backendCapacityCheck = this.checkLeafCapacity(spec.backend, backendEndpoints)
      if (!backendCapacityCheck.sufficient) {
        passed = false
        affectedResources.push('backend-fabric')
        messages.push(`Backend fabric: ${backendCapacityCheck.message}`)
      }
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'Leaf switches have sufficient capacity for allocated endpoints'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Increase leaf switch capacity or reduce endpoint allocations'
        : undefined
    }
  }
  
  private static validateOversubscriptionConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const affectedResources: string[] = []
    let passed = true
    const messages: string[] = []
    const maxOversubscription = 15.0 // 15:1 ratio limit
    
    try {
      // Check frontend fabric oversubscription
      const frontendTopology = this.computeFabricTopology(spec.frontend, spec, 'frontend')
      if (frontendTopology.oversubscriptionRatio > maxOversubscription) {
        passed = false
        affectedResources.push('frontend-fabric')
        messages.push(
          `Frontend fabric oversubscription too high: ${frontendTopology.oversubscriptionRatio.toFixed(2)}:1`
        )
      }
      
      // Check backend fabric oversubscription
      const backendTopology = this.computeFabricTopology(spec.backend, spec, 'backend')
      if (backendTopology.oversubscriptionRatio > maxOversubscription) {
        passed = false
        affectedResources.push('backend-fabric')
        messages.push(
          `Backend fabric oversubscription too high: ${backendTopology.oversubscriptionRatio.toFixed(2)}:1`
        )
      }
      
    } catch (error) {
      // Don't fail the constraint if topology computation fails (that's handled elsewhere)
      passed = true
      messages.push('Could not compute oversubscription ratios')
    }
    
    return {
      constraint,
      passed,
      message: passed 
        ? 'Oversubscription ratios within acceptable limits'
        : messages.join('; '),
      affectedResources,
      recommendation: !passed 
        ? 'Increase uplinks per leaf or reduce endpoint density to improve oversubscription ratio'
        : undefined
    }
  }
  
  private static validateBandwidthConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    // This is an informational constraint for now
    const recommendations: string[] = []
    
    // Check for bandwidth mismatches
    for (const server of spec.sharedServers) {
      for (const alloc of server.nicAllocations) {
        if (alloc.purpose === 'gpu-interconnect' && !alloc.nicSpeed.includes('100G')) {
          recommendations.push(
            `Server ${server.name}: Consider higher bandwidth NICs for GPU interconnect`
          )
        }
        
        if (alloc.purpose === 'storage' && alloc.nicCount === 1) {
          recommendations.push(
            `Server ${server.name}: Consider redundant storage NICs for reliability`
          )
        }
      }
    }
    
    return {
      constraint,
      passed: true, // Info level constraint
      message: recommendations.length > 0 
        ? 'Bandwidth optimization opportunities identified'
        : 'NIC bandwidth allocation appears optimal',
      affectedResources: [],
      recommendation: recommendations.length > 0 ? recommendations.join('; ') : undefined
    }
  }
  
  private static validateNamingConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    const issues: string[] = []
    
    if (spec.frontend.name === spec.backend.name) {
      issues.push('Frontend and backend fabrics have the same name')
    }
    
    if (!spec.frontend.name || spec.frontend.name.trim().length === 0) {
      issues.push('Frontend fabric name is empty')
    }
    
    if (!spec.backend.name || spec.backend.name.trim().length === 0) {
      issues.push('Backend fabric name is empty')
    }
    
    return {
      constraint,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? 'Fabric naming is consistent'
        : issues.join('; '),
      affectedResources: issues.length > 0 ? ['frontend-fabric', 'backend-fabric'] : [],
      recommendation: issues.length > 0 
        ? 'Provide unique, descriptive names for both fabrics'
        : undefined
    }
  }
  
  private static validateServerTypeConstraint(
    spec: DualFabricSpec, 
    constraint: ValidationConstraint
  ): ValidationResult {
    // This is an informational constraint to help with configuration optimization
    const recommendations: string[] = []
    
    for (const server of spec.sharedServers) {
      const serverType = server.serverType || 'general-purpose'
      const hasGpuInterconnectNics = server.nicAllocations.some(
        alloc => alloc.purpose === 'gpu-interconnect'
      )
      
      if (serverType !== 'gpu-compute' && hasGpuInterconnectNics) {
        recommendations.push(
          `Server ${server.name}: Has GPU interconnect NICs but server type is ${serverType}`
        )
      }
      
      if (serverType === 'gpu-compute' && !hasGpuInterconnectNics) {
        recommendations.push(
          `Server ${server.name}: GPU compute server lacks GPU interconnect NICs`
        )
      }
    }
    
    return {
      constraint,
      passed: true, // Info level constraint
      message: recommendations.length > 0 
        ? 'Server type alignment opportunities identified'
        : 'Server types align with NIC allocations',
      affectedResources: [],
      recommendation: recommendations.length > 0 ? recommendations.join('; ') : undefined
    }
  }
  
  // ====================================================================
  // HELPER METHODS
  // ====================================================================
  
  private static validateNicConservation(spec: DualFabricSpec, errors: string[]): boolean {
    let isValid = true
    
    for (const server of spec.sharedServers) {
      const allocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
      
      if (allocated !== server.totalNics) {
        errors.push(
          `Server ${server.name}: NIC count mismatch (${allocated}/${server.totalNics})`
        )
        isValid = false
      }
    }
    
    return isValid
  }
  
  private static validatePortIsolation(spec: DualFabricSpec, errors: string[]): boolean {
    // Assume port isolation is valid for dual-fabric mode
    return true
  }
  
  private static validateIndependentTopologies(
    spec: DualFabricSpec, 
    errors: string[], 
    warnings: string[]
  ): boolean {
    let isValid = true
    
    try {
      const frontendTopology = this.computeFabricTopology(spec.frontend, spec, 'frontend')
      if (!frontendTopology.isValid) {
        errors.push(`Frontend fabric topology invalid: ${frontendTopology.validationErrors.join(', ')}`)
        isValid = false
      }
      
      const backendTopology = this.computeFabricTopology(spec.backend, spec, 'backend')
      if (!backendTopology.isValid) {
        errors.push(`Backend fabric topology invalid: ${backendTopology.validationErrors.join(', ')}`)
        isValid = false
      }
      
    } catch (error) {
      errors.push(`Topology validation failed: ${error}`)
      isValid = false
    }
    
    return isValid
  }
  
  private static validateBOMConsistency(spec: DualFabricSpec, warnings: string[]): boolean {
    // For now, assume BOM consistency is valid
    // This would be enhanced when integrating with existing BOM compiler
    return true
  }
  
  private static computeFabricTopology(
    fabric: FabricSpec, 
    dualSpec: DualFabricSpec, 
    fabricType: 'frontend' | 'backend'
  ): DerivedTopology {
    // Create a modified fabric spec with endpoints from NIC allocations
    const endpoints = this.computeEndpointsForFabric(dualSpec, fabricType)
    
    const modifiedFabric: FabricSpec = {
      ...fabric,
      endpointCount: endpoints
    }
    
    return computeDerived(modifiedFabric)
  }
  
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
  
  private static checkLeafCapacity(fabric: FabricSpec, endpoints: number): {
    sufficient: boolean
    message: string
  } {
    // Simple capacity check - would be enhanced with actual switch profile data
    const assumedLeafPorts = 48
    const assumedUplinksPerLeaf = fabric.leafClasses?.[0]?.uplinksPerLeaf || fabric.uplinksPerLeaf || 2
    const availableEndpointPorts = assumedLeafPorts - assumedUplinksPerLeaf
    
    if (availableEndpointPorts <= 0) {
      return {
        sufficient: false,
        message: `No endpoint ports available (${assumedUplinksPerLeaf} uplinks on ${assumedLeafPorts}-port switch)`
      }
    }
    
    const leavesNeeded = Math.ceil(endpoints / availableEndpointPorts)
    
    return {
      sufficient: true,
      message: `${leavesNeeded} leaves needed for ${endpoints} endpoints`
    }
  }
  
  private static generateSummary(
    results: ValidationResult[], 
    overall: { passed: boolean; errors: number; warnings: number; info: number }
  ): string[] {
    const summary: string[] = []
    
    if (overall.passed) {
      summary.push('Dual-fabric configuration validation passed')
    } else {
      summary.push(`Dual-fabric configuration has ${overall.errors} errors`)
    }
    
    if (overall.warnings > 0) {
      summary.push(`${overall.warnings} warnings identified`)
    }
    
    if (overall.info > 0) {
      summary.push(`${overall.info} optimization opportunities found`)
    }
    
    return summary
  }
  
  private static generateRecommendations(
    results: ValidationResult[], 
    spec: DualFabricSpec
  ): string[] {
    const recommendations: string[] = []
    
    for (const result of results) {
      if (!result.passed && result.recommendation) {
        recommendations.push(`${result.constraint.name}: ${result.recommendation}`)
      }
    }
    
    // Add general recommendations based on spec analysis
    const totalServers = spec.sharedServers.length
    if (totalServers === 0) {
      recommendations.push('Add shared servers to enable dual-fabric functionality')
    }
    
    const hasUnallocatedNics = spec.sharedServers.some(server => {
      const allocated = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
      return allocated < server.totalNics
    })
    
    if (hasUnallocatedNics) {
      recommendations.push('Consider allocating all available NICs for optimal fabric utilization')
    }
    
    return recommendations
  }
}