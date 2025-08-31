/**
 * Unit tests for GitHub PR service
 * Tests PR payload builder and service initialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitHubPRService, createGitHubPRService, isGitHubPRAvailable } from '../../src/features/github-pr.service.js'
import type { WiringDiagram } from '../../src/app.types.js'

// Mock feature flags
vi.mock('../../src/features/feature-flags.js', () => ({
  isGhPrEnabled: vi.fn(() => true)
}))

describe('GitHubPRService', () => {
  let mockDiagram: WiringDiagram

  beforeEach(() => {
    // Create mock wiring diagram
    mockDiagram = {
      metadata: {
        generatedAt: new Date(),
        fabricName: 'test-fabric',
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
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.GITHUB_TOKEN
    delete process.env.GIT_REMOTE
    delete process.env.FEATURE_GH_PR
  })

  describe('constructor and initialization', () => {
    it('should parse GitHub HTTPS remote correctly', () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'https://github.com/owner/repo.git'
      })

      // Access private properties for testing
      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should parse GitHub SSH remote correctly', () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'git@github.com:owner/repo.git'
      })

      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should parse simple owner/repo format correctly', () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'owner/repo'
      })

      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should throw error for invalid remote format', () => {
      expect(() => new GitHubPRService({
        token: 'test-token',
        remote: 'invalid-remote'
      })).toThrow('Invalid GitHub remote format')
    })

    it('should initialize successfully with valid token', async () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'owner/repo'
      })

      const result = await service.initialize()
      expect(result).toBe(true)
      expect((service as any).octokit).toBeDefined()
    })
  })

  describe('buildPRPayload', () => {
    let service: GitHubPRService

    beforeEach(() => {
      service = new GitHubPRService({
        token: 'test-token',
        remote: 'owner/repo'
      })
    })

    it('should build correct PR payload with all metadata', () => {
      const branchName = 'hnc-fgd-pr/test-fabric/1234567890'
      const payload = service.buildPRPayload('test-fabric', mockDiagram, branchName, 'main')

      expect(payload.title).toBe('HNC: Save test-fabric FGD files')
      expect(payload.head).toBe(branchName)
      expect(payload.base).toBe('main')
      expect(payload.labels).toEqual(['hnc', 'fgd'])

      // Check body content
      expect(payload.body).toContain('test-fabric')
      expect(payload.body).toContain('2 leaves, 1 spines')
      expect(payload.body).toContain('6 allocated') // 2 + 4 connections
      expect(payload.body).toContain('2 servers, 3 switches')
      expect(payload.body).toContain('fgd/test-fabric/servers.yaml')
      expect(payload.body).toContain('fgd/test-fabric/switches.yaml')
      expect(payload.body).toContain('fgd/test-fabric/connections.yaml')
      expect(payload.body).toContain('3 YAML files')
    })

    it('should handle empty diagram correctly', () => {
      const emptyDiagram: WiringDiagram = {
        metadata: { generatedAt: new Date(), fabricName: 'empty', totalDevices: 0 },
        devices: { servers: [], leaves: [], spines: [] },
        connections: []
      }

      const payload = service.buildPRPayload('empty', emptyDiagram, 'test-branch', 'main')

      expect(payload.body).toContain('0 leaves, 0 spines')
      expect(payload.body).toContain('0 allocated')
      expect(payload.body).toContain('0 servers, 0 switches')
    })

    it('should use correct branch name format', () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'owner/repo'
      })

      // Test private method through reflection
      const branchName = (service as any).createBranchName('my-fabric')
      
      expect(branchName).toMatch(/^hnc-fgd-pr\/my-fabric\/\d+$/)
      
      // Verify timestamp is recent (within last minute)
      const timestamp = parseInt(branchName.split('/')[2])
      const now = Date.now()
      expect(timestamp).toBeGreaterThan(now - 60000)
      expect(timestamp).toBeLessThanOrEqual(now)
    })

    it('should calculate line counts correctly for YAML files', () => {
      // Create a larger diagram to test line counting
      const largeDiagram: WiringDiagram = {
        metadata: { generatedAt: new Date(), fabricName: 'large', totalDevices: 16 },
        devices: {
          servers: Array.from({ length: 10 }, (_, i) => ({
            id: `server-${i}`,
            type: 'server',
            connections: 2
          })),
          leaves: Array.from({ length: 4 }, (_, i) => ({
            id: `leaf-${i}`,
            model: 'DS2000',
            ports: 48
          })),
          spines: Array.from({ length: 2 }, (_, i) => ({
            id: `spine-${i}`,
            model: 'DS3000',
            ports: 32
          }))
        },
        connections: []
      }

      const payload = service.buildPRPayload('large', largeDiagram, 'test-branch', 'main')
      
      // Should contain line count information
      expect(payload.body).toMatch(/servers\.yaml.*\(\d+ lines\)/)
      expect(payload.body).toMatch(/switches\.yaml.*\(\d+ lines\)/)
      expect(payload.body).toMatch(/connections\.yaml.*\(\d+ lines\)/)
      expect(payload.body).toMatch(/Total.*\d+ lines across 3 YAML files/)
    })
  })

  describe('static methods', () => {
    it('should check availability correctly when all env vars present', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'owner/repo'
      process.env.FEATURE_GH_PR = 'true'

      // Import dynamically to get fresh module
      const { GitHubPRService, isGitHubPRAvailable } = await import('../../src/features/github-pr.service.js')
      expect(GitHubPRService.isAvailable()).toBe(true)
      expect(isGitHubPRAvailable()).toBe(true)
    })

    it('should return false when GitHub token missing', async () => {
      process.env.GIT_REMOTE = 'owner/repo'
      process.env.FEATURE_GH_PR = 'true'
      delete process.env.GITHUB_TOKEN

      const { GitHubPRService } = await import('../../src/features/github-pr.service.js')
      expect(GitHubPRService.isAvailable()).toBe(false)
    })

    it('should return false when git remote missing', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.FEATURE_GH_PR = 'true'
      delete process.env.GIT_REMOTE

      const { GitHubPRService } = await import('../../src/features/github-pr.service.js')
      expect(GitHubPRService.isAvailable()).toBe(false)
    })
  })

  describe('createGitHubPRService factory', () => {
    it('should create service when available', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'owner/repo'
      process.env.FEATURE_GH_PR = 'true'

      const { createGitHubPRService, GitHubPRService } = await import('../../src/features/github-pr.service.js')
      const service = createGitHubPRService()
      expect(service).toBeInstanceOf(GitHubPRService)
    })

    it('should return null when not available', async () => {
      delete process.env.GITHUB_TOKEN
      delete process.env.GIT_REMOTE

      const { createGitHubPRService } = await import('../../src/features/github-pr.service.js')
      const service = createGitHubPRService()
      expect(service).toBeNull()
    })

    it('should use custom base branch from environment', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'owner/repo'
      process.env.GIT_BASE_BRANCH = 'develop'
      process.env.FEATURE_GH_PR = 'true'

      const { createGitHubPRService } = await import('../../src/features/github-pr.service.js')
      const service = createGitHubPRService()!
      expect((service as any).config.baseBranch).toBe('develop')
    })

    it('should default to main branch when not specified', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'owner/repo'
      process.env.FEATURE_GH_PR = 'true'
      delete process.env.GIT_BASE_BRANCH

      const { createGitHubPRService } = await import('../../src/features/github-pr.service.js')
      const service = createGitHubPRService()!
      expect((service as any).config.baseBranch).toBe('main')
    })
  })

  describe('error handling', () => {
    it('should return error when service not initialized', async () => {
      const service = new GitHubPRService({
        token: 'test-token',
        remote: 'owner/repo'
      })

      // Don't initialize the service
      const result = await service.createFGDPullRequest('test-fabric', mockDiagram)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Service not initialized')
    })
  })
})