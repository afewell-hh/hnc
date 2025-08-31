import type { WiringDiagram } from '../app.types.js'
import { serializeWiringDiagram, deserializeWiringDiagram } from './yaml.js'
import { gitService, generateCommitMessage } from '../features/git.service.js'

// Platform-specific implementations
interface FGDPlatform {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  writeFile(path: string, data: string, encoding?: string): Promise<void>
  readFile(path: string, encoding?: string): Promise<string>
  access(path: string): Promise<void>
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<any[]>
  rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>
  join(...paths: string[]): string
}

// Browser-safe in-memory implementation
class BrowserFGD implements FGDPlatform {
  private storage = new Map<string, string>()

  join(...paths: string[]): string {
    // Normalize path for browser environment
    return paths.join('/').replace(/\/+/g, '/').replace(/\/+$/, '').replace(/^\.\//, '') || '/'
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    // Browser implementation: no-op for directories
    return Promise.resolve()
  }

  async writeFile(path: string, data: string, encoding?: string): Promise<void> {
    this.storage.set(path, data)
    // Also store in localStorage for persistence in development
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`fgd:${path}`, data)
      } catch (e) {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }
  }

  async readFile(path: string, encoding?: string): Promise<string> {
    const data = this.storage.get(path)
    if (data !== undefined) {
      return data
    }
    // Try localStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(`fgd:${path}`)
        if (stored !== null) {
          this.storage.set(path, stored)
          return stored
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    const error = new Error(`ENOENT: no such file or directory, open '${path}'`)
    ;(error as any).code = 'ENOENT'
    throw error
  }

  async access(path: string): Promise<void> {
    const exists = this.storage.has(path) || 
      (typeof window !== 'undefined' && window.localStorage?.getItem(`fgd:${path}`) !== null)
    if (!exists) {
      const error = new Error(`ENOENT: no such file or directory, access '${path}'`)
      ;(error as any).code = 'ENOENT'
      throw error
    }
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<any[]> {
    const entries: string[] = []
    
    // Check in-memory storage
    for (const storedPath of this.storage.keys()) {
      if (storedPath.startsWith(path + '/')) {
        const relativePath = storedPath.slice(path.length + 1)
        const parts = relativePath.split('/')
        if (parts.length > 0 && parts[0] && !entries.includes(parts[0])) {
          entries.push(parts[0])
        }
      }
    }

    // Check localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key?.startsWith(`fgd:${path}/`)) {
            const storedPath = key.slice(4) // Remove 'fgd:' prefix
            const relativePath = storedPath.slice(path.length + 1)
            const parts = relativePath.split('/')
            if (parts.length > 0 && parts[0] && !entries.includes(parts[0])) {
              entries.push(parts[0])
            }
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    if (options?.withFileTypes) {
      return entries.map(name => ({ name, isDirectory: () => false }))
    }
    return entries
  }

  async rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
    // Remove from in-memory storage
    const keysToRemove = Array.from(this.storage.keys()).filter(key => 
      key === path || key.startsWith(path + '/')
    )
    keysToRemove.forEach(key => this.storage.delete(key))

    // Remove from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const lsKeysToRemove: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key?.startsWith(`fgd:${path}`) || key === `fgd:${path}`) {
            lsKeysToRemove.push(key)
          }
        }
        lsKeysToRemove.forEach(key => window.localStorage.removeItem(key))
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }
}

// Node.js implementation
class NodeFGD implements FGDPlatform {
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fs = await import('fs')
    await fs.promises.mkdir(path, options)
  }

  async writeFile(path: string, data: string, encoding?: string): Promise<void> {
    const fs = await import('fs')
    await fs.promises.writeFile(path, data, encoding as any)
  }

  async readFile(path: string, encoding?: string): Promise<string> {
    const fs = await import('fs')
    const result = await fs.promises.readFile(path, encoding as any)
    return result.toString()
  }

  async access(path: string): Promise<void> {
    const fs = await import('fs')
    await fs.promises.access(path)
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<any[]> {
    const fs = await import('fs')
    if (options?.withFileTypes) {
      return fs.promises.readdir(path, { withFileTypes: true })
    }
    return fs.promises.readdir(path)
  }

  async rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void> {
    const fs = await import('fs')
    await fs.promises.rm(path, options)
  }

  join(...paths: string[]): string {
    const pathModule = require('path')
    return pathModule.join(...paths)
  }
}

