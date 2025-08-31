/**
 * Git service JavaScript implementation for machine integration
 * Provides the same interface as the TypeScript version
 */

// Use ES modules for consistency with project setup
import { isGitEnabled } from './feature-flags.js'
import { serializeWiringDiagram, deserializeWiringDiagram } from '../io/yaml.js'

class GitServiceJS {
  constructor() {
    this.git = null
    this.fs = null
    this.initialized = false
    this.baseDir = './fgd'

    if (this.isEnabled()) {
      this.initializeGit().catch(error => {
        console.warn('Git initialization failed:', error.message)
      })
    }
  }

  isEnabled() {
    return isGitEnabled()
  }

  async initializeGit() {
    if (!this.isEnabled()) return

    try {
      // Dynamic imports for optional Git dependencies
      const gitModule = await import('isomorphic-git')
      this.git = gitModule
      
      // Initialize filesystem based on environment
      if (typeof window !== 'undefined') {
        const fsModule = await import('@isomorphic-git/lightning-fs')
        const LightningFS = fsModule.default || fsModule
        this.fs = new LightningFS('fgd')
      } else {
        const fs = await import('fs')
        this.fs = {
          promises: fs.promises,
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

  async readFabric(fabricId) {
    if (!this.isEnabled() || !this.initialized) {
      return null
    }

    try {
      await this.ensureRepository()
      
      const fabricPath = `${this.baseDir}/${fabricId}`
      
      const [servers, switches, connections] = await Promise.all([
        this.readFileFromRepo(`${fabricPath}/servers.yaml`),
        this.readFileFromRepo(`${fabricPath}/switches.yaml`), 
        this.readFileFromRepo(`${fabricPath}/connections.yaml`)
      ])

      if (!servers || !switches || !connections) {
        return null
      }

      const diagram = deserializeWiringDiagram({
        servers,
        switches, 
        connections
      })

      return diagram
    } catch (error) {
      console.warn(`Git read failed for fabric ${fabricId}:`, error.message)
      return null
    }
  }

  async writeFabric(fabricId, data) {
    if (!this.isEnabled() || !this.initialized) {
      return true
    }

    try {
      await this.ensureRepository()
      
      const fabricPath = `${this.baseDir}/${fabricId}`
      
      await this.fs.mkdir(fabricPath, { recursive: true })
      
      const yamls = serializeWiringDiagram(data)
      
      await Promise.all([
        this.writeFileToRepo(`${fabricPath}/servers.yaml`, yamls.servers),
        this.writeFileToRepo(`${fabricPath}/switches.yaml`, yamls.switches),
        this.writeFileToRepo(`${fabricPath}/connections.yaml`, yamls.connections)
      ])

      return true
    } catch (error) {
      console.warn(`Git write failed for fabric ${fabricId}:`, error.message)
      return false
    }
  }

  async commitChanges(message) {
    if (!this.isEnabled() || !this.initialized || !this.git) {
      return true
    }

    try {
      await this.ensureRepository()

      await this.git.add({
        fs: this.fs,
        dir: '.',
        filepath: this.baseDir
      })

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

  async initRepository() {
    if (!this.isEnabled() || !this.initialized || !this.git) {
      return true
    }

    try {
      try {
        await this.fs.stat('.git')
        return true
      } catch (e) {
        // Repository doesn't exist
      }

      await this.git.init({
        fs: this.fs,
        dir: '.'
      })

      try {
        await this.fs.stat('.gitignore')
      } catch (e) {
        const gitignore = `# HNC Generated Files\nnode_modules/\ndist/\n.DS_Store\n*.log\n`
        await this.writeFileToRepo('.gitignore', gitignore)
        await this.commitChanges('Initial commit: Initialize HNC repository')
      }

      return true
    } catch (error) {
      console.warn('Git repository initialization failed:', error.message)
      return false
    }
  }

  async getStatus() {
    const status = {
      enabled: this.isEnabled(),
      initialized: this.initialized,
      hasChanges: false
    }

    if (!this.isEnabled() || !this.initialized || !this.git) {
      return status
    }

    try {
      const statusMatrix = await this.git.statusMatrix({
        fs: this.fs,
        dir: '.'
      })

      status.hasChanges = statusMatrix.some(([, head, working, stage]) => 
        head !== working || head !== stage
      )

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

  async ensureRepository() {
    if (!this.initialized) {
      await this.initializeGit()
    }
    
    if (!this.initialized) {
      throw new Error('Git service not properly initialized')
    }

    try {
      await this.fs.stat('.git')
    } catch (e) {
      await this.initRepository()
    }
  }

  async readFileFromRepo(filepath) {
    try {
      const data = await this.fs.readFile(filepath, { encoding: 'utf8' })
      return data
    } catch (error) {
      return null
    }
  }

  async writeFileToRepo(filepath, content) {
    await this.fs.writeFile(filepath, content, { encoding: 'utf8' })
  }
}

// No-op implementation
class NoOpGitServiceJS {
  isEnabled() {
    return false
  }

  async readFabric(fabricId) {
    return null
  }

  async writeFabric(fabricId, data) {
    return true
  }

  async commitChanges(message) {
    return true
  }

  async initRepository() {
    return true
  }

  async getStatus() {
    return {
      enabled: false,
      initialized: false,
      hasChanges: false
    }
  }
}

// Export based on feature flag
export const gitService = isGitEnabled() ? new GitServiceJS() : new NoOpGitServiceJS()

export function generateCommitMessage(fabricId, diagram) {
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
