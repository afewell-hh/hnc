import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import type { WiringDiagram } from '../app.types.js'
import { serializeWiringDiagram, deserializeWiringDiagram } from './yaml.js'

export interface FGDSaveOptions {
  fabricId: string
  baseDir?: string // Default: './fgd'
  createDirs?: boolean // Default: true
}

export interface FGDLoadOptions {
  fabricId: string
  baseDir?: string // Default: './fgd'
}

export interface FGDSaveResult {
  success: boolean
  fgdId: string
  fabricPath: string
  filesWritten: string[]
  error?: string
}

export interface FGDLoadResult {
  success: boolean
  diagram?: WiringDiagram
  fabricPath: string
  filesRead: string[]
  error?: string
}

/**
 * Saves a WiringDiagram to local FGD directory structure
 * Creates: ./fgd/{fabric-id}/servers.yaml, switches.yaml, connections.yaml
 */
export async function saveFGD(diagram: WiringDiagram, options: FGDSaveOptions): Promise<FGDSaveResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = join(baseDir, options.fabricId)
  const fgdId = `fgd-${options.fabricId}-${Date.now()}`
  
  try {
    // Create directories if needed
    if (options.createDirs !== false) {
      await fs.mkdir(fabricPath, { recursive: true })
    }

    // Serialize diagram to YAML strings
    const yamls = serializeWiringDiagram(diagram)
    
    // Define file paths
    const serverPath = join(fabricPath, 'servers.yaml')
    const switchPath = join(fabricPath, 'switches.yaml') 
    const connectionPath = join(fabricPath, 'connections.yaml')

    // Write all files
    await Promise.all([
      fs.writeFile(serverPath, yamls.servers, 'utf8'),
      fs.writeFile(switchPath, yamls.switches, 'utf8'),
      fs.writeFile(connectionPath, yamls.connections, 'utf8')
    ])

    return {
      success: true,
      fgdId,
      fabricPath,
      filesWritten: [serverPath, switchPath, connectionPath]
    }

  } catch (error) {
    return {
      success: false,
      fgdId,
      fabricPath,
      filesWritten: [],
      error: error instanceof Error ? error.message : 'Unknown error during save'
    }
  }
}

/**
 * Loads a WiringDiagram from local FGD directory structure
 * Reads: ./fgd/{fabric-id}/servers.yaml, switches.yaml, connections.yaml
 */
export async function loadFGD(options: FGDLoadOptions): Promise<FGDLoadResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = join(baseDir, options.fabricId)
  
  // Define file paths
  const serverPath = join(fabricPath, 'servers.yaml')
  const switchPath = join(fabricPath, 'switches.yaml')
  const connectionPath = join(fabricPath, 'connections.yaml')

  try {
    // Check if all required files exist
    await Promise.all([
      fs.access(serverPath),
      fs.access(switchPath), 
      fs.access(connectionPath)
    ])

    // Read all YAML files
    const [servers, switches, connections] = await Promise.all([
      fs.readFile(serverPath, 'utf8'),
      fs.readFile(switchPath, 'utf8'),
      fs.readFile(connectionPath, 'utf8')
    ])

    // Deserialize back to WiringDiagram
    const diagram = deserializeWiringDiagram({
      servers,
      switches,
      connections
    })

    return {
      success: true,
      diagram,
      fabricPath,
      filesRead: [serverPath, switchPath, connectionPath]
    }

  } catch (error) {
    // Handle specific error types
    let errorMessage = 'Unknown error during load'
    
    if ((error as any).code === 'ENOENT') {
      errorMessage = `FGD files not found at ${fabricPath}. Expected files: servers.yaml, switches.yaml, connections.yaml`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      success: false,
      fabricPath,
      filesRead: [],
      error: errorMessage
    }
  }
}

/**
 * Lists all available fabric IDs in the FGD directory
 */
export async function listFabrics(baseDir = './fgd'): Promise<string[]> {
  try {
    // Small delay to handle timing issues in tests
    await new Promise(resolve => setTimeout(resolve, 10))
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return [] // FGD directory doesn't exist yet
    }
    throw error
  }
}

/**
 * Checks if a fabric exists in the FGD directory
 */
export async function fabricExists(fabricId: string, baseDir = './fgd'): Promise<boolean> {
  const fabricPath = join(baseDir, fabricId)
  const requiredFiles = ['servers.yaml', 'switches.yaml', 'connections.yaml']
  
  try {
    // Check if all required files exist
    await Promise.all(
      requiredFiles.map(filename => 
        fs.access(join(fabricPath, filename))
      )
    )
    return true
  } catch {
    return false
  }
}

/**
 * Deletes a fabric from the FGD directory
 */
export async function deleteFabric(fabricId: string, baseDir = './fgd'): Promise<boolean> {
  const fabricPath = join(baseDir, fabricId)
  
  try {
    await fs.rm(fabricPath, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}