import type { WiringDiagram } from '../app.types.js'
import { serializeWiringDiagram, deserializeWiringDiagram } from './yaml.js'
import { serializeWiringDiagramToCRDs, deserializeCRDsToWiringDiagram } from './crd-yaml.js'
import type { CRDYAMLs, CRDSerializationOptions } from './crd-yaml.js'
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
    // ES module compatible path joining for Node.js
    // Use posix-style joining that works across platforms
    return paths.join('/').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
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
  metadata?: any // For storing additional fabric metadata
  version?: string // Version tracking
  // CRD output options
  outputFormat?: 'legacy' | 'crd' | 'both' // Default: 'legacy' for backwards compatibility
  crdOptions?: CRDSerializationOptions // CRD-specific serialization options
}

export interface FGDLoadOptions {
  fabricId: string
  baseDir?: string // Default: './fgd'
  // CRD input options
  inputFormat?: 'auto' | 'legacy' | 'crd' // Default: 'auto' - detect format automatically
  preferCRD?: boolean // Default: false - prefer CRD format if both exist
}

export interface FGDSaveResult {
  success: boolean
  fgdId: string
  fabricPath: string
  filesWritten: string[]
  outputFormat: 'legacy' | 'crd' | 'both'
  crdCompliant?: boolean // Whether CRD files were generated
  gitCommit?: string // Git commit hash if Git enabled
  error?: string
}

export interface FGDLoadResult {
  success: boolean
  diagram?: WiringDiagram
  fabricPath: string
  filesRead: string[]
  detectedFormat?: 'legacy' | 'crd'
  crdCompliant?: boolean // Whether loaded from CRD format
  error?: string
}

/**
 * Saves a WiringDiagram to local FGD directory structure
 * Creates: ./fgd/{fabric-id}/servers.yaml, switches.yaml, connections.yaml
 * Also commits to Git if Git feature is enabled
 * Supports both legacy HNC format and upstream CRD-compliant format
 */
export async function saveFGD(diagram: WiringDiagram, options: FGDSaveOptions): Promise<FGDSaveResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = platform.join(baseDir, options.fabricId)
  const fgdId = `fgd-${options.fabricId}-${Date.now()}`
  const outputFormat = options.outputFormat || 'legacy'
  
  try {
    // Create directories if needed
    if (options.createDirs !== false) {
      await platform.mkdir(fabricPath, { recursive: true })
    }

    let filesWritten: string[] = []
    let crdCompliant = false

    // Handle different output formats
    if (outputFormat === 'legacy' || outputFormat === 'both') {
      // Legacy HNC format
      const yamls = serializeWiringDiagram(diagram)
      
      const legacyServerPath = platform.join(fabricPath, 'servers.yaml')
      const legacySwitchPath = platform.join(fabricPath, 'switches.yaml') 
      const legacyConnectionPath = platform.join(fabricPath, 'connections.yaml')

      await Promise.all([
        platform.writeFile(legacyServerPath, yamls.servers, 'utf8'),
        platform.writeFile(legacySwitchPath, yamls.switches, 'utf8'),
        platform.writeFile(legacyConnectionPath, yamls.connections, 'utf8')
      ])

      filesWritten.push(legacyServerPath, legacySwitchPath, legacyConnectionPath)
    }

    if (outputFormat === 'crd' || outputFormat === 'both') {
      // CRD-compliant format
      const crdYamls = serializeWiringDiagramToCRDs(diagram, options.crdOptions)
      crdCompliant = true
      
      // Use different filenames for CRD format to avoid conflicts
      const crdSuffix = outputFormat === 'both' ? '.crd' : ''
      const fabricPath_crd = platform.join(fabricPath, `fabric${crdSuffix}.yaml`)
      const serverPath_crd = platform.join(fabricPath, `servers${crdSuffix}.yaml`)
      const switchPath_crd = platform.join(fabricPath, `switches${crdSuffix}.yaml`) 
      const connectionPath_crd = platform.join(fabricPath, `connections${crdSuffix}.yaml`)

      await Promise.all([
        platform.writeFile(fabricPath_crd, crdYamls.fabric, 'utf8'),
        platform.writeFile(serverPath_crd, crdYamls.servers, 'utf8'),
        platform.writeFile(switchPath_crd, crdYamls.switches, 'utf8'),
        platform.writeFile(connectionPath_crd, crdYamls.connections, 'utf8')
      ])

      filesWritten.push(fabricPath_crd, serverPath_crd, switchPath_crd, connectionPath_crd)
    }

    const result: FGDSaveResult = {
      success: true,
      fgdId,
      fabricPath,
      filesWritten,
      outputFormat,
      crdCompliant
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
      outputFormat,
      crdCompliant: false,
      error: error instanceof Error ? error.message : 'Unknown error during save'
    }
  }
}

/**
 * Loads a WiringDiagram from local FGD directory structure
 * Reads: ./fgd/{fabric-id}/servers.yaml, switches.yaml, connections.yaml
 * Tries Git first if enabled, falls back to platform files
 * Supports both legacy HNC format and upstream CRD-compliant format
 */
