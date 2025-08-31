/**
 * Git service implementation using isomorphic-git
 * Provides Git operations with feature flag control and graceful fallbacks
 */

import { isGitEnabled } from './feature-flags.js'
import type { WiringDiagram } from '../app.types.js'
import { serializeWiringDiagram, deserializeWiringDiagram } from '../io/yaml.js'

// Dynamic imports for optional dependencies
type GitModule = typeof import('isomorphic-git')
type FSModule = typeof import('@isomorphic-git/lightning-fs')

export interface GitService {
  isEnabled(): boolean
  readFabric(fabricId: string): Promise<WiringDiagram | null>
  writeFabric(fabricId: string, data: WiringDiagram): Promise<boolean>
  commitChanges(message: string): Promise<boolean>
  initRepository(): Promise<boolean>
  getStatus(): Promise<GitStatus>
}

export interface GitStatus {
  enabled: boolean
  initialized: boolean
  lastCommit?: string
  hasChanges: boolean
  error?: string
}

class GitServiceImpl implements GitService {
  private git: GitModule | null = null
  private fs: any = null
  private initialized = false
  private baseDir = './fgd'

  constructor() {
    // Initialize asynchronously if Git is enabled
    if (this.isEnabled()) {
      this.initializeGit().catch(error => {
        console.warn('Git initialization failed:', error.message)
      })
    }
  }

  isEnabled(): boolean {
    return isGitEnabled()
  }

  private async initializeGit(): Promise<void> {
    if (!this.isEnabled()) return

    try {
      // Dynamic imports for optional Git dependencies
      const [gitModule, fsModule] = await Promise.all([
        import('isomorphic-git'),
        import('@isomorphic-git/lightning-fs')
      ])

      this.git = gitModule
      
      // Initialize filesystem based on environment
      if (typeof window !== 'undefined') {
        // Browser environment - use lightning-fs
        const LightningFS: any = fsModule.default || fsModule
        this.fs = new LightningFS('fgd')
      } else {
        // Node.js environment - use native fs
        const fs = await import('fs')
        this.fs = {
          promises: fs.promises,
          // Map lightning-fs API to Node.js fs
          readFile: fs.promises.readFile,
          writeFile: fs.promises.writeFile,
          mkdir: fs.promises.mkdir,
          readdir: fs.promises.readdir,
          stat: fs.promises.stat
        }
      }

      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize Git dependencies:', error)
      this.initialized = false
    }
  }

  async readFabric(fabricId: string): Promise<WiringDiagram | null> {
    if (!this.isEnabled() || !this.initialized) {
      return null // Graceful no-op
    }

    try {
      await this.ensureRepository()
      
      const fabricPath = `${this.baseDir}/${fabricId}`
      
      // Read YAML files from Git repository
      const [servers, switches, connections] = await Promise.all([
        this.readFileFromRepo(`${fabricPath}/servers.yaml`),
        this.readFileFromRepo(`${fabricPath}/switches.yaml`), 
        this.readFileFromRepo(`${fabricPath}/connections.yaml`)
      ])

      if (!servers || !switches || !connections) {
        return null // Files not found
      }

      // Deserialize YAML back to WiringDiagram
      const diagram = deserializeWiringDiagram({
        servers,
        switches, 
        connections
      })

      return diagram
    } catch (error) {
      console.warn(`Git read failed for fabric ${fabricId}:`, error.message)
      return null // Graceful fallback
    }
  }

  async writeFabric(fabricId: string, data: WiringDiagram): Promise<boolean> {
    if (!this.isEnabled() || !this.initialized) {
      return true // No-op success
    }

    try {
      await this.ensureRepository()
      
      const fabricPath = `${this.baseDir}/${fabricId}`
      
      // Ensure fabric directory exists
      await this.fs.mkdir(fabricPath, { recursive: true })
      
      // Serialize diagram to YAML
      const yamls = serializeWiringDiagram(data)
      
      // Write all YAML files
      await Promise.all([
        this.writeFileToRepo(`${fabricPath}/servers.yaml`, yamls.servers),
        this.writeFileToRepo(`${fabricPath}/switches.yaml`, yamls.switches),
        this.writeFileToRepo(`${fabricPath}/connections.yaml`, yamls.connections)
      ])

      return true
    } catch (error) {
      console.warn(`Git write failed for fabric ${fabricId}:`, error.message)
      return false // Operation failed
    }
  }

