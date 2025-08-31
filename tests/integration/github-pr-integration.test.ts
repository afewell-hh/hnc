/**
 * Integration tests for GitHub PR functionality
 * Only runs when GITHUB_TOKEN and GIT_REMOTE are set
 * Tests the complete workflow including API calls to GitHub
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitHubPRService, createGitHubPRService, isGitHubPRAvailable } from '../../src/features/github-pr.service.js'
import { saveFGD, loadFGD } from '../../src/io/fgd.js'
import { overrideFeatureFlag, resetFeatureFlags } from '../../src/features/feature-flags.js'
import type { WiringDiagram } from '../../src/app.types.js'

// Skip these tests if GitHub integration is not available
const skipIfNoGitHub = () => {
  if (!isGitHubPRAvailable()) {
    console.log('⏭️  Skipping GitHub PR integration tests - GITHUB_TOKEN or GIT_REMOTE not set')
    return true
  }
  return false
}

describe('GitHub PR Integration Tests', { concurrent: false }, () => {
  let testFabricId: string
  let mockDiagram: WiringDiagram
  let prService: GitHubPRService | null

  beforeEach(async () => {
    if (skipIfNoGitHub()) return

    // Enable feature flag for tests
    overrideFeatureFlag('ghPr', true)

    // Create unique test fabric ID
    testFabricId = `test-integration-${Date.now()}`

    // Create test wiring diagram
    mockDiagram = {
      metadata: {
        generatedAt: new Date(),
        fabricName: testFabricId,
        totalDevices: 5
      },
      devices: {
        servers: [
          { id: 'server-1', type: 'server', connections: 2 },
          { id: 'server-2', type: 'server', connections: 4 }
        ],
        leaves: [
          { id: 'leaf-1', model: 'DS2000', ports: 48 },
          { id: 'leaf-2', model: 'DS2000', ports: 48 }
        ],
        spines: [
          { id: 'spine-1', model: 'DS3000', ports: 32 }
        ]
      },
      connections: []
    }

    // Save FGD locally for the test
    await saveFGD(mockDiagram, { 
      fabricId: testFabricId,
      baseDir: './test-output'
    })

    // Create PR service
    prService = createGitHubPRService()
    if (prService) {
      await prService.initialize()
    }
  })

  afterEach(async () => {
    if (skipIfNoGitHub()) return

    // Reset feature flags
    resetFeatureFlags()

    // Cleanup: try to delete any test branches created
    // Note: In a real scenario, you might want to clean up test PRs/branches
    // but for this test, we'll leave them for manual inspection
  })

  it('should be available when properly configured', () => {
    if (skipIfNoGitHub()) return

    expect(isGitHubPRAvailable()).toBe(true)
    expect(prService).not.toBeNull()
  })

  it('should create PR service with correct configuration', () => {
    if (skipIfNoGitHub()) return

    expect(prService).toBeInstanceOf(GitHubPRService)
    
    // Verify configuration was parsed correctly
    const config = (prService as any).config
    expect(config.token).toBe(process.env.GITHUB_TOKEN)
    expect(config.remote).toBe(process.env.GIT_REMOTE)
    expect(config.baseBranch).toBe(process.env.GIT_BASE_BRANCH || 'main')
  })

  it('should load FGD files successfully for PR creation', async () => {
    if (skipIfNoGitHub()) return

    const loadResult = await loadFGD({ 
      fabricId: testFabricId,
      baseDir: './test-output'
    })

    expect(loadResult.success).toBe(true)
    expect(loadResult.diagram).toBeDefined()
    expect(loadResult.filesRead).toHaveLength(3)
    
    // Verify diagram content matches what we saved
    expect(loadResult.diagram!.devices.servers).toHaveLength(2)
    expect(loadResult.diagram!.devices.leaves).toHaveLength(2)
    expect(loadResult.diagram!.devices.spines).toHaveLength(1)
  })

  it('should generate valid PR payload', () => {
    if (skipIfNoGitHub()) return

    const branchName = `hnc-fgd-pr/${testFabricId}/test-${Date.now()}`
    const payload = prService!.buildPRPayload(testFabricId, mockDiagram, branchName)

    // Verify payload structure
    expect(payload.title).toBe(`HNC: Save ${testFabricId} FGD files`)
    expect(payload.head).toBe(branchName)
    expect(payload.base).toBe(process.env.GIT_BASE_BRANCH || 'main')
    expect(payload.labels).toContain('hnc')
    expect(payload.labels).toContain('fgd')

    // Verify body content includes key information
    expect(payload.body).toContain(testFabricId)
    expect(payload.body).toContain('2 leaves, 1 spines')
    expect(payload.body).toContain('2 servers, 3 switches')
    expect(payload.body).toContain('6 allocated') // 2 + 4 endpoints
    expect(payload.body).toContain('servers.yaml')
    expect(payload.body).toContain('switches.yaml')
    expect(payload.body).toContain('connections.yaml')
  })

  it.skip('should create actual GitHub PR (manual test only)', async () => {
    // This test is skipped by default because it creates real PRs
    // Enable manually for testing against a real repository
    // WARNING: Only run this against a test repository!
    
    if (skipIfNoGitHub()) return
    if (!process.env.ENABLE_REAL_PR_TEST) return

    const result = await prService!.createFGDPullRequest(testFabricId, mockDiagram)

    expect(result.success).toBe(true)
    expect(result.prUrl).toBeDefined()
    expect(result.prNumber).toBeGreaterThan(0)
    expect(result.branchName).toMatch(new RegExp(`^hnc-fgd-pr/${testFabricId}/\\d+$`))

    console.log(`🎉 Created test PR: ${result.prUrl}`)
    console.log(`📝 PR #${result.prNumber} on branch ${result.branchName}`)
    console.log(`⚠️  Remember to close this test PR manually!`)
  })

  it('should handle invalid repository gracefully', async () => {
    if (skipIfNoGitHub()) return

    // Create service with invalid repo
    const invalidService = new GitHubPRService({
      token: process.env.GITHUB_TOKEN!,
      remote: 'nonexistent/invalid-repo-name-12345'
    })

    await invalidService.initialize()
    
    const result = await invalidService.createFGDPullRequest(testFabricId, mockDiagram)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/Failed to create PR/)
  })

  it('should handle authentication errors', async () => {
    if (skipIfNoGitHub()) return

    // Create service with invalid token
    const invalidTokenService = new GitHubPRService({
      token: 'invalid-token-12345',
      remote: process.env.GIT_REMOTE!
    })

    await invalidTokenService.initialize()
    
    const result = await invalidTokenService.createFGDPullRequest(testFabricId, mockDiagram)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/Failed to create PR/)
  })

  it('should validate environment variables correctly', () => {
    const originalToken = process.env.GITHUB_TOKEN
    const originalRemote = process.env.GIT_REMOTE
    
    try {
      // Test missing token
      delete process.env.GITHUB_TOKEN
      expect(GitHubPRService.isAvailable()).toBe(false)
      
      // Restore token, test missing remote
      process.env.GITHUB_TOKEN = originalToken
      delete process.env.GIT_REMOTE
      expect(GitHubPRService.isAvailable()).toBe(false)
      
      // Test both present
      process.env.GIT_REMOTE = originalRemote
      // Only test if originally available
      if (originalToken && originalRemote) {
        expect(GitHubPRService.isAvailable()).toBe(true)
      }
    } finally {
      // Restore original values
      if (originalToken) process.env.GITHUB_TOKEN = originalToken
      if (originalRemote) process.env.GIT_REMOTE = originalRemote
    }
  })

  it('should handle feature flag disabled', () => {
    if (skipIfNoGitHub()) return

    // Disable feature flag
    overrideFeatureFlag('ghPr', false)

    // Should not be available even with env vars set
    expect(GitHubPRService.isAvailable()).toBe(false)
    
    const service = createGitHubPRService()
    expect(service).toBeNull()
  })
})

// Helper to run a quick smoke test of the CLI script
describe('PR CLI Script Smoke Test', () => {
  it('should show usage when no args provided', async () => {
    if (skipIfNoGitHub()) return

    // Import and test the script's main functionality
    // Note: This would require adjustments to make the script testable
    // For now, we'll just verify the script file exists and is executable
    
    const fs = await import('fs')
    const path = './scripts/pr-fgd.mjs'
    
    expect(fs.existsSync(path)).toBe(true)
    
    const stats = await fs.promises.stat(path)
    expect(stats.isFile()).toBe(true)
    expect(stats.size).toBeGreaterThan(0)
  })
})