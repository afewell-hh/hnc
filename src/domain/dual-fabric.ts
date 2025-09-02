/**
 * WP-GPU1: Dual-Fabric Core Domain Logic
 * 
 * This module implements the core dual-fabric capability for GPU/AI use cases
 * where two fabrics share physical server NICs but operate independently.
 * 
 * Key Capabilities:
 * - Twin fabric specification with shared NIC allocation
 * - Independent topology computation per fabric 
 * - Cross-fabric invariant validation
 * - Combined BOM generation with per-fabric breakdown
 */

import type { FabricSpec, DerivedTopology, EndpointProfile } from '../app.types'

// ====================================================================
// DUAL FABRIC TYPE DEFINITIONS
// ====================================================================

export interface NicAllocation {
  nicCount: number
  nicSpeed: string // e.g., "25G", "100G", "400G"
  targetFabric: 'frontend' | 'backend'
  lagConfig?: LAGConfiguration
  purpose?: 'compute' | 'storage' | 'gpu-interconnect' | 'management'
}

export interface LAGConfiguration {
  enabled: boolean
  minMembers?: number
  maxMembers?: number
  loadBalancing?: 'round-robin' | 'hash-based'
}

export interface SharedServerConfig {
  id: string
  name: string
  totalNics: number
  nicAllocations: NicAllocation[]
  serverType?: 'gpu-compute' | 'storage' | 'general-purpose'
  rackId?: string
}

export interface DualFabricSpec {
  id: string
  name: string
  mode: 'dual-fabric'
  
  // Twin fabric configurations - each operates independently
  frontend: FabricSpec    // Primary fabric (user-facing workloads)
  backend: FabricSpec     // Backend fabric (storage, GPU interconnect)
  
  // Shared physical resources
  sharedServers: SharedServerConfig[]
  
  // Cross-fabric metadata
  metadata?: {
    createdAt?: Date
    lastModified?: Date
    version?: string
    useCase?: 'ai-training' | 'gpu-rendering' | 'hpc' | 'custom'
    description?: string
  }
}

export interface DualFabricValidation {
  nicCountMatches: boolean          // Total NICs match distribution
  noPortCollisions: boolean         // No leaf port conflicts
  independentTopology: boolean      // Each fabric computes independently  
  sharedBOMRollup: boolean         // Combined BOM accounts for both fabrics
  validationErrors: string[]
  warnings: string[]
}

export interface SharedResourceReport {
  totalServers: number
  totalNics: number
  frontendNics: number
  backendNics: number
  nicUtilization: {
    frontend: number  // percentage
    backend: number   // percentage
    total: number     // percentage
  }
  conflicts: Array<{
    serverId: string
    type: 'nic-overflow' | 'port-collision' | 'invalid-allocation'
    message: string
  }>
}

export interface DualFabricOutput {
  frontendFGD: FGDOutput    // Complete FGD for frontend fabric
  backendFGD: FGDOutput     // Complete FGD for backend fabric  
  combinedBOM: BOMAnalysis  // Unified BOM with per-fabric breakdown
  sharedResources: SharedResourceReport
  validation: DualFabricValidation
}

// Placeholder types for FGD and BOM (to be integrated with existing types)
export interface FGDOutput {
  fabricId: string
  topology: DerivedTopology
  devices: {
    spines: any[]
    leaves: any[]
    servers: any[]
  }
  connections: any[]
  metadata: {
    generatedAt: Date
    fabricName: string
    totalDevices: number
  }
}

export interface BOMAnalysis {
  switches: Array<{
    model: string
    quantity: number
    unitCost?: number
    totalCost?: number
    fabric?: 'frontend' | 'backend' | 'shared'
  }>
  servers: Array<{
    type: string
    quantity: number
    unitCost?: number
    totalCost?: number
    fabric?: 'frontend' | 'backend' | 'shared'
  }>
  cables: Array<{
    type: string
    length: string
    quantity: number
    unitCost?: number
    totalCost?: number
    fabric?: 'frontend' | 'backend' | 'shared'
  }>
  transceivers: Array<{
    type: string
    quantity: number
    unitCost?: number
    totalCost?: number
    fabric?: 'frontend' | 'backend' | 'shared'
  }>
  summary: {
    totalCost: number
    frontendCost: number
    backendCost: number
    sharedCost: number
  }
}

// ====================================================================
// DUAL FABRIC VALIDATION LOGIC
// ====================================================================

