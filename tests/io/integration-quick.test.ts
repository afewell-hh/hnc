import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { saveFGD, loadFGD } from '../../src/io/fgd'
import { serializeWiringDiagram, deserializeWiringDiagram } from '../../src/io/yaml'
import { computeTopology, generateWiringStub, FabricSpecSchema } from '../../src/app.state'
import type { WiringDiagram, FabricSpec } from '../../src/app.types'

const TEST_BASE_DIR = './test-integration-fgd'

// Working specification that produces valid topology
const validSpec: FabricSpec = {
  name: 'integration-test-fabric',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 8, // Even number, good ratio
  endpointProfile: {
    name: 'compute-standard',
    portsPerEndpoint: 2
  },
  endpointCount: 24 // Should give 3:1 oversubscription ratio
}

describe('Quick Integration Test: Compute → Save → Reload', () => {
  beforeEach(async () => {
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true })
    } catch {
      // Directory may not exist, ignore
    }
  })

  afterEach(async () => {
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true })
    } catch {
      // Directory may not exist, ignore
    }
  })

  it('should complete compute→serialize→save→load→deserialize cycle', async () => {
    // STEP 1: Compute topology
    const parsedSpec = FabricSpecSchema.parse(validSpec)
    const topology = computeTopology(parsedSpec)
    
    expect(topology.isValid).toBe(true)
    expect(topology.leavesNeeded).toBeGreaterThan(0)
    expect(topology.spinesNeeded).toBeGreaterThan(0)
    expect(topology.oversubscriptionRatio).toBeLessThanOrEqual(4.0)
    
    console.log('✓ Topology computed:', {
      leaves: topology.leavesNeeded,
      spines: topology.spinesNeeded,
      oversubscription: topology.oversubscriptionRatio.toFixed(2) + ':1'
    })

    // STEP 2: Generate wiring diagram
    const wiringDiagram = generateWiringStub(parsedSpec, topology)
    
    expect(wiringDiagram.devices.spines).toHaveLength(topology.spinesNeeded)
    expect(wiringDiagram.devices.leaves).toHaveLength(topology.leavesNeeded)
    expect(wiringDiagram.devices.servers).toHaveLength(parsedSpec.endpointCount)
    expect(wiringDiagram.connections.length).toBeGreaterThan(0)
    
    console.log('✓ Wiring diagram generated:', {
      spines: wiringDiagram.devices.spines.length,
      leaves: wiringDiagram.devices.leaves.length,
      servers: wiringDiagram.devices.servers.length,
      connections: wiringDiagram.connections.length
    })

    // STEP 3: Test YAML serialization roundtrip
    const serialized = serializeWiringDiagram(wiringDiagram)
    expect(serialized.servers).toBeDefined()
    expect(serialized.switches).toBeDefined()
    expect(serialized.connections).toBeDefined()
    
    const deserialized = deserializeWiringDiagram(serialized)
    expect(deserialized.devices.spines).toEqual(wiringDiagram.devices.spines)
    expect(deserialized.devices.leaves).toEqual(wiringDiagram.devices.leaves)
    expect(deserialized.devices.servers).toEqual(wiringDiagram.devices.servers)
    expect(deserialized.connections).toEqual(wiringDiagram.connections)
    
    console.log('✓ YAML serialization roundtrip works')

    // STEP 4: Test FGD save
    const saveResult = await saveFGD(wiringDiagram, {
      fabricId: parsedSpec.name,
      baseDir: TEST_BASE_DIR
    })
    
    expect(saveResult.success).toBe(true)
    expect(saveResult.filesWritten).toHaveLength(3)
    console.log('✓ FGD save successful:', saveResult.filesWritten)

    // STEP 5: Test FGD load
    const loadResult = await loadFGD({
      fabricId: parsedSpec.name,
      baseDir: TEST_BASE_DIR
    })
    
    expect(loadResult.success).toBe(true)
    expect(loadResult.diagram).toBeDefined()
    console.log('✓ FGD load successful')

    // STEP 6: Verify data integrity through complete cycle
    const loadedDiagram = loadResult.diagram!
    
    expect(loadedDiagram.devices.spines).toEqual(wiringDiagram.devices.spines)
    expect(loadedDiagram.devices.leaves).toEqual(wiringDiagram.devices.leaves)
    expect(loadedDiagram.devices.servers).toEqual(wiringDiagram.devices.servers)
    expect(loadedDiagram.connections).toEqual(wiringDiagram.connections)
    expect(loadedDiagram.metadata.fabricName).toBe(wiringDiagram.metadata.fabricName)
    
    console.log('✓ Complete cycle preserves data integrity')

    // STEP 7: Verify file contents are valid
    const fabricPath = `${TEST_BASE_DIR}/${parsedSpec.name}`
    const serverContent = await fs.readFile(`${fabricPath}/servers.yaml`, 'utf8')
    const switchContent = await fs.readFile(`${fabricPath}/switches.yaml`, 'utf8')
    const connectionContent = await fs.readFile(`${fabricPath}/connections.yaml`, 'utf8')
    
    expect(serverContent).toContain('servers:')
    expect(switchContent).toContain('switches:')
    expect(connectionContent).toContain('connections:')
    expect(connectionContent).toContain(parsedSpec.name)
    
    console.log('✓ YAML files contain expected content')
    console.log('🎉 Complete compute→save→reload workflow verified successfully!')
  })
})