// Platform detection and initialization
function createPlatform(): FGDPlatform {
  // Check if we're in a Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return new NodeFGD()
  }
  // Browser environment
  return new BrowserFGD()
}

const platform = createPlatform()

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
  gitCommit?: string // Git commit hash if Git enabled
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
 * Also commits to Git if Git feature is enabled
 */
export async function saveFGD(diagram: WiringDiagram, options: FGDSaveOptions): Promise<FGDSaveResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = platform.join(baseDir, options.fabricId)
  const fgdId = `fgd-${options.fabricId}-${Date.now()}`
  
  try {
    // Create directories if needed
    if (options.createDirs !== false) {
      await platform.mkdir(fabricPath, { recursive: true })
    }

    // Serialize diagram to YAML strings
    const yamls = serializeWiringDiagram(diagram)
    
    // Define file paths
    const serverPath = platform.join(fabricPath, 'servers.yaml')
    const switchPath = platform.join(fabricPath, 'switches.yaml') 
    const connectionPath = platform.join(fabricPath, 'connections.yaml')

    // Write all files
    await Promise.all([
      platform.writeFile(serverPath, yamls.servers, 'utf8'),
      platform.writeFile(switchPath, yamls.switches, 'utf8'),
      platform.writeFile(connectionPath, yamls.connections, 'utf8')
    ])

    const result: FGDSaveResult = {
      success: true,
      fgdId,
      fabricPath,
      filesWritten: [serverPath, switchPath, connectionPath]
    }

    // Git integration: Write to Git and commit if enabled
    if (gitService.isEnabled()) {
      try {
        const gitWriteSuccess = await gitService.writeFabric(options.fabricId, diagram)
        if (gitWriteSuccess) {
          const commitMessage = generateCommitMessage(options.fabricId, diagram)
          const commitSuccess = await gitService.commitChanges(commitMessage)
          if (commitSuccess) {
            const status = await gitService.getStatus()
            result.gitCommit = status.lastCommit
          }
        }
      } catch (error) {
        // Git operations are optional - log but don't fail the save
        console.warn('Git operations failed during save:', error)
      }
    }

    return result

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
 * Tries Git first if enabled, falls back to platform files
 */
export async function loadFGD(options: FGDLoadOptions): Promise<FGDLoadResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = platform.join(baseDir, options.fabricId)
  
  // Try Git first if enabled
  if (gitService.isEnabled()) {
    try {
      const gitDiagram = await gitService.readFabric(options.fabricId)
      if (gitDiagram) {
        return {
          success: true,
          diagram: gitDiagram,
          fabricPath,
          filesRead: [`git:${fabricPath}/servers.yaml`, `git:${fabricPath}/switches.yaml`, `git:${fabricPath}/connections.yaml`]
        }
      }
    } catch (error) {
      // Git read failed, fall back to platform files
      console.warn('Git load failed, falling back to platform files:', error)
    }
  }
  
  // Define file paths for platform fallback
  const serverPath = platform.join(fabricPath, 'servers.yaml')
  const switchPath = platform.join(fabricPath, 'switches.yaml')
  const connectionPath = platform.join(fabricPath, 'connections.yaml')

  try {
    // Check if all required files exist
    await Promise.all([
      platform.access(serverPath),
      platform.access(switchPath), 
      platform.access(connectionPath)
    ])

    // Read all YAML files
    const [servers, switches, connections] = await Promise.all([
      platform.readFile(serverPath, 'utf8'),
      platform.readFile(switchPath, 'utf8'),
      platform.readFile(connectionPath, 'utf8')
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
    const entries = await platform.readdir(baseDir, { withFileTypes: true })
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
  const fabricPath = platform.join(baseDir, fabricId)
  const requiredFiles = ['servers.yaml', 'switches.yaml', 'connections.yaml']
  
  try {
    // Check if all required files exist
    await Promise.all(
      requiredFiles.map(filename => 
        platform.access(platform.join(fabricPath, filename))
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
  const fabricPath = platform.join(baseDir, fabricId)
  
  try {
    await platform.rm(fabricPath, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}