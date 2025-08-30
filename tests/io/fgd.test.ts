import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { saveFGD, loadFGD, listFabrics, fabricExists, deleteFabric } from '../../src/io/fgd'
import type { WiringDiagram } from '../../src/app.types'

const TEST_BASE_DIR = './test-fgd'
const TEST_FABRIC_ID = 'test-fabric-123'

// Test fixture
const mockWiringDiagram: WiringDiagram = {
  devices: {
    spines: [
      { id: 'spine-1', model: 'DS3000', ports: 32 },
      { id: 'spine-2', model: 'DS3000', ports: 32 }
    ],
    leaves: [
      { id: 'leaf-1', model: 'DS2000', ports: 48 },
      { id: 'leaf-2', model: 'DS2000', ports: 48 }
    ],
    servers: [
      { id: 'server-1', type: 'compute', connections: 2 },
      { id: 'server-2', type: 'storage', connections: 4 },
      { id: 'server-3', type: 'management', connections: 1 }
    ]
  },
  connections: [
    {
      from: { device: 'leaf-1', port: 'uplink-1' },
      to: { device: 'spine-1', port: 'downlink-1' },
      type: 'uplink'
    },
    {
      from: { device: 'leaf-1', port: 'uplink-2' },
      to: { device: 'spine-2', port: 'downlink-2' },
      type: 'uplink'
    },
    {
      from: { device: 'leaf-2', port: 'uplink-1' },
      to: { device: 'spine-1', port: 'downlink-3' },
      type: 'uplink'
    }
  ],
  metadata: {
    generatedAt: new Date('2024-01-01T12:00:00Z'),
    fabricName: 'test-fabric-integration',
    totalDevices: 7
  }
}

