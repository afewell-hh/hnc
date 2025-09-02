/**
 * WP-GPU1: Dual-Fabric Integration Layer
 * 
 * Integrates dual-fabric functionality with existing single-fabric workflows.
 * Provides seamless mode switching and backwards compatibility.
 */

import type { FabricSpec, DerivedTopology, FabricDesignContext } from '../app.types'
import type { DualFabricSpec, DualFabricOutput, DualFabricValidation } from './dual-fabric'
import { DualFabricCompiler } from '../io/dual-fabric-compiler'
import { CrossFabricValidator } from './cross-fabric-validator'
import { generateSharedResourceReport } from './dual-fabric'
import { computeDerived } from './topology'

// ====================================================================
// INTEGRATION TYPES
// ====================================================================

export interface DualFabricContext extends Omit<FabricDesignContext, 'config' | 'computedTopology'> {
  mode: 'single-fabric' | 'dual-fabric'
  
  // Single fabric state (original)
  singleFabricConfig?: Partial<FabricSpec>
  singleFabricTopology?: DerivedTopology | null
  
  // Dual fabric state (new)
  dualFabricSpec?: DualFabricSpec | null
  dualFabricOutput?: DualFabricOutput | null
  dualFabricValidation?: DualFabricValidation | null
  
  // Unified interface for current config (adapts based on mode)
  config: Partial<FabricSpec> | DualFabricSpec
  computedTopology: DerivedTopology | null
}

export type DualFabricEvent =
  | { type: 'SWITCH_TO_SINGLE_FABRIC' }
  | { type: 'SWITCH_TO_DUAL_FABRIC' }
  | { type: 'UPDATE_DUAL_FABRIC_SPEC'; spec: DualFabricSpec }
  | { type: 'COMPILE_DUAL_FABRIC' }
  | { type: 'VALIDATE_DUAL_FABRIC' }

// ====================================================================
// INTEGRATION UTILITIES
// ====================================================================

export class DualFabricIntegration {
  
  /**
   * Converts single-fabric spec to dual-fabric template
   */
  static convertSingleToDualFabric(singleSpec: Partial<FabricSpec>): DualFabricSpec {
    const timestamp = new Date()
    
    return {
      id: `dual-${Date.now()}`,
      name: `${singleSpec.name || 'Untitled'} - Dual Fabric`,
      mode: 'dual-fabric',
      
      // Frontend fabric inherits from single fabric
      frontend: {
        name: 'Frontend Fabric',
        spineModelId: singleSpec.spineModelId || 'DS3000',
        leafModelId: singleSpec.leafModelId || 'DS2000',
        leafClasses: singleSpec.leafClasses || [{
          id: 'frontend-leaf',
          name: 'Frontend Leaf',
          role: 'standard',
          uplinksPerLeaf: singleSpec.uplinksPerLeaf || 2,
          endpointProfiles: singleSpec.endpointProfile ? [singleSpec.endpointProfile] : [{
            name: 'Standard Server',
            portsPerEndpoint: 2,
            count: singleSpec.endpointCount || 24
          }]
        }],
        version: singleSpec.version,
        createdAt: singleSpec.createdAt
      },
      
      // Backend fabric starts with similar but minimal config
      backend: {
        name: 'Backend Fabric',
        spineModelId: singleSpec.spineModelId || 'DS3000',
        leafModelId: singleSpec.leafModelId || 'DS2000',
        leafClasses: [{
          id: 'backend-leaf',
          name: 'Backend Leaf',
          role: 'standard',
          uplinksPerLeaf: 1, // Start minimal
          endpointProfiles: [{
            name: 'Backend Server',
            portsPerEndpoint: 1,
            type: 'storage',
            count: Math.floor((singleSpec.endpointCount || 24) / 2)
          }]
        }]
      },
      
      // Generate shared servers based on single fabric endpoint count
      sharedServers: this.generateDefaultSharedServers(singleSpec.endpointCount || 24),
      
      metadata: {
        createdAt: timestamp,
        lastModified: timestamp,
        version: '1.0.0',
        useCase: 'custom',
        description: `Converted from single fabric: ${singleSpec.name || 'Untitled'}`
      }
    }
  }
  
