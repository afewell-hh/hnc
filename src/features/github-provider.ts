/**
 * GitHub Provider using isomorphic-git with token authentication
 * Implements throwaway branch strategy for CI integration testing
 * Never touches main branch, uses isolated hnc-ci/<runId> branches
 */

import { generateRunId } from '../utils/run-id.js'
import type { WiringDiagram } from '../app.types.js'
import { serializeWiringDiagram } from '../io/yaml.js'

// Dynamic imports for optional dependencies
type GitModule = typeof import('isomorphic-git')
type HttpModule = typeof import('isomorphic-git/http/node')

export interface GitHubConfig {
  token: string
  remote: string // e.g., 'https://github.com/owner/repo.git'
  baseBranch?: string // default: 'main'
}

export interface GitHubOperationResult {
  success: boolean
  branchName?: string
  commitSha?: string
  error?: string
}

export interface GitHubVerificationResult {
  success: boolean
  filesFound: string[]
  filesExpected: string[]
  error?: string
}

export class GitHubProvider {
  private git: GitModule | null = null
  private http: HttpModule | null = null
  private initialized = false
  
  constructor(private config: GitHubConfig) {}

  /**
   * Initialize GitHub provider with required dependencies
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    try {
      // Dynamic imports for Git operations
      const [gitModule, httpModule] = await Promise.all([
        import('isomorphic-git'),
        import('isomorphic-git/http/node')
      ])

      this.git = gitModule
      this.http = httpModule
      this.initialized = true
      return true
    } catch (error) {
      console.warn('Failed to initialize GitHub provider:', error)
      return false
    }
  }

  /**
   * Create a throwaway branch for CI testing
   * Pattern: hnc-ci/<runId>
   */
  async createThrowawayBranch(runId?: string): Promise<GitHubOperationResult> {
    if (!this.initialized || !this.git || !this.http) {
      return { success: false, error: 'Provider not initialized' }
    }

    const branchName = `hnc-ci/${runId || generateRunId()}`
    const baseBranch = this.config.baseBranch || 'main'

    try {
      // Clone the repository to a temporary directory
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tempDir = path.join(os.tmpdir(), `github-${Date.now()}`)
      await fs.promises.mkdir(tempDir, { recursive: true })

      // Clone repository
      await this.git.clone({
        fs,
        http: this.http,
        dir: tempDir,
        url: this.config.remote,
        ref: baseBranch,
        singleBranch: false,
        depth: 1,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Create and checkout new branch
      await this.git.branch({
        fs,
        dir: tempDir,
        ref: branchName
      })

      await this.git.checkout({
        fs,
        dir: tempDir,
        ref: branchName
      })

      return {
        success: true,
        branchName,
        // Store tempDir for subsequent operations
        // In a real implementation, you'd store this in the instance
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create branch: ${error.message}`
      }
    }
  }

  /**
   * Commit FGD files to a throwaway branch
   * Commits ./fgd/<fabric-id>/*.yaml files
   */
  async commitFGDFiles(
    fabricId: string, 
    diagram: WiringDiagram,
    branchName: string,
    message?: string
  ): Promise<GitHubOperationResult> {
    if (!this.initialized || !this.git || !this.http) {
      return { success: false, error: 'Provider not initialized' }
    }

    try {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      // Use the same temp directory pattern
      const tempDir = path.join(os.tmpdir(), `github-${Date.now()}`)
      
      // Re-clone for the operation (in production, you'd reuse the directory)
      await this.git.clone({
        fs,
        http: this.http,
        dir: tempDir,
        url: this.config.remote,
        ref: branchName,
        singleBranch: true,
        depth: 1,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Ensure FGD directory structure exists
      const fgdPath = path.join(tempDir, 'fgd', fabricId)
      await fs.promises.mkdir(fgdPath, { recursive: true })

      // Serialize and write YAML files
      const yamls = serializeWiringDiagram(diagram)
      
      await Promise.all([
        fs.promises.writeFile(
          path.join(fgdPath, 'servers.yaml'),
          yamls.servers,
          'utf8'
        ),
        fs.promises.writeFile(
          path.join(fgdPath, 'switches.yaml'),
          yamls.switches,
          'utf8'
        ),
        fs.promises.writeFile(
          path.join(fgdPath, 'connections.yaml'),
          yamls.connections,
          'utf8'
        )
      ])

      // Stage all files in the fgd directory
      await this.git.add({
        fs,
        dir: tempDir,
        filepath: `fgd/${fabricId}`
      })

      // Commit changes
      const commitMessage = message || this.generateCommitMessage(fabricId, diagram)
      
      const commitSha = await this.git.commit({
        fs,
        dir: tempDir,
        message: commitMessage,
        author: {
          name: 'HNC CI',
          email: 'hnc-ci@example.com'
        }
      })

      // Push the branch
      await this.git.push({
        fs,
        http: this.http,
        dir: tempDir,
        remote: 'origin',
        ref: branchName,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Cleanup temp directory
      await fs.promises.rm(tempDir, { recursive: true, force: true })

      return {
        success: true,
        branchName,
        commitSha
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to commit FGD files: ${error.message}`
      }
    }
  }

  /**
   * Fetch and verify contents of committed files
   */
  async verifyCommittedFiles(
    fabricId: string,
    branchName: string
  ): Promise<GitHubVerificationResult> {
    if (!this.initialized || !this.git || !this.http) {
      return { 
        success: false, 
        filesFound: [], 
        filesExpected: [],
        error: 'Provider not initialized' 
      }
    }

    const expectedFiles = [
      `fgd/${fabricId}/servers.yaml`,
      `fgd/${fabricId}/switches.yaml`,
      `fgd/${fabricId}/connections.yaml`
    ]

    try {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tempDir = path.join(os.tmpdir(), `verify-${Date.now()}`)
      
      // Clone the specific branch for verification
      await this.git.clone({
        fs,
        http: this.http,
        dir: tempDir,
        url: this.config.remote,
        ref: branchName,
        singleBranch: true,
        depth: 1,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Check which expected files exist
      const filesFound: string[] = []
      
      for (const expectedFile of expectedFiles) {
        const filePath = path.join(tempDir, expectedFile)
        try {
          await fs.promises.access(filePath)
          // Verify file has content
          const content = await fs.promises.readFile(filePath, 'utf8')
          if (content.trim().length > 0) {
            filesFound.push(expectedFile)
          }
        } catch (error) {
          // File doesn't exist or is empty
        }
      }

      // Cleanup
      await fs.promises.rm(tempDir, { recursive: true, force: true })

      const success = filesFound.length === expectedFiles.length
      
      return {
        success,
        filesFound,
        filesExpected: expectedFiles,
        error: success ? undefined : `Found ${filesFound.length}/${expectedFiles.length} expected files`
      }
    } catch (error) {
      return {
        success: false,
        filesFound: [],
        filesExpected: expectedFiles,
        error: `Verification failed: ${error.message}`
      }
    }
  }

  /**
   * Delete throwaway branch (cleanup)
   */
  async deleteThrowawayBranch(branchName: string): Promise<GitHubOperationResult> {
    if (!this.initialized || !this.git || !this.http) {
      return { success: false, error: 'Provider not initialized' }
    }

    try {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      const tempDir = path.join(os.tmpdir(), `cleanup-${Date.now()}`)
      
      // Clone repository
      await this.git.clone({
        fs,
        http: this.http,
        dir: tempDir,
        url: this.config.remote,
        singleBranch: false,
        depth: 1,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Delete remote branch
      await this.git.push({
        fs,
        http: this.http,
        dir: tempDir,
        remote: 'origin',
        ref: branchName,
        delete: true,
        onAuth: () => ({
          username: this.config.token,
          password: 'x-oauth-basic'
        })
      })

      // Cleanup
      await fs.promises.rm(tempDir, { recursive: true, force: true })

      return {
        success: true,
        branchName
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete branch: ${error.message}`
      }
    }
  }

  /**
   * Complete integration test workflow
   */
  async runIntegrationTest(fabricId: string, diagram: WiringDiagram): Promise<{
    success: boolean
    branchName?: string
    verification?: GitHubVerificationResult
    error?: string
  }> {
    const runId = generateRunId()
    
    try {
      // Step 1: Create throwaway branch
      const branchResult = await this.createThrowawayBranch(runId)
      if (!branchResult.success || !branchResult.branchName) {
        return { success: false, error: `Branch creation failed: ${branchResult.error}` }
      }

      // Step 2: Commit FGD files
      const commitResult = await this.commitFGDFiles(
        fabricId,
        diagram,
        branchResult.branchName,
        `CI Test: ${fabricId} - Run ${runId}`
      )
      if (!commitResult.success) {
        return { success: false, error: `Commit failed: ${commitResult.error}` }
      }

      // Step 3: Verify committed files
      const verification = await this.verifyCommittedFiles(fabricId, branchResult.branchName)
      
      // Step 4: Cleanup (delete throwaway branch)
      await this.deleteThrowawayBranch(branchResult.branchName)

      return {
        success: verification.success,
        branchName: branchResult.branchName,
        verification,
        error: verification.success ? undefined : verification.error
      }
    } catch (error) {
      return {
        success: false,
        error: `Integration test failed: ${error.message}`
      }
    }
  }

  /**
   * Generate commit message for FGD changes
   */
  private generateCommitMessage(fabricId: string, diagram: WiringDiagram): string {
    const serverCount = diagram.devices.servers.length
    const leafCount = diagram.devices.leaves.length
    const spineCount = diagram.devices.spines.length
    const switchCount = leafCount + spineCount
    
    const endpointCount = diagram.devices.servers.reduce((total, server) => {
      return total + (server.connections || 0)
    }, 0)

    return `CI: Save ${fabricId} FGD files

- ${leafCount} leaves, ${spineCount} spines computed
- ${endpointCount} endpoints allocated  
- ${serverCount} servers, ${switchCount} switches total
- Generated via HNC CI integration test

[skip ci]`
  }
}

/**
 * Factory function to create GitHub provider with environment-based config
 */
export function createGitHubProvider(): GitHubProvider | null {
  const token = process.env.GITHUB_TOKEN
  const remote = process.env.GIT_REMOTE
  
  if (!token || !remote) {
    return null
  }
  
  return new GitHubProvider({
    token,
    remote,
    baseBranch: process.env.GIT_BASE_BRANCH || 'main'
  })
}

/**
 * Check if GitHub integration is available
 */
export function isGitHubIntegrationAvailable(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GIT_REMOTE)
}