describe('FGD File Operations', () => {
  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true })
    } catch {
      // Directory may not exist, ignore
    }
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true })
    } catch {
      // Directory may not exist, ignore
    }
  })

  describe('saveFGD', () => {
    it('should create directory and save YAML files', async () => {
      const result = await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(true)
      expect(result.fgdId).toMatch(/^fgd-test-fabric-123-\d+$/)
      expect(result.fabricPath).toBe(join(TEST_BASE_DIR, TEST_FABRIC_ID))
      expect(result.filesWritten).toHaveLength(3)
      expect(result.error).toBeUndefined()

      // Verify files were actually created
      const expectedFiles = ['servers.yaml', 'switches.yaml', 'connections.yaml']
      for (const filename of expectedFiles) {
        const filepath = join(TEST_BASE_DIR, TEST_FABRIC_ID, filename)
        expect(result.filesWritten).toContain(filepath)
        await expect(fs.access(filepath)).resolves.toBeUndefined()
      }
    })

    it('should write valid YAML content to files', async () => {
      await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      const fabricPath = join(TEST_BASE_DIR, TEST_FABRIC_ID)
      
      // Read and verify servers.yaml
      const serversContent = await fs.readFile(join(fabricPath, 'servers.yaml'), 'utf8')
      expect(serversContent).toContain('servers:')
      expect(serversContent).toContain('server-1')
      expect(serversContent).toContain('compute')

      // Read and verify switches.yaml
      const switchesContent = await fs.readFile(join(fabricPath, 'switches.yaml'), 'utf8')
      expect(switchesContent).toContain('switches:')
      expect(switchesContent).toContain('spine-1')
      expect(switchesContent).toContain('leaf-1')
      expect(switchesContent).toContain('DS3000')
      expect(switchesContent).toContain('DS2000')

      // Read and verify connections.yaml
      const connectionsContent = await fs.readFile(join(fabricPath, 'connections.yaml'), 'utf8')
      expect(connectionsContent).toContain('connections:')
      expect(connectionsContent).toContain('uplink-1')
      expect(connectionsContent).toContain('downlink-1')
    })

    it('should handle fabric names with special characters', async () => {
      const specialFabricId = 'fabric-with-dashes_underscores.dots'
      
      const result = await saveFGD(mockWiringDiagram, {
        fabricId: specialFabricId,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(true)
      expect(result.fabricPath).toBe(join(TEST_BASE_DIR, specialFabricId))
      
      // Verify directory was created
      const stat = await fs.stat(join(TEST_BASE_DIR, specialFabricId))
      expect(stat.isDirectory()).toBe(true)
    })

    it('should overwrite existing files', async () => {
      // First save
      await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      // Modify diagram
      const modifiedDiagram = {
        ...mockWiringDiagram,
        metadata: {
          ...mockWiringDiagram.metadata,
          fabricName: 'modified-fabric'
        }
      }

      // Second save (should overwrite)
      const result = await saveFGD(modifiedDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(true)

      // Verify content was overwritten
      const connectionsContent = await fs.readFile(
        join(TEST_BASE_DIR, TEST_FABRIC_ID, 'connections.yaml'), 
        'utf8'
      )
      expect(connectionsContent).toContain('modified-fabric')
    })
  })

  describe('loadFGD', () => {
    beforeEach(async () => {
      // Setup: Save a diagram for loading tests
      await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })
    })

    it('should load and reconstruct wiring diagram', async () => {
      const result = await loadFGD({
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(true)
      expect(result.diagram).toBeDefined()
      expect(result.fabricPath).toBe(join(TEST_BASE_DIR, TEST_FABRIC_ID))
      expect(result.filesRead).toHaveLength(3)
      expect(result.error).toBeUndefined()

      // Verify diagram structure
      const diagram = result.diagram!
      expect(diagram.devices.spines).toHaveLength(2)
      expect(diagram.devices.leaves).toHaveLength(2)
      expect(diagram.devices.servers).toHaveLength(3)
      expect(diagram.connections).toHaveLength(3)
    })

    it('should preserve data integrity through save-load cycle', async () => {
      const result = await loadFGD({
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(true)
      const loadedDiagram = result.diagram!

      // Verify devices
      expect(loadedDiagram.devices.spines).toEqual(mockWiringDiagram.devices.spines)
      expect(loadedDiagram.devices.leaves).toEqual(mockWiringDiagram.devices.leaves)
      expect(loadedDiagram.devices.servers).toEqual(mockWiringDiagram.devices.servers)

      // Verify connections
      expect(loadedDiagram.connections).toEqual(mockWiringDiagram.connections)

      // Verify metadata (excluding exact timestamp)
      expect(loadedDiagram.metadata.fabricName).toBe(mockWiringDiagram.metadata.fabricName)
      expect(loadedDiagram.metadata.totalDevices).toBe(mockWiringDiagram.metadata.totalDevices)
    })

    it('should return error for non-existent fabric', async () => {
      const result = await loadFGD({
        fabricId: 'non-existent-fabric',
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(false)
      expect(result.diagram).toBeUndefined()
      expect(result.error).toContain('FGD files not found')
      expect(result.error).toContain('servers.yaml, switches.yaml, connections.yaml')
    })

    it('should return error for missing files', async () => {
      // Create directory but only some files
      const incompleteFabricId = 'incomplete-fabric'
      const incompletePath = join(TEST_BASE_DIR, incompleteFabricId)
      await fs.mkdir(incompletePath, { recursive: true })
      await fs.writeFile(join(incompletePath, 'servers.yaml'), 'servers: []')
      // Missing switches.yaml and connections.yaml

      const result = await loadFGD({
        fabricId: incompleteFabricId,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('FGD files not found')
    })

    it('should return error for corrupted YAML', async () => {
      // Create fabric with corrupted YAML
      const corruptedFabricId = 'corrupted-fabric'
      const corruptedPath = join(TEST_BASE_DIR, corruptedFabricId)
      await fs.mkdir(corruptedPath, { recursive: true })
      await fs.writeFile(join(corruptedPath, 'servers.yaml'), 'servers: []')
      await fs.writeFile(join(corruptedPath, 'switches.yaml'), 'switches: []')
      await fs.writeFile(join(corruptedPath, 'connections.yaml'), 'invalid: yaml: [unclosed')

      const result = await loadFGD({
        fabricId: corruptedFabricId,
        baseDir: TEST_BASE_DIR
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to deserialize')
    })
  })

  describe('Utility Functions', () => {
    it('should list available fabrics', async () => {
      // Create multiple fabrics
      const fabricIds = ['fabric-1', 'fabric-2', 'fabric-3']
      
      for (const fabricId of fabricIds) {
        await saveFGD(mockWiringDiagram, {
          fabricId,
          baseDir: TEST_BASE_DIR
        })
      }

      const result = await listFabrics(TEST_BASE_DIR)
      
      expect(result).toHaveLength(3)
      expect(result).toEqual(expect.arrayContaining(fabricIds))
      expect(result).toEqual(fabricIds.sort()) // Should be sorted
    })

    it('should return empty array for non-existent directory', async () => {
      const result = await listFabrics('./non-existent-directory')
      expect(result).toEqual([])
    })

    it('should check fabric existence', async () => {
      await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      const exists = await fabricExists(TEST_FABRIC_ID, TEST_BASE_DIR)
      const notExists = await fabricExists('non-existent', TEST_BASE_DIR)

      expect(exists).toBe(true)
      expect(notExists).toBe(false)
    })

    it('should delete fabric', async () => {
      await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })

      // Verify exists
      expect(await fabricExists(TEST_FABRIC_ID, TEST_BASE_DIR)).toBe(true)

      // Delete
      const deleted = await deleteFabric(TEST_FABRIC_ID, TEST_BASE_DIR)
      expect(deleted).toBe(true)

      // Verify doesn't exist
      expect(await fabricExists(TEST_FABRIC_ID, TEST_BASE_DIR)).toBe(false)
    })
  })

  describe('Golden Path Integration', () => {
    it('should handle complete save-load-modify-save cycle', async () => {
      // 1. Save initial diagram
      const saveResult1 = await saveFGD(mockWiringDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })
      expect(saveResult1.success).toBe(true)

      // 2. Load the diagram
      const loadResult = await loadFGD({
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })
      expect(loadResult.success).toBe(true)
      
      // 3. Modify the loaded diagram
      const modifiedDiagram = {
        ...loadResult.diagram!,
        devices: {
          ...loadResult.diagram!.devices,
          servers: [
            ...loadResult.diagram!.devices.servers,
            { id: 'server-4', type: 'additional', connections: 1 }
          ]
        },
        metadata: {
          ...loadResult.diagram!.metadata,
          totalDevices: loadResult.diagram!.metadata.totalDevices + 1,
          generatedAt: new Date('2024-01-02T12:00:00Z')
        }
      }

      // 4. Save modified diagram
      const saveResult2 = await saveFGD(modifiedDiagram, {
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })
      expect(saveResult2.success).toBe(true)

      // 5. Load again and verify modifications
      const finalLoadResult = await loadFGD({
        fabricId: TEST_FABRIC_ID,
        baseDir: TEST_BASE_DIR
      })
      expect(finalLoadResult.success).toBe(true)
      expect(finalLoadResult.diagram!.devices.servers).toHaveLength(4)
      expect(finalLoadResult.diagram!.metadata.totalDevices).toBe(8)
      expect(finalLoadResult.diagram!.devices.servers.some(s => s.id === 'server-4')).toBe(true)
    })
  })
})