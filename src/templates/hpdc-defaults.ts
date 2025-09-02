/**
 * HPDC Template Defaults - WP-GFD1
 * High-Performance Data Center template configurations
 */

import type { FabricSpec } from '../app.state'

export interface HPDCTemplate {
  id: string
  name: string
  description: string
  category: 'compute' | 'storage' | 'mixed' | 'ai-ml'
  spec: FabricSpec
  recommended: {
    endpoints: {
      minCount: number
      maxCount: number
      typicalProfiles: EndpointProfileTemplate[]
    }
    leafClasses: {
      count: number
      redundancy: 'single' | 'dual' | 'n+1'
    }
    spines: {
      minCount: number
      recommendedCount: number
      redundancy: 'n+1' | 'n+2'
    }
    external: {
      borderLeafPercent: number
      typicalBandwidthGbps: number
    }
  }
}

export interface EndpointProfileTemplate {
  name: string
  nicSpeed: '10G' | '25G' | '100G'
  nicCount: number
  lagEnabled: boolean
  description: string
}

/**
 * HPDC Template Library
 */
export const HPDC_TEMPLATES: Record<string, HPDCTemplate> = {
  'hpdc-compute-small': {
    id: 'hpdc-compute-small',
    name: 'Small Compute Cluster',
    description: 'Optimized for compute workloads up to 100 servers',
    category: 'compute',
    spec: {
      name: 'compute-fabric',
      spineModelId: 'DS3000', // 32x100G spine
      leafModelId: 'DS2000',  // 48x25G + 8x100G leaf
      uplinksPerLeaf: 4,
      endpointCount: 48,
      endpointProfile: {
        name: 'compute-server',
        portsPerEndpoint: 2
      }
    },
    recommended: {
      endpoints: {
        minCount: 24,
        maxCount: 96,
        typicalProfiles: [
          {
            name: 'compute-dual-25g',
            nicSpeed: '25G',
            nicCount: 2,
            lagEnabled: true,
            description: 'Dual 25G with LACP for compute nodes'
          },
          {
            name: 'compute-single-100g',
            nicSpeed: '100G',
            nicCount: 1,
            lagEnabled: false,
            description: 'Single 100G for high-performance compute'
          }
        ]
      },
      leafClasses: {
        count: 1,
        redundancy: 'dual'
      },
      spines: {
        minCount: 2,
        recommendedCount: 2,
        redundancy: 'n+1'
      },
      external: {
        borderLeafPercent: 10,
        typicalBandwidthGbps: 200
      }
    }
  },

  'hpdc-storage-medium': {
    id: 'hpdc-storage-medium',
    name: 'Medium Storage Cluster',
    description: 'Balanced storage fabric for 100-200 servers',
    category: 'storage',
    spec: {
      name: 'storage-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 8,
      endpointCount: 150,
      endpointProfile: {
        name: 'storage-server',
        portsPerEndpoint: 4
      }
    },
    recommended: {
      endpoints: {
        minCount: 100,
        maxCount: 200,
        typicalProfiles: [
          {
            name: 'storage-quad-25g',
            nicSpeed: '25G',
            nicCount: 4,
            lagEnabled: true,
            description: 'Quad 25G with LACP for storage nodes'
          },
          {
            name: 'storage-dual-100g',
            nicSpeed: '100G',
            nicCount: 2,
            lagEnabled: true,
            description: 'Dual 100G for high-throughput storage'
          }
        ]
      },
      leafClasses: {
        count: 2,
        redundancy: 'dual'
      },
      spines: {
        minCount: 4,
        recommendedCount: 4,
        redundancy: 'n+1'
      },
      external: {
        borderLeafPercent: 15,
        typicalBandwidthGbps: 400
      }
    }
  },

  'hpdc-ai-gpu': {
    id: 'hpdc-ai-gpu',
    name: 'AI/GPU Training Cluster',
    description: 'Ultra-low latency fabric for GPU clusters',
    category: 'ai-ml',
    spec: {
      name: 'gpu-fabric',
      spineModelId: 'DS4000', // 32x400G spine
      leafModelId: 'DS3000',  // 32x100G leaf
      uplinksPerLeaf: 16,
      endpointCount: 64,
      endpointProfile: {
        name: 'gpu-server',
        portsPerEndpoint: 8
      }
    },
    recommended: {
      endpoints: {
        minCount: 32,
        maxCount: 128,
        typicalProfiles: [
          {
            name: 'gpu-octa-100g',
            nicSpeed: '100G',
            nicCount: 8,
            lagEnabled: false,
            description: 'Eight 100G NICs for GPU servers (no LAG for RDMA)'
          }
        ]
      },
      leafClasses: {
        count: 1,
        redundancy: 'single'
      },
      spines: {
        minCount: 4,
        recommendedCount: 8,
        redundancy: 'n+2'
      },
      external: {
        borderLeafPercent: 20,
        typicalBandwidthGbps: 1600
      }
    }
  },

  'hpdc-mixed-large': {
    id: 'hpdc-mixed-large',
    name: 'Large Mixed Workload',
    description: 'Flexible fabric for 200+ mixed servers',
    category: 'mixed',
    spec: {
      name: 'mixed-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 8,
      endpointCount: 250,
      endpointProfile: {
        name: 'mixed-server',
        portsPerEndpoint: 2
      }
    },
    recommended: {
      endpoints: {
        minCount: 200,
        maxCount: 500,
        typicalProfiles: [
          {
            name: 'general-dual-25g',
            nicSpeed: '25G',
            nicCount: 2,
            lagEnabled: true,
            description: 'Standard dual 25G for general workloads'
          },
          {
            name: 'database-dual-100g',
            nicSpeed: '100G',
            nicCount: 2,
            lagEnabled: true,
            description: 'Dual 100G for database servers'
          },
          {
            name: 'web-single-10g',
            nicSpeed: '10G',
            nicCount: 2,
            lagEnabled: true,
            description: 'Dual 10G for web/app servers'
          }
        ]
      },
      leafClasses: {
        count: 3,
        redundancy: 'dual'
      },
      spines: {
        minCount: 4,
        recommendedCount: 6,
        redundancy: 'n+1'
      },
      external: {
        borderLeafPercent: 25,
        typicalBandwidthGbps: 800
      }
    }
  }
}