export async function loadFGD(options: FGDLoadOptions): Promise<FGDLoadResult> {
  const baseDir = options.baseDir || './fgd'
  const fabricPath = platform.join(baseDir, options.fabricId)
  const inputFormat = options.inputFormat || 'auto'
  const preferCRD = options.preferCRD || false
  
  // Try Git first if enabled (only for legacy format for now)
  if (gitService.isEnabled() && (inputFormat === 'auto' || inputFormat === 'legacy')) {
    try {
      const gitDiagram = await gitService.readFabric(options.fabricId)
      if (gitDiagram) {
        return {
          success: true,
          diagram: gitDiagram,
          fabricPath,
          filesRead: [`git:${fabricPath}/servers.yaml`, `git:${fabricPath}/switches.yaml`, `git:${fabricPath}/connections.yaml`],
          detectedFormat: 'legacy',
          crdCompliant: false
        }
      }
    } catch (error) {
      // Git read failed, fall back to platform files
      console.warn('Git load failed, falling back to platform files:', error)
    }
  }
  
  // Determine which format to try based on options and file availability
  const formatPriority = determineFormatPriority(inputFormat, preferCRD)
  
  for (const format of formatPriority) {
    try {
      if (format === 'crd') {
        const result = await loadCRDFormat(fabricPath)
        if (result.success) {
          return {
            ...result,
            detectedFormat: 'crd',
            crdCompliant: true
          }
        }
      } else {
        const result = await loadLegacyFormat(fabricPath)
        if (result.success) {
          return {
            ...result,
            detectedFormat: 'legacy',
            crdCompliant: false
          }
        }
      }
    } catch (error) {
      // Continue to next format
      console.warn(`Failed to load ${format} format:`, error)
    }
  }
  
  // If all formats failed
  return {
    success: false,
    fabricPath,
    filesRead: [],
    error: `No valid FGD files found at ${fabricPath} in any supported format (tried: ${formatPriority.join(', ')})`
  }
}

/**
 * Determine format priority based on options
 */
function determineFormatPriority(inputFormat: string, preferCRD: boolean): ('legacy' | 'crd')[] {
  if (inputFormat === 'legacy') return ['legacy']
  if (inputFormat === 'crd') return ['crd']
  
  // Auto detection
  return preferCRD ? ['crd', 'legacy'] : ['legacy', 'crd']
}

/**
 * Load CRD format files
 */
async function loadCRDFormat(fabricPath: string): Promise<Omit<FGDLoadResult, 'detectedFormat' | 'crdCompliant'>> {
  // CRD format file paths
  const fabricCRDPath = platform.join(fabricPath, 'fabric.yaml')
  const serversCRDPath = platform.join(fabricPath, 'servers.yaml')
  const switchesCRDPath = platform.join(fabricPath, 'switches.yaml')
  const connectionsCRDPath = platform.join(fabricPath, 'connections.yaml')
  
  // Check if CRD files exist (try both regular and .crd suffixed versions)
  const crdPaths = [
    [fabricCRDPath, serversCRDPath, switchesCRDPath, connectionsCRDPath],
    [
      platform.join(fabricPath, 'fabric.crd.yaml'),
      platform.join(fabricPath, 'servers.crd.yaml'),
      platform.join(fabricPath, 'switches.crd.yaml'),
      platform.join(fabricPath, 'connections.crd.yaml')
    ]
  ]
  
  for (const [fabricPath_crd, serversPath_crd, switchesPath_crd, connectionsPath_crd] of crdPaths) {
    try {
      // Check if all required files exist
      await Promise.all([
        platform.access(fabricPath_crd),
        platform.access(serversPath_crd),
        platform.access(switchesPath_crd),
        platform.access(connectionsPath_crd)
      ])

      // Read all CRD YAML files
      const [fabric, servers, switches, connections] = await Promise.all([
        platform.readFile(fabricPath_crd, 'utf8'),
        platform.readFile(serversPath_crd, 'utf8'),
        platform.readFile(switchesPath_crd, 'utf8'),
        platform.readFile(connectionsPath_crd, 'utf8')
      ])

      // Deserialize CRDs back to WiringDiagram
      const diagram = deserializeCRDsToWiringDiagram({ fabric, servers, switches, connections })

      return {
        success: true,
        diagram,
        fabricPath,
        filesRead: [fabricPath_crd, serversPath_crd, switchesPath_crd, connectionsPath_crd]
      }
    } catch (error) {
      // Try next set of paths
      continue
    }
  }
  
  throw new Error('CRD format files not found or invalid')
}

/**
 * Load legacy format files
 */
async function loadLegacyFormat(fabricPath: string): Promise<Omit<FGDLoadResult, 'detectedFormat' | 'crdCompliant'>> {
  const serverPath = platform.join(fabricPath, 'servers.yaml')
  const switchPath = platform.join(fabricPath, 'switches.yaml')
  const connectionPath = platform.join(fabricPath, 'connections.yaml')

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
 * Checks if a fabric exists in the FGD directory (supports both legacy and CRD formats)
 */
export async function fabricExists(fabricId: string, baseDir = './fgd'): Promise<boolean> {
  const fabricPath = platform.join(baseDir, fabricId)
  
  // Check for legacy format
  const legacyFiles = ['servers.yaml', 'switches.yaml', 'connections.yaml']
  try {
    await Promise.all(
      legacyFiles.map(filename => 
        platform.access(platform.join(fabricPath, filename))
      )
    )
    return true
  } catch {
    // Legacy format doesn't exist, try CRD format
  }
  
  // Check for CRD format
  const crdFiles = ['fabric.yaml', 'servers.yaml', 'switches.yaml', 'connections.yaml']
  try {
    await Promise.all(
      crdFiles.map(filename => 
        platform.access(platform.join(fabricPath, filename))
      )
    )
    return true
  } catch {
    // Neither format exists
  }
  
  // Check for CRD format with .crd suffix
  const crdSuffixFiles = ['fabric.crd.yaml', 'servers.crd.yaml', 'switches.crd.yaml', 'connections.crd.yaml']
  try {
    await Promise.all(
      crdSuffixFiles.map(filename => 
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