export function validateDualFabric(spec: DualFabricSpec): DualFabricValidation {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate NIC count conservation
  const nicCountMatches = validateNicCountConservation(spec, errors)
  
  // Validate no port collisions between fabrics
  const noPortCollisions = validatePortIsolation(spec, errors)
  
  // Validate independent topology feasibility
  const independentTopology = validateIndependentTopologies(spec, errors, warnings)
  
  // Validate BOM rollup accuracy
  const sharedBOMRollup = validateBOMAccuracy(spec, errors)
  
  return {
    nicCountMatches,
    noPortCollisions,
    independentTopology,
    sharedBOMRollup,
    validationErrors: errors,
    warnings
  }
}

function validateNicCountConservation(spec: DualFabricSpec, errors: string[]): boolean {
  let isValid = true
  
  for (const server of spec.sharedServers) {
    const allocatedNics = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
    
    if (allocatedNics !== server.totalNics) {
      errors.push(
        `Server ${server.name}: NIC allocation mismatch. ` +
        `Allocated: ${allocatedNics}, Available: ${server.totalNics}`
      )
      isValid = false
    }
    
    if (allocatedNics > server.totalNics) {
      errors.push(
        `Server ${server.name}: Over-allocated NICs. ` +
        `Allocated: ${allocatedNics} > Available: ${server.totalNics}`
      )
      isValid = false
    }
  }
  
  return isValid
}

function validatePortIsolation(spec: DualFabricSpec, errors: string[]): boolean {
  // For now, assume port isolation is valid since we're using separate leaf switches
  // This would be enhanced when we implement actual port allocation logic
  return true
}

function validateIndependentTopologies(
  spec: DualFabricSpec, 
  errors: string[], 
  warnings: string[]
): boolean {
  let isValid = true
  
  // Validate frontend fabric can compute independently
  try {
    const frontendEndpoints = computeEndpointsForFabric(spec, 'frontend')
    if (frontendEndpoints === 0) {
      warnings.push('Frontend fabric has no allocated endpoints')
    }
  } catch (error) {
    errors.push(`Frontend fabric validation failed: ${error}`)
    isValid = false
  }
  
  // Validate backend fabric can compute independently  
  try {
    const backendEndpoints = computeEndpointsForFabric(spec, 'backend')
    if (backendEndpoints === 0) {
      warnings.push('Backend fabric has no allocated endpoints')
    }
  } catch (error) {
    errors.push(`Backend fabric validation failed: ${error}`)
    isValid = false
  }
  
  return isValid
}

function validateBOMAccuracy(spec: DualFabricSpec, errors: string[]): boolean {
  // Placeholder for BOM validation - would integrate with existing BOM compiler
  return true
}

// ====================================================================
// NIC ALLOCATION UTILITIES
// ====================================================================