  async commitChanges(message: string): Promise<boolean> {
    if (!this.isEnabled() || !this.initialized || !this.git) {
      return true // No-op success
    }

    try {
      await this.ensureRepository()

      // Add all changes to staging
      await this.git.add({
        fs: this.fs,
        dir: '.',
        filepath: this.baseDir
      })

      // Commit with message
      await this.git.commit({
        fs: this.fs,
        dir: '.',
        message,
        author: {
          name: 'HNC System',
          email: 'hnc@example.com'
        }
      })

      return true
    } catch (error) {
      console.warn('Git commit failed:', error.message)
      return false
    }
  }

  async initRepository(): Promise<boolean> {
    if (!this.isEnabled() || !this.initialized || !this.git) {
      return true // No-op success
    }

    try {
      // Check if repository already exists
      try {
        await this.fs.stat('.git')
        return true // Already initialized
      } catch (e) {
        // Repository doesn't exist, initialize it
      }

      await this.git.init({
        fs: this.fs,
        dir: '.'
      })

      // Create initial .gitignore if it doesn't exist
      try {
        await this.fs.stat('.gitignore')
      } catch (e) {
        const gitignore = `# HNC Generated Files
node_modules/
dist/
.DS_Store
*.log
`
        await this.writeFileToRepo('.gitignore', gitignore)
        
        // Initial commit
        await this.commitChanges('Initial commit: Initialize HNC repository')
      }

      return true
    } catch (error) {
      console.warn('Git repository initialization failed:', error.message)
      return false
    }
  }

  async getStatus(): Promise<GitStatus> {
    const status: GitStatus = {
      enabled: this.isEnabled(),
      initialized: this.initialized,
      hasChanges: false
    }

    if (!this.isEnabled() || !this.initialized || !this.git) {
      return status
    }

    try {
      // Get repository status
      const statusMatrix = await this.git.statusMatrix({
        fs: this.fs,
        dir: '.'
      })

      // Check for changes (modified, added, or deleted files)
      status.hasChanges = statusMatrix.some(([, head, working, stage]) => 
        head !== working || head !== stage
      )

      // Get last commit info
      try {
        const commits = await this.git.log({
          fs: this.fs,
          dir: '.',
          depth: 1
        })
        if (commits.length > 0) {
          const lastCommit = commits[0]
          status.lastCommit = `${lastCommit.oid.slice(0, 8)} - ${lastCommit.commit.message}`
        }
      } catch (e) {
        // No commits yet
      }

    } catch (error) {
      status.error = error.message
    }

    return status
  }

  private async ensureRepository(): Promise<void> {
    if (!this.initialized) {
      await this.initializeGit()
    }
    
    if (!this.initialized) {
      throw new Error('Git service not properly initialized')
    }

    // Ensure repository is initialized
    try {
      await this.fs.stat('.git')
    } catch (e) {
      await this.initRepository()
    }
  }

  private async readFileFromRepo(filepath: string): Promise<string | null> {
    try {
      const data = await this.fs.readFile(filepath, { encoding: 'utf8' })
      return data
    } catch (error) {
      return null
    }
  }

  private async writeFileToRepo(filepath: string, content: string): Promise<void> {
    await this.fs.writeFile(filepath, content, { encoding: 'utf8' })
  }
}

// No-op implementation when Git is disabled
class NoOpGitService implements GitService {
  isEnabled(): boolean {
    return false
  }

  async readFabric(fabricId: string): Promise<WiringDiagram | null> {
    return null // No-op
  }

  async writeFabric(fabricId: string, data: WiringDiagram): Promise<boolean> {
    return true // No-op success
  }

  async commitChanges(message: string): Promise<boolean> {
    return true // No-op success
  }

  async initRepository(): Promise<boolean> {
    return true // No-op success
  }

  async getStatus(): Promise<GitStatus> {
    return {
      enabled: false,
      initialized: false,
      hasChanges: false
    }
  }
}

// Export singleton instance
export const gitService: GitService = isGitEnabled() 
  ? new GitServiceImpl() 
  : new NoOpGitService()

// Helper function to generate commit messages
export function generateCommitMessage(fabricId: string, diagram: WiringDiagram): string {
  const serverCount = diagram.devices.servers.length
  const leafCount = diagram.devices.leaves.length
  const spineCount = diagram.devices.spines.length
  const switchCount = leafCount + spineCount
  
  const endpointCount = diagram.devices.servers.reduce((total, server) => {
    return total + (server.connections || 0)
  }, 0)

  return `Save ${fabricId}: Updated topology configuration

- ${leafCount} leaves, ${spineCount} spines computed
- ${endpointCount} endpoints allocated
- ${serverCount} servers, ${switchCount} switches total
- Generated via HNC v0.3.0`
}
