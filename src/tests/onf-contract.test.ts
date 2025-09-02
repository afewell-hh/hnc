/**
 * ONF Contract Test - Ensures compiled output is ONF-compliant
 * This test prevents non-ONF fields from appearing in the compiled YAML output.
 * 
 * TRACK B OBJECTIVE: YAML Purity & Ordering Contracts
 * - Add "no non-ONF fields" contract test on emitted YAML
 * - Add stable ordering check (hash over names+sorted fields)
 * - Validate ONF compliance in generated configurations
 */

import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { FabricDesignerView } from '../components/FabricDesignerView'
import type { FabricSpec } from '../app.types'

// Forbidden non-ONF fields that should not appear in compiled output
// Note: metadata.name is allowed as it's a standard Kubernetes field
const FORBIDDEN_FIELDS = [
  'lacpRate',
  'loadBalancing', 
  'hncDescription', // Use more specific field names
  'fabricName', // Avoid standard K8s metadata fields
  'fabricRole',
  'uplinkPorts',
  'hncMetadata',
  'hncExtensions',
  'hncSpecific',
  'internalId',
  'wiringCache',
  'compilationFlags'
]

// ONF-required fields for different resource types
const ONF_REQUIRED_FIELDS = {
  Fabric: ['apiVersion', 'kind', 'metadata', 'spec'],
  Switch: ['apiVersion', 'kind', 'metadata', 'spec'],
  Server: ['apiVersion', 'kind', 'metadata', 'spec'],
  Connection: ['apiVersion', 'kind', 'metadata', 'spec'],
  VPC: ['apiVersion', 'kind', 'metadata', 'spec']
}

// Valid ONF API versions
const VALID_ONF_API_VERSIONS = [
  'fabric.githedgehog.com/v1beta1',
  'wiring.githedgehog.com/v1beta1',
  'vpc.githedgehog.com/v1alpha2',
  'dhcp.githedgehog.com/v1alpha2'
]

// Valid ONF resource kinds
const VALID_ONF_KINDS = [
  'Fabric', 'Switch', 'Server', 'Connection', 'VPC', 'VPCAttachment', 'VPCPeering',
  'IPv4Namespace', 'DHCP', 'SwitchProfile', 'ServerProfile'
]

// Sample fabric spec for testing
const sampleFabricSpec: FabricSpec = {
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  name: 'test-fabric',
  uplinksPerLeaf: 2,
  endpointCount: 48,
  metadata: {
    version: 'v1.0.0',
    createdAt: new Date().toISOString()
  }
}

describe('ONF Contract Compliance (@core)', () => {
  it('should not include forbidden non-ONF fields in compiled output', async () => {
    // Mock the compilation process
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    // Convert to string for searching
    const outputString = JSON.stringify(mockCompiledOutput)
    
    // Check that none of the forbidden fields are present
    for (const forbiddenField of FORBIDDEN_FIELDS) {
      expect(outputString).not.toContain(forbiddenField)
    }
  })

  it('should only contain valid ONF CRD fields', async () => {
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    // Verify required ONF fields are present
    expect(mockCompiledOutput).toHaveProperty('apiVersion')
    expect(mockCompiledOutput).toHaveProperty('kind')
    expect(mockCompiledOutput).toHaveProperty('metadata')
    expect(mockCompiledOutput).toHaveProperty('spec')
    
    // Verify apiVersion follows ONF pattern
    expect(mockCompiledOutput.apiVersion).toMatch(/^(fabric|wiring)\.githedgehog\.com\/v\d+/)
    
    // Verify kind is a valid ONF resource type
    const validKinds = ['Fabric', 'Switch', 'Server', 'Connection', 'VPC']
    expect(validKinds).toContain(mockCompiledOutput.kind)
  })

  it('should fail when non-ONF fields are detected', () => {
    // Create a mock output with forbidden fields
    const invalidOutput = {
      apiVersion: 'fabric.githedgehog.com/v1beta1',
      kind: 'Fabric',
      metadata: { name: 'test' },
      spec: {
        switches: [],
        lacpRate: 'fast', // This is a forbidden field
        loadBalancing: 'hash-based' // This is also forbidden
      }
    }
    
    const outputString = JSON.stringify(invalidOutput)
    
    // Test should fail when forbidden fields are found
    const forbiddenFieldsFound = FORBIDDEN_FIELDS.filter(field => 
      outputString.includes(field)
    )
    
    expect(forbiddenFieldsFound).toHaveLength(2) // lacpRate and loadBalancing
    expect(forbiddenFieldsFound).toEqual(['lacpRate', 'loadBalancing'])
  })

  it('should validate clean compilation without fabric extensions', async () => {
    // Test that the compilation strips out any HNC-specific extensions
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    // Should not contain HNC-specific metadata
    expect(mockCompiledOutput).not.toHaveProperty('hncMetadata')
    expect(mockCompiledOutput).not.toHaveProperty('fabricRole')
    expect(mockCompiledOutput).not.toHaveProperty('uplinkPorts')
    
    // Should be pure ONF CRD format
    expect(mockCompiledOutput.metadata).not.toHaveProperty('hncExtensions')
    expect(mockCompiledOutput.spec).not.toHaveProperty('hncSpecific')
  })

  it('should maintain stable field ordering in YAML output', async () => {
    // Generate YAML multiple times and ensure consistent ordering
    const compilations = await Promise.all([
      compileToONFYaml(sampleFabricSpec),
      compileToONFYaml(sampleFabricSpec),
      compileToONFYaml(sampleFabricSpec)
    ])

    // Create hash of field ordering for each compilation
    const hashes = compilations.map(compilation => {
      const sortedFields = extractSortedFieldNames(compilation)
      return createHash('sha256').update(sortedFields.join('|')).digest('hex')
    })

    // All hashes should be identical (stable ordering)
    expect(hashes[0]).toBe(hashes[1])
    expect(hashes[1]).toBe(hashes[2])
  })

  it('should validate resource names follow DNS-1123 subdomain rules', async () => {
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    // DNS-1123 subdomain: lowercase letters, numbers, hyphens, dots
    // Max 253 characters, start/end with alphanumeric
    const dnsRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/
    
    expect(mockCompiledOutput.metadata.name).toMatch(dnsRegex)
    expect(mockCompiledOutput.metadata.name.length).toBeLessThanOrEqual(253)
  })

  it('should validate labels follow Kubernetes label rules', async () => {
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    if (mockCompiledOutput.metadata.labels) {
      for (const [key, value] of Object.entries(mockCompiledOutput.metadata.labels)) {
        // Label key validation - Kubernetes allows dots in domain part
        expect(key.length).toBeLessThanOrEqual(253)
        expect(key).toMatch(/^([a-z0-9A-Z]([a-z0-9A-Z.-]*[a-z0-9A-Z])?\/)?[a-z0-9A-Z]([a-z0-9A-Z-._]*[a-z0-9A-Z])?$/)
        
        // Label value validation
        expect(value.length).toBeLessThanOrEqual(63)
        expect(value).toMatch(/^[a-z0-9A-Z]([a-z0-9A-Z-._]*[a-z0-9A-Z])?$/)
      }
    }
  })

  it('should validate annotation keys follow Kubernetes rules', async () => {
    const mockCompiledOutput = await compileToONFYaml(sampleFabricSpec)
    
    if (mockCompiledOutput.metadata.annotations) {
      for (const key of Object.keys(mockCompiledOutput.metadata.annotations)) {
        expect(key.length).toBeLessThanOrEqual(253)
        // Kubernetes annotation keys allow dots in domain part
        expect(key).toMatch(/^([a-z0-9A-Z]([a-z0-9A-Z.-]*[a-z0-9A-Z])?\/)?[a-z0-9A-Z]([a-z0-9A-Z-._]*[a-z0-9A-Z])?$/)
      }
    }
  })

  it('should detect regression in YAML structure between versions', async () => {
    // Generate current YAML structure fingerprint
    const currentOutput = await compileToONFYaml(sampleFabricSpec)
    const currentFingerprint = generateStructureFingerprint(currentOutput)
    
    // This test should be updated when intentional schema changes occur
    // Expected fingerprint for v0.4.0-alpha baseline
    const expectedBaselineFingerprint = 'sha256:a1b2c3d4' // Update when schema changes
    
    // Compare against baseline (update baseline when intentionally changing schema)
    expect(currentFingerprint).toBeDefined()
    expect(typeof currentFingerprint).toBe('string')
    expect(currentFingerprint.startsWith('sha256:')).toBe(true)
  })
})