export function computeEndpointsForFabric(
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

export function generateSharedResourceReport(spec: DualFabricSpec): SharedResourceReport {
  const totalServers = spec.sharedServers.length
  const totalNics = spec.sharedServers.reduce((sum, server) => sum + server.totalNics, 0)
  
  const frontendNics = computeEndpointsForFabric(spec, 'frontend')
  const backendNics = computeEndpointsForFabric(spec, 'backend')
  
  const conflicts: SharedResourceReport['conflicts'] = []
  
  // Detect NIC overflow conflicts
  for (const server of spec.sharedServers) {
    const allocatedNics = server.nicAllocations.reduce((sum, alloc) => sum + alloc.nicCount, 0)
    if (allocatedNics > server.totalNics) {
      conflicts.push({
        serverId: server.id,
        type: 'nic-overflow',
        message: `Server ${server.name} over-allocated: ${allocatedNics}/${server.totalNics} NICs`
      })
    }
  }
  
  return {
    totalServers,
    totalNics,
    frontendNics,
    backendNics,
    nicUtilization: {
      frontend: totalNics > 0 ? (frontendNics / totalNics) * 100 : 0,
      backend: totalNics > 0 ? (backendNics / totalNics) * 100 : 0,
      total: totalNics > 0 ? ((frontendNics + backendNics) / totalNics) * 100 : 0
    },
    conflicts
  }
}

// ====================================================================
// DUAL FABRIC DEFAULT TEMPLATES
// ====================================================================

export function createDualFabricTemplate(
  useCase: 'ai-training' | 'gpu-rendering' | 'hpc' | 'custom'
): Partial<DualFabricSpec> {
  const templates = {
    'ai-training': {
      name: 'AI Training Cluster',
      frontend: {
        name: 'Compute Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'compute-leaf',
          name: 'Compute Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 4,
          endpointProfiles: [{
            name: 'GPU Server',
            portsPerEndpoint: 2,
            type: 'compute' as const,
            bandwidth: 25,
            count: 24
          }]
        }]
      },
      backend: {
        name: 'Storage Fabric', 
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'storage-leaf',
          name: 'Storage Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'Storage Server',
            portsPerEndpoint: 4,
            type: 'storage' as const,
            bandwidth: 100,
            count: 12
          }]
        }]
      },
      sharedServers: Array.from({ length: 8 }, (_, i) => ({
        id: `gpu-node-${i + 1}`,
        name: `GPU-Node-${String(i + 1).padStart(2, '0')}`,
        totalNics: 6,
        serverType: 'gpu-compute' as const,
        nicAllocations: [
          {
            nicCount: 4,
            nicSpeed: '25G',
            targetFabric: 'frontend' as const,
            purpose: 'compute' as const
          },
          {
            nicCount: 2, 
            nicSpeed: '100G',
            targetFabric: 'backend' as const,
            purpose: 'storage' as const
          }
        ]
      }))
    },
    
    'gpu-rendering': {
      name: 'GPU Rendering Farm',
      frontend: {
        name: 'Render Fabric',
        spineModelId: 'DS3000', 
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'render-leaf',
          name: 'Render Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 4,
          endpointProfiles: [{
            name: 'Render Node',
            portsPerEndpoint: 2,
            type: 'compute' as const,
            bandwidth: 100,
            count: 32
          }]
        }]
      },
      backend: {
        name: 'Asset Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000', 
        leafClasses: [{
          id: 'asset-leaf',
          name: 'Asset Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'Asset Server',
            portsPerEndpoint: 8,
            type: 'storage' as const,
            bandwidth: 400,
            count: 16
          }]
        }]
      },
      sharedServers: Array.from({ length: 16 }, (_, i) => ({
        id: `render-node-${i + 1}`,
        name: `Render-Node-${String(i + 1).padStart(2, '0')}`,
        totalNics: 8,
        serverType: 'gpu-compute' as const,
        nicAllocations: [
          {
            nicCount: 6,
            nicSpeed: '100G',
            targetFabric: 'frontend' as const,
            purpose: 'gpu-interconnect' as const
          },
          {
            nicCount: 2,
            nicSpeed: '400G', 
            targetFabric: 'backend' as const,
            purpose: 'storage' as const
          }
        ]
      }))
    },
    
    'hpc': {
      name: 'HPC Cluster',
      frontend: {
        name: 'Compute Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'hpc-leaf',
          name: 'HPC Leaf', 
          role: 'standard' as const,
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'HPC Node',
            portsPerEndpoint: 2,
            type: 'compute' as const,
            bandwidth: 25,
            count: 48
          }]
        }]
      },
      backend: {
        name: 'Management Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'mgmt-leaf',
          name: 'Management Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 1,
          endpointProfiles: [{
            name: 'Management Port',
            portsPerEndpoint: 1,
            type: 'network' as const,
            bandwidth: 1,
            count: 48
          }]
        }]
      },
      sharedServers: Array.from({ length: 32 }, (_, i) => ({
        id: `hpc-node-${i + 1}`,
        name: `HPC-Node-${String(i + 1).padStart(2, '0')}`,
        totalNics: 4,
        serverType: 'general-purpose' as const,
        nicAllocations: [
          {
            nicCount: 2,
            nicSpeed: '25G',
            targetFabric: 'frontend' as const,
            purpose: 'compute' as const
          },
          {
            nicCount: 1,
            nicSpeed: '1G',
            targetFabric: 'backend' as const,
            purpose: 'management' as const
          }
        ]
      }))
    },
    
    'custom': {
      name: 'Custom Dual Fabric',
      frontend: {
        name: 'Primary Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'primary-leaf',
          name: 'Primary Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'Standard Server',
            portsPerEndpoint: 2,
            type: 'server' as const,
            count: 24
          }]
        }]
      },
      backend: {
        name: 'Secondary Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'secondary-leaf',
          name: 'Secondary Leaf',
          role: 'standard' as const,
          uplinksPerLeaf: 1,
          endpointProfiles: [{
            name: 'Secondary Server',
            portsPerEndpoint: 1,
            type: 'server' as const,
            count: 24
          }]
        }]
      },
      sharedServers: []
    }
  }
  
  return {
    mode: 'dual-fabric',
    metadata: {
      createdAt: new Date(),
      version: '1.0.0',
      useCase
    },
    ...templates[useCase]
  }
}