/**
 * Apply HPDC template to a fabric spec
 */
export function applyHPDCTemplate(
  templateId: string,
  customizations?: Partial<FabricSpec>
): FabricSpec {
  const template = HPDC_TEMPLATES[templateId]
  if (!template) {
    throw new Error(`Unknown HPDC template: ${templateId}`)
  }

  return {
    ...template.spec,
    ...customizations,
    // Preserve template metadata
    metadata: {
      templateId,
      templateName: template.name,
      appliedAt: new Date().toISOString()
    }
  } as FabricSpec & { metadata: any }
}

/**
 * Get recommended spine count based on template and scale
 */
export function getRecommendedSpineCount(
  templateId: string,
  leafCount: number
): number {
  const template = HPDC_TEMPLATES[templateId]
  if (!template) {
    return 2 // Safe default
  }

  const { minCount, recommendedCount } = template.recommended.spines
  
  // Scale spine count based on leaf count
  if (leafCount <= 4) {
    return minCount
  } else if (leafCount <= 8) {
    return recommendedCount
  } else {
    // For larger fabrics, scale spines proportionally
    return Math.max(
      recommendedCount,
      Math.ceil(leafCount / 4) // Rough 4:1 leaf:spine ratio
    )
  }
}

/**
 * Validate if a configuration matches HPDC best practices
 */
export function validateHPDCCompliance(
  spec: FabricSpec,
  templateId?: string
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  // General HPDC validations
  if (spec.uplinksPerLeaf < 4) {
    warnings.push('HPDC best practice: Use at least 4 uplinks per leaf for redundancy')
  }

  // Template-specific validations
  if (templateId) {
    const template = HPDC_TEMPLATES[templateId]
    if (template) {
      const { endpoints, spines } = template.recommended

      if (spec.endpointCount < endpoints.minCount) {
        warnings.push(`This template is optimized for ${endpoints.minCount}+ endpoints`)
      }

      if (spec.endpointCount > endpoints.maxCount) {
        warnings.push(`Consider a larger template for ${spec.endpointCount} endpoints`)
      }
    }
  }

  return {
    valid: warnings.length === 0,
    warnings
  }
}

/**
 * Get template recommendations based on requirements
 */
export function recommendTemplate(requirements: {
  endpointCount: number
  workloadType?: 'compute' | 'storage' | 'mixed' | 'ai-ml'
  bandwidthGbps?: number
}): string {
  const { endpointCount, workloadType } = requirements

  // Filter templates by workload type if specified
  const candidates = Object.values(HPDC_TEMPLATES).filter(t => 
    !workloadType || t.category === workloadType
  )

  // Find best match by endpoint count
  const bestMatch = candidates.reduce((best, current) => {
    const currentFit = Math.abs(current.recommended.endpoints.maxCount - endpointCount)
    const bestFit = Math.abs(best.recommended.endpoints.maxCount - endpointCount)
    return currentFit < bestFit ? current : best
  })

  return bestMatch.id
}