  /**
   * Converts dual-fabric spec to single-fabric (frontend only)
   */
  static convertDualToSingleFabric(dualSpec: DualFabricSpec): Partial<FabricSpec> {
    const frontendEndpoints = dualSpec.sharedServers.reduce((total, server) => {
      return total + server.nicAllocations
        .filter(alloc => alloc.targetFabric === 'frontend')
        .reduce((sum, alloc) => sum + alloc.nicCount, 0)
    }, 0)
    
    return {
      name: `${dualSpec.name} - Frontend Only`,
      spineModelId: dualSpec.frontend.spineModelId,
      leafModelId: dualSpec.frontend.leafModelId,
      leafClasses: dualSpec.frontend.leafClasses,
      endpointCount: frontendEndpoints,
      version: dualSpec.metadata?.version,
      createdAt: dualSpec.metadata?.createdAt,
      metadata: {
        ...dualSpec.metadata,
        convertedFromDualFabric: true,
        originalDualFabricId: dualSpec.id
      }
    }
  }
  
  /**
   * Computes unified topology for dual-fabric mode
   */
  static computeDualFabricTopology(spec: DualFabricSpec): DerivedTopology {
    try {
      // Calculate combined endpoints from both fabrics
      const frontendEndpoints = spec.sharedServers.reduce((total, server) => {
        return total + server.nicAllocations
          .filter(alloc => alloc.targetFabric === 'frontend')
          .reduce((sum, alloc) => sum + alloc.nicCount, 0)
      }, 0)
      
      const backendEndpoints = spec.sharedServers.reduce((total, server) => {
        return total + server.nicAllocations
          .filter(alloc => alloc.targetFabric === 'backend')
          .reduce((sum, alloc) => sum + alloc.nicCount, 0)
      }, 0)
      
      // Compute topology for each fabric
      const frontendTopology = computeDerived({
        ...spec.frontend,
        endpointCount: frontendEndpoints
      })
      
      const backendTopology = computeDerived({
        ...spec.backend,
        endpointCount: backendEndpoints
      })
      
      // Combine topologies
      const combinedTopology: DerivedTopology = {
        leavesNeeded: frontendTopology.leavesNeeded + backendTopology.leavesNeeded,
        spinesNeeded: frontendTopology.spinesNeeded + backendTopology.spinesNeeded,
        totalPorts: frontendTopology.totalPorts + backendTopology.totalPorts,
        usedPorts: frontendTopology.usedPorts + backendTopology.usedPorts,
        oversubscriptionRatio: Math.max(frontendTopology.oversubscriptionRatio, backendTopology.oversubscriptionRatio),
        isValid: frontendTopology.isValid && backendTopology.isValid,
        validationErrors: [
          ...frontendTopology.validationErrors.map(e => `Frontend: ${e}`),
          ...backendTopology.validationErrors.map(e => `Backend: ${e}`)
        ],
        guards: [
          ...frontendTopology.guards,
          ...backendTopology.guards
        ]
      }
      
      return combinedTopology
      
    } catch (error) {
      return {
        leavesNeeded: 0,
        spinesNeeded: 0,
        totalPorts: 0,
        usedPorts: 0,
        oversubscriptionRatio: 0,
        isValid: false,
        validationErrors: [`Dual fabric topology computation failed: ${error}`],
        guards: []
      }
    }
  }
  
  /**
   * Validates dual-fabric configuration
   */
  static validateDualFabric(spec: DualFabricSpec): DualFabricValidation {
    return CrossFabricValidator.quickValidate(spec)
  }
  
  /**
   * Compiles dual-fabric specification
   */
  static async compileDualFabric(spec: DualFabricSpec): Promise<DualFabricOutput> {
    return await DualFabricCompiler.compile(spec)
  }
  
  /**
   * Checks if a configuration is dual-fabric
   */
  static isDualFabric(config: any): config is DualFabricSpec {
    return config && typeof config === 'object' && config.mode === 'dual-fabric'
  }
  
  /**
   * Gets appropriate topology based on mode
   */
  static getTopology(context: DualFabricContext): DerivedTopology | null {
    if (context.mode === 'dual-fabric' && context.dualFabricSpec) {
      return this.computeDualFabricTopology(context.dualFabricSpec)
    } else if (context.mode === 'single-fabric' && context.singleFabricConfig) {
      return computeDerived(context.singleFabricConfig as FabricSpec)
    }
    return null
  }
  