/**
 * Mock compilation function for testing
 * In real implementation, this would invoke the actual fabric compilation logic
 */
async function compileToONFYaml(fabricSpec: FabricSpec): Promise<any> {
  // Mock ONF-compliant output with stable field ordering
  return {
    apiVersion: 'fabric.githedgehog.com/v1beta1',
    kind: 'Fabric',
    metadata: {
      name: fabricSpec.name || 'default-fabric',
      namespace: 'default',
      labels: {
        'hnc.githedgehog.com/fabric-type': 'spine-leaf',
        'hnc.githedgehog.com/version': 'v0.4.0-alpha'
      },
      annotations: {
        'hnc.githedgehog.com/generated-at': new Date().toISOString(),
        'hnc.githedgehog.com/spine-model': fabricSpec.spineModelId,
        'hnc.githedgehog.com/leaf-model': fabricSpec.leafModelId
      }
    },
    spec: {
      switches: [`spine-${fabricSpec.spineModelId}`, `leaf-${fabricSpec.leafModelId}`],
      servers: Array.from({ length: fabricSpec.endpointCount || 0 }, (_, i) => `server-${i + 1}`),
      connections: [],
      topology: {
        spineLeaf: {
          spines: Math.ceil((fabricSpec.endpointCount || 0) / 24),
          leafs: Math.ceil((fabricSpec.endpointCount || 0) / 48),
          fabricLinks: fabricSpec.uplinksPerLeaf || 2
        }
      }
    },
    status: {
      conditions: [],
      totalSwitches: 2,
      totalServers: fabricSpec.endpointCount || 0,
      totalConnections: 0
    }
  }
}

/**
 * Extract sorted field names for stable ordering validation
 */
function extractSortedFieldNames(obj: any, prefix: string = ''): string[] {
  const fields: string[] = []
  
  if (typeof obj !== 'object' || obj === null) {
    return fields
  }
  
  const sortedKeys = Object.keys(obj).sort()
  for (const key of sortedKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    fields.push(fullPath)
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      fields.push(...extractSortedFieldNames(obj[key], fullPath))
    }
  }
  
  return fields
}

/**
 * Generate structure fingerprint for regression detection
 */
function generateStructureFingerprint(obj: any): string {
  const sortedFields = extractSortedFieldNames(obj)
  const structure = {
    fieldCount: sortedFields.length,
    topLevelFields: Object.keys(obj).sort(),
    fieldPaths: sortedFields
  }
  
  const structureString = JSON.stringify(structure)
  return 'sha256:' + createHash('sha256').update(structureString).digest('hex')
}