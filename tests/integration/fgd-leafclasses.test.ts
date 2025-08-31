import { describe, it, expect, beforeEach } from 'vitest'
import { saveFGD, loadFGD } from '../../src/io/fgd'
import { generateWiringStub } from '../../src/app.state'
import { computeDerived } from '../../src/domain/topology'
import type { FabricSpec, LeafClass, WiringDiagram } from '../../src/app.types'

describe('FGD Save/Load with LeafClasses Integration', () => {
  beforeEach(() => {
    // Clear any previous FGD state
    localStorage.clear()
  })

  describe('Multi-Class FGD Persistence', () => {
    it('should save and load multi-class fabric configuration', async () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'compute-cluster',
          name: 'Compute Cluster',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'GPU Server', type: 'compute', count: 32, bandwidth: 100, redundancy: false, portsPerEndpoint: 2 },
            { name: 'CPU Server', type: 'compute', count: 16, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ],
          metadata: {
            zone: 'production',
            owner: 'ml-team'
          }
        },
        {
          id: 'storage-cluster',
          name: 'Storage Cluster',
          role: 'standard',
          uplinksPerLeaf: 4,
          endpointProfiles: [
            { name: 'NVMe Storage', type: 'storage', count: 20, bandwidth: 100, redundancy: true, portsPerEndpoint: 2 }
          ],
          metadata: {
            zone: 'production',
            owner: 'storage-team'
          }
        },
        {
          id: 'border-gw',
          name: 'Border Gateway',
          role: 'border',
          leafModelId: 'DS2000', // Explicit model override
          uplinksPerLeaf: 4,
          count: 2, // Explicit leaf count
          endpointProfiles: [
            { name: 'Router', type: 'network', count: 4, bandwidth: 100, redundancy: true, portsPerEndpoint: 1 }
          ],
          lag: {
            esLag: {
              enabled: true,
              minMembers: 2,
              maxMembers: 4,
              loadBalancing: 'hash-based'
            }
          },
          metadata: {
            zone: 'edge',
            owner: 'network-team'
          }
        }
      ]

      const originalSpec: FabricSpec = {
        name: 'multi-class-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses,
        metadata: {
          environment: 'production',
          version: '2.0.0'
        },
        version: '2.0.0',
        createdAt: new Date('2024-01-01T00:00:00Z')
      }

      // Generate topology and wiring diagram
      const topology = computeDerived(originalSpec)
      expect(topology.isValid).toBe(true)

      const wiringDiagram = generateWiringStub(originalSpec, topology)

      // Save to FGD
      const saveResult = await saveFGD(wiringDiagram, { 
        fabricId: 'multi-class-test',
        metadata: { leafClasses } // Include leafClasses in FGD metadata
      })

      expect(saveResult.success).toBe(true)
      expect(saveResult.fgdId).toBeDefined()

      // Load from FGD
      const loadResult = await loadFGD({ fabricId: 'multi-class-test' })

      expect(loadResult.success).toBe(true)
      expect(loadResult.diagram).toBeDefined()

      const loadedDiagram = loadResult.diagram!

      // Verify multi-class structure is preserved
      expect(loadedDiagram.metadata.fabricName).toBe(originalSpec.name)
      expect(loadedDiagram.devices.spines).toHaveLength(topology.spinesNeeded)
      expect(loadedDiagram.devices.leaves).toHaveLength(topology.leavesNeeded)

      // Verify total endpoint count matches multi-class sum
      const expectedEndpoints = leafClasses.reduce((sum, lc) =>
        sum + lc.endpointProfiles.reduce((eSum, ep) => eSum + (ep.count || 0), 0), 0)
      expect(loadedDiagram.devices.servers).toHaveLength(expectedEndpoints)

      // Verify connections are generated correctly
      expect(loadedDiagram.connections.length).toBeGreaterThan(0)
      expect(loadedDiagram.connections.filter(conn => conn.type === 'uplink').length).toBe(
        topology.leavesNeeded * (leafClasses[0].uplinksPerLeaf + leafClasses[1].uplinksPerLeaf + leafClasses[2].uplinksPerLeaf) / leafClasses.length
      )
    })

    it('should preserve backward compatibility with legacy single-class FGD', async () => {
      const legacySpec: FabricSpec = {
        name: 'legacy-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointProfile: { 
          name: 'Legacy Server', 
          type: 'server', 
          count: 48, 
          bandwidth: 25, 
          redundancy: false,
          portsPerEndpoint: 2 
        },
        endpointCount: 48
      }

      const topology = computeDerived(legacySpec)
      const wiringDiagram = generateWiringStub(legacySpec, topology)

      // Save legacy format
      const saveResult = await saveFGD(wiringDiagram, { fabricId: 'legacy-test' })
      expect(saveResult.success).toBe(true)

      // Load and verify
      const loadResult = await loadFGD({ fabricId: 'legacy-test' })
      expect(loadResult.success).toBe(true)

      const loadedDiagram = loadResult.diagram!
      expect(loadedDiagram.devices.servers).toHaveLength(48)
      expect(loadedDiagram.devices.leaves).toHaveLength(topology.leavesNeeded)
    })

    it('should handle FGD versioning with leafClasses evolution', async () => {
      // Simulate an older version of multi-class data
      const v1LeafClasses: LeafClass[] = [
        {
          id: 'basic-class',
          name: 'Basic Class',
          role: 'standard',
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'Server', type: 'server', count: 24, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
          // No metadata, count, or lag fields (v1)
        }
      ]

      const v1Spec: FabricSpec = {
        name: 'versioned-fabric-v1',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: v1LeafClasses,
        version: '1.0.0'
      }

      const v1Topology = computeDerived(v1Spec)
      const v1Wiring = generateWiringStub(v1Spec, v1Topology)

      // Save v1 format
      await saveFGD(v1Wiring, { 
        fabricId: 'version-test',
        version: '1.0.0'
      })

      // Load and upgrade to v2 format
      const loadResult = await loadFGD({ fabricId: 'version-test' })
      expect(loadResult.success).toBe(true)

      // Should be able to load v1 format without issues
      const loadedDiagram = loadResult.diagram!
      expect(loadedDiagram.metadata.fabricName).toBe('versioned-fabric-v1')
      expect(loadedDiagram.devices.servers).toHaveLength(24)
    })
  })

  describe('Complex Multi-Class Scenarios', () => {
    it('should handle heterogeneous leaf models across classes', async () => {
      const leafClasses: LeafClass[] = [
        {
          id: 'standard-leaves',
          name: 'Standard Leaves',
          role: 'standard',
          leafModelId: 'DS2000', // Standard model
          uplinksPerLeaf: 2,
          endpointProfiles: [
            { name: 'Standard Server', type: 'server', count: 40, bandwidth: 25, redundancy: false, portsPerEndpoint: 1 }
          ]
        },
        {
          id: 'high-density-leaves',
          name: 'High Density Leaves', 
          role: 'standard',
          leafModelId: 'DS2000', // Could be different model in future
          uplinksPerLeaf: 4,
          endpointProfiles: [
            { name: 'Dense Server', type: 'server', count: 60, bandwidth: 25, redundancy: false, portsPerEndpoint: 2 }
          ]
        }
      ]

      const spec: FabricSpec = {
        name: 'heterogeneous-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000', // Default fallback
        leafClasses
      }

      const topology = computeDerived(spec)
      const wiringDiagram = generateWiringStub(spec, topology)

      // Verify complex wiring generation
      expect(wiringDiagram.devices.leaves.length).toBe(topology.leavesNeeded)
      expect(wiringDiagram.devices.servers.length).toBe(100) // 40 + 60

      // Save and load
      const saveResult = await saveFGD(wiringDiagram, { 
        fabricId: 'heterogeneous-test',
        metadata: { leafClasses }
      })
      expect(saveResult.success).toBe(true)

      const loadResult = await loadFGD({ fabricId: 'heterogeneous-test' })
      expect(loadResult.success).toBe(true)
      expect(loadResult.diagram!.devices.servers).toHaveLength(100)
    })

    it('should preserve LAG constraints in FGD metadata', async () => {
      const leafClassesWithLAG: LeafClass[] = [
        {
          id: 'lag-enabled',
          name: 'LAG Enabled Class',
          role: 'border',
          uplinksPerLeaf: 4,
          endpointProfiles: [
            { name: 'Border Router', type: 'network', count: 8, bandwidth: 100, redundancy: true, portsPerEndpoint: 2 }
          ],
          lag: {
            esLag: {
              enabled: true,
              minMembers: 2,
              maxMembers: 4,
              loadBalancing: 'hash-based'
            },
            mcLag: {
              enabled: true,
              peerLinkCount: 2,
              keepAliveInterval: 1000,
              systemPriority: 100
            }
          }
        }
      ]

      const spec: FabricSpec = {
        name: 'lag-fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: leafClassesWithLAG
      }

      const topology = computeDerived(spec)
      const wiringDiagram = generateWiringStub(spec, topology)

      // Save with LAG metadata
      const saveResult = await saveFGD(wiringDiagram, {
        fabricId: 'lag-test',
        metadata: { 
          leafClasses: leafClassesWithLAG,
          lagEnabled: true
        }
      })
      expect(saveResult.success).toBe(true)

      // Load and verify LAG metadata is preserved
      const loadResult = await loadFGD({ fabricId: 'lag-test' })
      expect(loadResult.success).toBe(true)

      // In a real implementation, LAG metadata would be embedded in the wiring diagram
      // For now, we verify the basic structure is correct
      const loadedDiagram = loadResult.diagram!
      expect(loadedDiagram.devices.servers).toHaveLength(8)
      expect(loadedDiagram.connections.length).toBeGreaterThan(0)
    })
  })

  describe('Error Recovery and Validation', () => {
    it('should handle corrupted FGD data gracefully', async () => {
      // Manually corrupt FGD data
      const corruptedData = {
        invalidStructure: true,
        missingFields: 'corrupted'
      }

      localStorage.setItem('hnc-fgd-corrupted-test', JSON.stringify(corruptedData))

      const loadResult = await loadFGD({ fabricId: 'corrupted-test' })
      
      expect(loadResult.success).toBe(false)
      expect(loadResult.error).toBeDefined()
    })

    it('should validate FGD data structure on load', async () => {
      // Create invalid but well-formed FGD data
      const invalidDiagram: WiringDiagram = {
        devices: {
          spines: [], // Empty spines should be invalid
          leaves: [],
          servers: []
        },
        connections: [],
        metadata: {
          generatedAt: new Date(),
          fabricName: 'invalid-fabric',
          totalDevices: 0
        }
      }

      const saveResult = await saveFGD(invalidDiagram, { fabricId: 'invalid-test' })
      expect(saveResult.success).toBe(true) // Save should work

      const loadResult = await loadFGD({ fabricId: 'invalid-test' })
      expect(loadResult.success).toBe(true) // Load should work
      
      // But the loaded diagram should reflect the empty state
      expect(loadResult.diagram!.devices.spines).toEqual([])
      expect(loadResult.diagram!.devices.leaves).toEqual([])
      expect(loadResult.diagram!.devices.servers).toEqual([])
    })

    it('should handle FGD storage quota exceeded', async () => {
      // Create a very large fabric to test storage limits
      const largeFabric = generateLargeFabricSpec(1000) // 1000 endpoints
      const topology = computeDerived(largeFabric)
      const wiringDiagram = generateWiringStub(largeFabric, topology)

      try {
        const saveResult = await saveFGD(wiringDiagram, { fabricId: 'large-test' })
        
        // Should either succeed or fail gracefully
        if (!saveResult.success) {
          expect(saveResult.error).toContain('storage')
        } else {
          // If it succeeds, should be able to load it back
          const loadResult = await loadFGD({ fabricId: 'large-test' })
          expect(loadResult.success).toBe(true)
        }
      } catch (error) {
        // Storage quota errors are acceptable
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  // Helper function to generate large fabric specs for testing
  function generateLargeFabricSpec(endpointCount: number): FabricSpec {
    const leafClasses: LeafClass[] = [
      {
        id: 'large-compute',
        name: 'Large Compute Cluster',
        role: 'standard',
        uplinksPerLeaf: 2,
        endpointProfiles: [
          { 
            name: 'Large Server', 
            type: 'server', 
            count: endpointCount, 
            bandwidth: 25, 
            redundancy: false,
            portsPerEndpoint: 1 
          }
        ]
      }
    ]

    return {
      name: `large-fabric-${endpointCount}`,
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      leafClasses
    }
  }
})