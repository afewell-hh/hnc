import type { FabricSpec } from '../../app.types'

/**
 * Mock fabric specifications for consistent Storybook testing
 * These represent different import scenarios for WP-IMP3 stories
 */

// Happy Path: Clean import with no conflicts
export const happyPathFabric: FabricSpec = {
  name: 'Production Network',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 4,
  endpointProfile: {
    name: 'Standard Server',
    portsPerEndpoint: 2,
    count: 96
  },
  endpointCount: 96,
  metadata: {
    version: '1.0',
    source: 'fgd-export',
    exportedAt: '2024-01-15T10:30:00Z'
  },
  createdAt: new Date('2024-01-15T10:30:00Z')
}

// With Conflicts: Import has differences that generate warnings
export const conflictFabric: FabricSpec = {
  name: 'Staging Environment',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 2,
  endpointProfile: {
    name: 'High-Density Server',
    portsPerEndpoint: 4,
    count: 120
  },
  endpointCount: 120,
  metadata: {
    version: '1.1',
    source: 'manual-config',
    conflictFields: ['endpointProfile', 'endpointCount'], // Fields that will cause conflicts
    warnings: [
      'Endpoint profile differs from current configuration',
      'Endpoint count exceeds current leaf capacity'
    ]
  },
  createdAt: new Date('2024-01-10T15:45:00Z')
}

// Invalid: Import has validation errors that block save
export const invalidFabric: FabricSpec = {
  name: 'Invalid Test Fabric',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 3, // Invalid: odd number of uplinks
  endpointProfile: {
    name: 'Invalid Profile',
    portsPerEndpoint: 0, // Invalid: zero ports
    count: 0
  },
  endpointCount: 0, // Invalid: zero endpoints
  metadata: {
    version: '0.9',
    source: 'test-data',
    validationErrors: [
      'Uplinks per leaf must be even',
      'Endpoint profile must have at least 1 port per endpoint',
      'Endpoint count must be greater than 0'
    ]
  },
  createdAt: new Date('2024-01-01T00:00:00Z')
}

// Re-emit Determinism: Standard config for hash equality testing
export const determinismFabric: FabricSpec = {
  name: 'Determinism Test Fabric',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 2,
  endpointProfile: {
    name: 'Standard Server',
    portsPerEndpoint: 2,
    count: 48
  },
  endpointCount: 48,
  metadata: {
    version: '1.0',
    source: 'determinism-test',
    checksum: 'sha256:abc123def456...',
    reproducible: true
  },
  createdAt: new Date('2024-01-20T12:00:00Z')
}

// Multi-class fabric for advanced testing
export const multiClassFabric: FabricSpec = {
  name: 'Multi-Class Production',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  leafClasses: [
    {
      id: 'standard-compute',
      name: 'Standard Compute Leaves',
      role: 'standard' as const,
      uplinksPerLeaf: 4,
      endpointProfiles: [
        {
          name: 'Compute Server',
          portsPerEndpoint: 2,
          count: 24,
          type: 'compute' as const
        }
      ]
    },
    {
      id: 'border-gateways',
      name: 'Border Gateway Leaves',
      role: 'border' as const,
      uplinksPerLeaf: 6,
      endpointProfiles: [
        {
          name: 'Gateway Server',
          portsPerEndpoint: 4,
          count: 12,
          type: 'network' as const
        }
      ]
    }
  ],
  metadata: {
    version: '2.0',
    source: 'fgd-export',
    multiClass: true
  },
  createdAt: new Date('2024-02-01T08:00:00Z')
}

// Export as JSON strings for file import simulation
export const fabricSpecsAsJSON = {
  happyPath: JSON.stringify(happyPathFabric, null, 2),
  conflict: JSON.stringify(conflictFabric, null, 2),
  invalid: JSON.stringify(invalidFabric, null, 2),
  determinism: JSON.stringify(determinismFabric, null, 2),
  multiClass: JSON.stringify(multiClassFabric, null, 2)
}

// Helper function to create File objects for testing
export const createMockFile = (content: string, filename: string, type: string = 'application/json'): File => {
  const blob = new Blob([content], { type })
  return new File([blob], filename, { type })
}

// Pre-created mock files for story usage
export const mockFiles = {
  happyPath: createMockFile(fabricSpecsAsJSON.happyPath, 'production-network.json'),
  conflict: createMockFile(fabricSpecsAsJSON.conflict, 'staging-environment.json'),
  invalid: createMockFile(fabricSpecsAsJSON.invalid, 'invalid-fabric.json'),
  determinism: createMockFile(fabricSpecsAsJSON.determinism, 'determinism-test.json'),
  multiClass: createMockFile(fabricSpecsAsJSON.multiClass, 'multi-class-production.json')
}

// Hash calculation helper for determinism testing
export const calculateSpecHash = (spec: FabricSpec): string => {
  // Simple hash calculation for testing (in production would use crypto)
  const specString = JSON.stringify(spec, Object.keys(spec).sort())
  return btoa(specString).substring(0, 16)
}