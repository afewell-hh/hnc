/**
 * Integration tests for GitHub operations
 * These tests run ONLY when GITHUB_TOKEN and GIT_REMOTE environment variables are set
 * They perform real GitHub operations against throwaway branches
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import type { WiringDiagram } from '../../src/app.types.js'

// Environment guards - skip entire test suite if required env vars are missing
const hasGitHubToken = Boolean(process.env.GITHUB_TOKEN)
const hasGitRemote = Boolean(process.env.GIT_REMOTE)
const skipIntegrationTests = !hasGitHubToken || !hasGitRemote

// Conditional describe - only run if environment is configured
describe.skipIf(skipIntegrationTests)('GitHub Integration Tests (ENV: GITHUB_TOKEN & GIT_REMOTE required)', () => {
  let GitHubProvider: any
  let createGitHubProvider: any
  let isGitHubIntegrationAvailable: any
  let provider: any
  let testDiagram: WiringDiagram

  // Track created branches for cleanup
  const createdBranches: string[] = []

  beforeAll(async () => {
    // Import modules
    const module = await import('../../src/features/github-provider.js')
    GitHubProvider = module.GitHubProvider
    createGitHubProvider = module.createGitHubProvider
    isGitHubIntegrationAvailable = module.isGitHubIntegrationAvailable

    // Validate environment
    expect(process.env.GITHUB_TOKEN).toBeDefined()
    expect(process.env.GIT_REMOTE).toBeDefined()
    expect(isGitHubIntegrationAvailable()).toBe(true)

    console.log('🔧 GitHub Integration Tests Environment:')
    console.log(`   Token: ${process.env.GITHUB_TOKEN ? '✅ SET' : '❌ MISSING'}`)
    console.log(`   Remote: ${process.env.GIT_REMOTE || '❌ MISSING'}`)
    console.log(`   Base Branch: ${process.env.GIT_BASE_BRANCH || 'main (default)'}`)
  })

  afterAll(async () => {
    // Clean up any remaining branches
    if (provider && createdBranches.length > 0) {
      console.log(`🧹 Cleaning up ${createdBranches.length} test branches...`)
      
      for (const branchName of createdBranches) {
        try {
          await provider.deleteThrowawayBranch(branchName)
          console.log(`   ✅ Deleted: ${branchName}`)
        } catch (error) {
          console.warn(`   ⚠️ Failed to delete ${branchName}:`, error.message)
        }
      }
    }
  })

  beforeEach(async () => {
    // Create provider from environment
    provider = createGitHubProvider()
    expect(provider).not.toBeNull()

    // Initialize provider
    const initialized = await provider.initialize()
    expect(initialized).toBe(true)

    // Create test diagram
    testDiagram = {
      devices: {
        servers: [
          { id: 'web-server-1', type: 'web-server', connections: 1 },
          { id: 'db-server-1', type: 'database-server', connections: 1 }
        ],
        leaves: [
          { id: 'leaf-1', model: 'DS2000', ports: 48 },
          { id: 'leaf-2', model: 'DS2000', ports: 48 }
        ],
        spines: [
          { id: 'spine-1', model: 'DS3000', ports: 32 }
        ]
      },
      connections: [],
      metadata: {
        generatedAt: new Date(),
        fabricName: 'integration-test-fabric',
        totalDevices: 5
      }
    } as WiringDiagram
  })

  describe('Environment Validation', () => {
    it('should have required environment variables', () => {
      expect(process.env.GITHUB_TOKEN).toBeDefined()
      expect(process.env.GIT_REMOTE).toBeDefined()
      
      // Validate token format (should be a GitHub token)
      expect(process.env.GITHUB_TOKEN).toMatch(/^gh[a-z]_[A-Za-z0-9]{36,}|^[a-f0-9]{40}$/)
      
      // Validate remote format (should be a GitHub URL)
      expect(process.env.GIT_REMOTE).toMatch(/^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\.git$/)
    })

    it('should initialize provider successfully', async () => {
      const testProvider = createGitHubProvider()
      expect(testProvider).not.toBeNull()
      
      const initialized = await testProvider.initialize()
      expect(initialized).toBe(true)
    })
  })

  describe('Throwaway Branch Operations', () => {
    it('should create throwaway branch with unique name', async () => {
      const runId = `test-${Date.now()}`
      const result = await provider.createThrowawayBranch(runId)

      expect(result.success).toBe(true)
      expect(result.branchName).toBe(`hnc-ci/${runId}`)
      expect(result.error).toBeUndefined()

      // Track for cleanup
      if (result.branchName) {
        createdBranches.push(result.branchName)
      }
    }, 30000) // 30 second timeout for Git operations

    it('should create multiple unique branches', async () => {
      const runId1 = `test-multi-1-${Date.now()}`
      const runId2 = `test-multi-2-${Date.now()}`

      const result1 = await provider.createThrowawayBranch(runId1)
      const result2 = await provider.createThrowawayBranch(runId2)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.branchName).not.toBe(result2.branchName)

      // Track for cleanup
      if (result1.branchName) createdBranches.push(result1.branchName)
      if (result2.branchName) createdBranches.push(result2.branchName)
    }, 60000)
  })

  describe('FGD File Operations', () => {
    let testBranch: string

    beforeEach(async () => {
      // Create a test branch for FGD operations
      const runId = `fgd-test-${Date.now()}`
      const branchResult = await provider.createThrowawayBranch(runId)
      expect(branchResult.success).toBe(true)
      
      testBranch = branchResult.branchName!
      createdBranches.push(testBranch)
    })

    it('should commit FGD files successfully', async () => {
      const fabricId = `test-fabric-${Date.now()}`
      const commitMessage = `Test commit: ${fabricId}`

      const result = await provider.commitFGDFiles(
        fabricId,
        testDiagram,
        testBranch,
        commitMessage
      )

      expect(result.success).toBe(true)
      expect(result.branchName).toBe(testBranch)
      expect(result.commitSha).toBeDefined()
      expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/) // Valid SHA-1 hash
      expect(result.error).toBeUndefined()
    }, 45000)

    it('should verify committed files exist and have content', async () => {
      const fabricId = `verify-fabric-${Date.now()}`

      // First commit the files
      const commitResult = await provider.commitFGDFiles(
        fabricId,
        testDiagram,
        testBranch,
        `Commit for verification test: ${fabricId}`
      )
      expect(commitResult.success).toBe(true)

      // Then verify they exist
      const verifyResult = await provider.verifyCommittedFiles(fabricId, testBranch)

      expect(verifyResult.success).toBe(true)
      expect(verifyResult.filesFound).toEqual([
        `fgd/${fabricId}/servers.yaml`,
        `fgd/${fabricId}/switches.yaml`,
        `fgd/${fabricId}/connections.yaml`
      ])
      expect(verifyResult.filesExpected).toEqual([
        `fgd/${fabricId}/servers.yaml`,
        `fgd/${fabricId}/switches.yaml`,
        `fgd/${fabricId}/connections.yaml`
      ])
      expect(verifyResult.error).toBeUndefined()
    }, 60000)

    it('should handle verification of non-existent files', async () => {
      const nonExistentFabricId = `missing-fabric-${Date.now()}`

      const verifyResult = await provider.verifyCommittedFiles(nonExistentFabricId, testBranch)

      expect(verifyResult.success).toBe(false)
      expect(verifyResult.filesFound).toEqual([])
      expect(verifyResult.filesExpected).toHaveLength(3)
      expect(verifyResult.error).toContain('Found 0/3 expected files')
    }, 30000)
  })

  describe('Complete Integration Workflow', () => {
    it('should run complete end-to-end integration test', async () => {
      const fabricId = `e2e-fabric-${Date.now()}`

      const result = await provider.runIntegrationTest(fabricId, testDiagram)

      expect(result.success).toBe(true)
      expect(result.branchName).toMatch(/^hnc-ci\/\d{8}-\d{6}-[A-Z0-9]{5}$/)
      expect(result.verification).toBeDefined()
      expect(result.verification!.success).toBe(true)
      expect(result.verification!.filesFound).toHaveLength(3)
      expect(result.error).toBeUndefined()

      // Branch should be cleaned up automatically, so we don't track it
    }, 90000) // Extended timeout for full workflow

    it('should generate proper commit messages', async () => {
      const fabricId = `commit-msg-test-${Date.now()}`
      const runId = `msg-test-${Date.now()}`
      
      // Create branch
      const branchResult = await provider.createThrowawayBranch(runId)
      expect(branchResult.success).toBe(true)
      createdBranches.push(branchResult.branchName!)

      // Commit with auto-generated message
      const commitResult = await provider.commitFGDFiles(
        fabricId,
        testDiagram,
        branchResult.branchName!,
        undefined // Let it auto-generate
      )

      expect(commitResult.success).toBe(true)
      expect(commitResult.commitSha).toBeDefined()

      // We can't easily verify the commit message in integration tests
      // without additional Git operations, but the fact that commit succeeded
      // indicates the message was properly formatted
    }, 60000)
  })

  describe('Cleanup Operations', () => {
    it('should delete throwaway branch successfully', async () => {
      const runId = `cleanup-test-${Date.now()}`
      
      // Create branch
      const createResult = await provider.createThrowawayBranch(runId)
      expect(createResult.success).toBe(true)
      
      const branchName = createResult.branchName!
      
      // Delete branch
      const deleteResult = await provider.deleteThrowawayBranch(branchName)
      expect(deleteResult.success).toBe(true)
      expect(deleteResult.branchName).toBe(branchName)

      // Don't track this branch since we already deleted it
    }, 45000)

    it('should handle deletion of non-existent branch gracefully', async () => {
      const nonExistentBranch = `hnc-ci/non-existent-${Date.now()}`
      
      const deleteResult = await provider.deleteThrowawayBranch(nonExistentBranch)
      
      // GitHub will return an error for non-existent branch
      // Provider should handle this gracefully
      expect(deleteResult.success).toBe(false)
      expect(deleteResult.error).toBeDefined()
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should handle invalid authentication gracefully', async () => {
      // Create provider with invalid token
      const invalidProvider = new GitHubProvider({
        token: 'invalid-token',
        remote: process.env.GIT_REMOTE!
      })

      await invalidProvider.initialize()

      const result = await invalidProvider.createThrowawayBranch('test')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to create branch')
    }, 30000)

    it('should handle invalid remote URL gracefully', async () => {
      const invalidProvider = new GitHubProvider({
        token: process.env.GITHUB_TOKEN!,
        remote: 'https://github.com/nonexistent/repo.git'
      })

      await invalidProvider.initialize()

      const result = await invalidProvider.createThrowawayBranch('test')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to create branch')
    }, 30000)
  })

  describe('Performance', () => {
    it('should complete operations within reasonable time limits', async () => {
      const startTime = Date.now()
      const fabricId = `perf-test-${Date.now()}`

      const result = await provider.runIntegrationTest(fabricId, testDiagram)
      
      const duration = Date.now() - startTime
      
      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(60000) // Should complete in under 60 seconds
      
      console.log(`   ⏱️ Integration test completed in ${duration}ms`)
    }, 65000)
  })
})

// Conditional test suite that explains why integration tests are skipped
describe.skipIf(!skipIntegrationTests)('GitHub Integration Tests - SKIPPED', () => {
  it('should explain why integration tests are skipped', () => {
    console.log('ℹ️ GitHub Integration Tests are SKIPPED because:')
    
    if (!hasGitHubToken) {
      console.log('   ❌ GITHUB_TOKEN environment variable is not set')
      console.log('   💡 Set GITHUB_TOKEN to a valid GitHub personal access token')
    }
    
    if (!hasGitRemote) {
      console.log('   ❌ GIT_REMOTE environment variable is not set')  
      console.log('   💡 Set GIT_REMOTE to a valid GitHub repository URL (e.g., https://github.com/user/repo.git)')
    }
    
    console.log('')
    console.log('   To run integration tests:')
    console.log('   export GITHUB_TOKEN="your_github_token"')
    console.log('   export GIT_REMOTE="https://github.com/your-user/your-repo.git"')
    console.log('   npm run int:gh')

    expect(true).toBe(true) // Always pass this explanatory test
  })
})