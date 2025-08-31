/**
 * Unit tests for GitHubHistoryService
 * Tests the service that fetches FGD-related commits and PRs from GitHub
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitHubHistoryService, createGitHubHistoryService, isGitHubHistoryAvailable } from '../../src/features/github-history.service'
import type { HistoryFetchOptions } from '../../src/features/github-history.service'

// Mock Octokit
const mockOctokit = {
  repos: {
    listCommits: vi.fn(),
    getCommit: vi.fn()
  },
  pulls: {
    list: vi.fn(),
    listFiles: vi.fn()
  }
}

// Mock the Octokit import
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => mockOctokit)
}))

// Mock feature flags
vi.mock('../../src/features/feature-flags', () => ({
  isGhPrEnabled: vi.fn(() => true)
}))

describe('GitHubHistoryService', () => {
  let service: GitHubHistoryService

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables for tests
    process.env.GITHUB_TOKEN = 'mock-token'
    process.env.GIT_REMOTE = 'https://github.com/test/repo.git'
    process.env.GIT_BASE_BRANCH = 'main'

    service = new GitHubHistoryService({
      token: 'mock-token',
      remote: 'https://github.com/test/repo.git',
      baseBranch: 'main'
    })
  })

  afterEach(() => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GIT_REMOTE
    delete process.env.GIT_BASE_BRANCH
  })

  describe('constructor and remote parsing', () => {
    it('should parse HTTPS GitHub remote correctly', () => {
      const service = new GitHubHistoryService({
        token: 'token',
        remote: 'https://github.com/owner/repo.git'
      })
      
      // Access private properties for testing
      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should parse SSH GitHub remote correctly', () => {
      const service = new GitHubHistoryService({
        token: 'token',
        remote: 'git@github.com:owner/repo.git'
      })
      
      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should parse simple owner/repo format', () => {
      const service = new GitHubHistoryService({
        token: 'token',
        remote: 'owner/repo'
      })
      
      expect((service as any).owner).toBe('owner')
      expect((service as any).repo).toBe('repo')
    })

    it('should throw error for invalid remote format', () => {
      expect(() => {
        new GitHubHistoryService({
          token: 'token',
          remote: 'invalid-remote'
        })
      }).toThrow('Invalid GitHub remote format')
    })
  })

  describe('initialization', () => {
    it('should initialize successfully when feature flag is enabled', async () => {
      const result = await service.initialize()
      expect(result).toBe(true)
      expect((service as any).octokit).toBeTruthy()
    })

    it('should fail to initialize when feature flag is disabled', async () => {
      const { isGhPrEnabled } = await import('../../src/features/feature-flags')
      vi.mocked(isGhPrEnabled).mockReturnValue(false)
      
      const result = await service.initialize()
      expect(result).toBe(false)
    })
  })

  describe('fetchHistory', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should return error when service not initialized', async () => {
      const uninitializedService = new GitHubHistoryService({
        token: 'token',
        remote: 'owner/repo'
      })
      
      const result = await uninitializedService.fetchHistory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Service not initialized')
    })

    it('should fetch commits and PRs by default', async () => {
      // Mock commits response
      mockOctokit.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              message: 'Add FGD files for test-fabric',
              author: {
                name: 'Test Author',
                email: 'test@example.com',
                date: '2024-01-15T10:00:00Z'
              }
            },
            author: {
              avatar_url: 'https://github.com/test.png'
            },
            html_url: 'https://github.com/test/repo/commit/abc123'
          }
        ]
      })

      // Mock commit details response
      mockOctokit.repos.getCommit.mockResolvedValue({
        data: {
          files: [
            { filename: 'fgd/test-fabric/servers.yaml' },
            { filename: 'fgd/test-fabric/switches.yaml' }
          ]
        }
      })

      // Mock PRs response
      mockOctokit.pulls.list.mockResolvedValue({
        data: [
          {
            number: 42,
            title: 'HNC: Save test-fabric FGD files',
            state: 'open',
            user: {
              login: 'test-user',
              avatar_url: 'https://github.com/test-user.png'
            },
            created_at: '2024-01-15T09:00:00Z',
            updated_at: '2024-01-15T09:30:00Z',
            merged_at: null,
            html_url: 'https://github.com/test/repo/pull/42',
            labels: [{ name: 'hnc' }, { name: 'fgd' }],
            head: { ref: 'hnc-fgd-pr/test-fabric/123456' }
          }
        ]
      })

      // Mock PR files response
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: 'fgd/test-fabric/servers.yaml' }
        ]
      })

      const result = await service.fetchHistory()
      
      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(2) // 1 commit + 1 PR
      
      // Check commit entry
      const commitEntry = result.entries.find(e => e.type === 'commit')
      expect(commitEntry).toBeDefined()
      expect(commitEntry?.type).toBe('commit')
      if (commitEntry?.type === 'commit') {
        expect(commitEntry.sha).toBe('abc123')
        expect(commitEntry.message).toBe('Add FGD files for test-fabric')
        expect(commitEntry.author.name).toBe('Test Author')
        expect(commitEntry.isFGDRelated).toBe(true)
      }
      
      // Check PR entry
      const prEntry = result.entries.find(e => e.type === 'pr')
      expect(prEntry).toBeDefined()
      expect(prEntry?.type).toBe('pr')
      if (prEntry?.type === 'pr') {
        expect(prEntry.number).toBe(42)
        expect(prEntry.title).toBe('HNC: Save test-fabric FGD files')
        expect(prEntry.state).toBe('open')
        expect(prEntry.isFGDRelated).toBe(true)
      }
    })

    it('should filter by FGD-related content when fgdOnly=true', async () => {
      // Mock commits with both FGD and non-FGD content
      mockOctokit.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'fgd123',
            commit: {
              message: 'Add FGD files for production',
              author: { name: 'Test', email: 'test@example.com', date: '2024-01-15T10:00:00Z' }
            },
            html_url: 'https://github.com/test/repo/commit/fgd123'
          },
          {
            sha: 'other123',
            commit: {
              message: 'Update documentation',
              author: { name: 'Test', email: 'test@example.com', date: '2024-01-15T09:00:00Z' }
            },
            html_url: 'https://github.com/test/repo/commit/other123'
          }
        ]
      })

      mockOctokit.repos.getCommit.mockResolvedValue({
        data: { files: [] }
      })

      mockOctokit.pulls.list.mockResolvedValue({ data: [] })

      const result = await service.fetchHistory({ fgdOnly: true })
      
      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].type).toBe('commit')
      if (result.entries[0].type === 'commit') {
        expect(result.entries[0].sha).toBe('fgd123')
      }
    })

    it('should respect limit parameter', async () => {
      // Mock multiple commits
      mockOctokit.repos.listCommits.mockResolvedValue({
        data: Array.from({ length: 50 }, (_, i) => ({
          sha: `commit${i}`,
          commit: {
            message: `FGD commit ${i}`,
            author: { name: 'Test', email: 'test@example.com', date: '2024-01-15T10:00:00Z' }
          },
          html_url: `https://github.com/test/repo/commit/commit${i}`
        }))
      })

      mockOctokit.repos.getCommit.mockResolvedValue({
        data: { files: [] }
      })

      mockOctokit.pulls.list.mockResolvedValue({ data: [] })

      const result = await service.fetchHistory({ limit: 5 })
      
      expect(result.success).toBe(true)
      expect(result.entries.length).toBeLessThanOrEqual(5)
      expect(result.hasMore).toBe(true)
    })

    it('should handle API errors gracefully', async () => {
      mockOctokit.repos.listCommits.mockRejectedValue(new Error('API rate limit exceeded'))
      
      const result = await service.fetchHistory()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('API rate limit exceeded')
      expect(result.entries).toEqual([])
    })
  })

  describe('FGD detection logic', () => {
    it('should detect FGD-related commit messages', () => {
      const fgdMessages = [
        'Add FGD files for production',
        'Update fabric topology',
        'CI: Save test-fabric FGD files',
        'HNC: fabric configuration update',
        'wiring diagram changes',
        'servers.yaml updated'
      ]

      fgdMessages.forEach(message => {
        const isRelated = (service as any).isCommitFGDRelated(message)
        expect(isRelated).toBe(true)
      })
    })

    it('should not detect non-FGD commit messages', () => {
      const nonFgdMessages = [
        'Update README.md',
        'Fix typo in documentation',
        'Add new feature to UI',
        'Refactor utility functions'
      ]

      nonFgdMessages.forEach(message => {
        const isRelated = (service as any).isCommitFGDRelated(message)
        expect(isRelated).toBe(false)
      })
    })

    it('should detect FGD-related PRs', () => {
      const fgdPR = {
        title: 'Add FGD files for new fabric',
        labels: [{ name: 'hnc' }, { name: 'enhancement' }],
        head: { ref: 'feature-branch' }
      }

      const isRelated = (service as any).isPRFGDRelated(fgdPR)
      expect(isRelated).toBe(true)
    })

    it('should detect FGD-related PRs by branch name', () => {
      const fgdPR = {
        title: 'Update configuration',
        labels: [],
        head: { ref: 'hnc-fgd-pr/test-fabric/123' }
      }

      const isRelated = (service as any).isPRFGDRelated(fgdPR)
      expect(isRelated).toBe(true)
    })
  })

  describe('static methods', () => {
    it('should check availability correctly', () => {
      process.env.GITHUB_TOKEN = 'token'
      process.env.GIT_REMOTE = 'owner/repo'
      
      const available = GitHubHistoryService.isAvailable()
      expect(available).toBe(true)
    })

    it('should return false when environment variables missing', () => {
      delete process.env.GITHUB_TOKEN
      
      const available = GitHubHistoryService.isAvailable()
      expect(available).toBe(false)
    })
  })

  describe('factory functions', () => {
    it('should create service instance when available', () => {
      process.env.GITHUB_TOKEN = 'token'
      process.env.GIT_REMOTE = 'owner/repo'
      
      const service = createGitHubHistoryService()
      expect(service).toBeInstanceOf(GitHubHistoryService)
    })

    it('should return null when not available', () => {
      delete process.env.GITHUB_TOKEN
      
      const service = createGitHubHistoryService()
      expect(service).toBeNull()
    })

    it('should check availability', () => {
      process.env.GITHUB_TOKEN = 'token'
      process.env.GIT_REMOTE = 'owner/repo'
      
      const available = isGitHubHistoryAvailable()
      expect(available).toBe(true)
      
      delete process.env.GITHUB_TOKEN
      
      const unavailable = isGitHubHistoryAvailable()
      expect(unavailable).toBe(false)
    })
  })
})