  /**
   * Updates context for mode switching
   */
  static switchMode(
    context: DualFabricContext, 
    newMode: 'single-fabric' | 'dual-fabric'
  ): Partial<DualFabricContext> {
    if (newMode === context.mode) {
      return {} // No change needed
    }
    
    if (newMode === 'dual-fabric' && context.mode === 'single-fabric') {
      // Convert single to dual
      const dualFabricSpec = context.singleFabricConfig 
        ? this.convertSingleToDualFabric(context.singleFabricConfig)
        : this.generateDefaultDualFabricSpec()
      
      return {
        mode: 'dual-fabric',
        dualFabricSpec,
        dualFabricValidation: this.validateDualFabric(dualFabricSpec),
        config: dualFabricSpec,
        computedTopology: this.computeDualFabricTopology(dualFabricSpec),
        errors: []
      }
    } else if (newMode === 'single-fabric' && context.mode === 'dual-fabric') {
      // Convert dual to single
      const singleFabricConfig = context.dualFabricSpec
        ? this.convertDualToSingleFabric(context.dualFabricSpec)
        : { name: 'Converted Fabric' }
      
      return {
        mode: 'single-fabric',
        singleFabricConfig,
        config: singleFabricConfig,
        computedTopology: computeDerived(singleFabricConfig as FabricSpec),
        errors: []
      }
    }
    
    return {}
  }
  
  // ====================================================================
  // PRIVATE HELPER METHODS
  // ====================================================================
  
  private static generateDefaultSharedServers(endpointCount: number) {
    const serverCount = Math.ceil(endpointCount / 3) // ~3 NICs per server average
    
    return Array.from({ length: serverCount }, (_, i) => ({
      id: `server-${i + 1}`,
      name: `Server-${String(i + 1).padStart(2, '0')}`,
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
          nicCount: 2,
          nicSpeed: '25G',
          targetFabric: 'backend' as const,
          purpose: 'storage' as const
        }
      ]
    }))
  }
  
  private static generateDefaultDualFabricSpec(): DualFabricSpec {
    return {
      id: `dual-${Date.now()}`,
      name: 'New Dual Fabric',
      mode: 'dual-fabric',
      frontend: {
        name: 'Frontend Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'frontend-leaf',
          name: 'Frontend Leaf',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [{
            name: 'Standard Server',
            portsPerEndpoint: 2,
            count: 24
          }]
        }]
      },
      backend: {
        name: 'Backend Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [{
          id: 'backend-leaf',
          name: 'Backend Leaf',
          role: 'standard',
          uplinksPerLeaf: 1,
          endpointProfiles: [{
            name: 'Backend Server',
            portsPerEndpoint: 1,
            type: 'storage',
            count: 12
          }]
        }]
      },
      sharedServers: this.generateDefaultSharedServers(24),
      metadata: {
        createdAt: new Date(),
        version: '1.0.0',
        useCase: 'custom'
      }
    }
  }
}

// ====================================================================
// CONTEXT ADAPTERS
// ====================================================================

/**
 * Adapts dual-fabric context to legacy single-fabric context
 */
export function adaptContextForLegacyComponents(context: DualFabricContext): FabricDesignContext {
  if (context.mode === 'single-fabric') {
    return {
      ...context,
      config: context.singleFabricConfig || {},
      computedTopology: context.singleFabricTopology || null
    } as FabricDesignContext
  } else {
    // For dual-fabric mode, present frontend fabric as the main config
    const frontendConfig = context.dualFabricSpec?.frontend || {}
    const dualTopology = context.dualFabricSpec 
      ? DualFabricIntegration.computeDualFabricTopology(context.dualFabricSpec)
      : null
    
    return {
      ...context,
      config: frontendConfig,
      computedTopology: dualTopology
    } as FabricDesignContext
  }
}

/**
 * Gets the display name for the current mode
 */
export function getModeDisplayName(mode: 'single-fabric' | 'dual-fabric'): string {
  return mode === 'dual-fabric' ? 'Dual Fabric' : 'Single Fabric'
}

/**
 * Gets mode-specific configuration summary
 */
export function getConfigSummary(context: DualFabricContext): {
  fabricCount: number
  serverCount: number
  totalNics: number
  mode: string
} {
  if (context.mode === 'dual-fabric' && context.dualFabricSpec) {
    return {
      fabricCount: 2,
      serverCount: context.dualFabricSpec.sharedServers.length,
      totalNics: context.dualFabricSpec.sharedServers.reduce(
        (sum, server) => sum + server.totalNics, 0
      ),
      mode: 'Dual Fabric'
    }
  } else {
    const endpointCount = (context.singleFabricConfig?.endpointCount || 0)
    return {
      fabricCount: 1,
      serverCount: endpointCount,
      totalNics: endpointCount * 2, // Estimate
      mode: 'Single Fabric'
    }
  }
}