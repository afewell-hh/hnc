/**
 * Unit tests for GitHubProvider with comprehensive mocking
 * Tests all scenarios: initialization, branch operations, commit/verify cycle
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import type { WiringDiagram } from '../../src/app.types.js'

// Mock isomorphic-git completely
const mockGit = {
  clone: vi.fn(),
  branch: vi.fn(),
  checkout: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  default: vi.fn()
}

vi.mock('isomorphic-git', () => mockGit)

// Mock isomorphic-git/http/node
const mockHttp = {
  default: vi.fn()
}

vi.mock('isomorphic-git/http/node', () => mockHttp)

// Mock Node.js built-ins
const mockFs = {
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    rm: vi.fn()
  }
}

const mockPath = {
  join: vi.fn((...parts) => parts.join('/')),
}

const mockOs = {
  tmpdir: vi.fn(() => '/tmp')
}

vi.mock('fs', () => mockFs)
vi.mock('path', () => mockPath)
vi.mock('os', () => mockOs)

// Mock yaml serialization
vi.mock('../../src/io/yaml.js', () => ({
  serializeWiringDiagram: vi.fn(() => ({
    servers: 'servers:\n  - id: server-1',
    switches: 'switches:\n  - id: leaf-1', 
    connections: 'connections: []'
  }))
}))

// Mock run-id utility
vi.mock('../../src/utils/run-id.js', () => ({
  generateRunId: vi.fn(() => '20240831-143022-ABCD1')
}))

describe('GitHubProvider', () => {
  let mockDiagram: WiringDiagram
  let GitHubProvider: any
  let createGitHubProvider: any
  let isGitHubIntegrationAvailable: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Setup mock diagram
    mockDiagram = {
      devices: {
        servers: [
          { id: 'server-1', type: 'web-server', connections: 2 }
        ],
        leaves: [
          { id: 'leaf-1', model: 'DS2000', ports: 48 }
        ],
        spines: [
          { id: 'spine-1', model: 'DS3000', ports: 32 }
        ]
      },
      connections: [],
      metadata: {
        generatedAt: new Date(),
        fabricName: 'test-fabric',
        totalDevices: 3
      }
    } as WiringDiagram

    // Setup successful mock responses
    mockGit.clone.mockResolvedValue(undefined)
    mockGit.branch.mockResolvedValue(undefined)
    mockGit.checkout.mockResolvedValue(undefined)
    mockGit.add.mockResolvedValue(undefined)
    mockGit.commit.mockResolvedValue('abc123')
    mockGit.push.mockResolvedValue(undefined)
    
    mockFs.promises.mkdir.mockResolvedValue(undefined)
    mockFs.promises.writeFile.mockResolvedValue(undefined)
    mockFs.promises.readFile.mockResolvedValue('test content')
    mockFs.promises.access.mockResolvedValue(undefined)
    mockFs.promises.rm.mockResolvedValue(undefined)

    // Reset module registry to ensure fresh imports
    vi.resetModules()
    
    // Import the module after mocks are set up
    const module = await import('../../src/features/github-provider.js')
    GitHubProvider = module.GitHubProvider
    createGitHubProvider = module.createGitHubProvider
    isGitHubIntegrationAvailable = module.isGitHubIntegrationAvailable
  })

  afterEach(() => {
    vi.resetModules()
    // Clear environment variables
    delete process.env.GITHUB_TOKEN
    delete process.env.GIT_REMOTE
    delete process.env.GIT_BASE_BRANCH
  })

  describe('GitHubProvider Class', () => {
    it('should initialize successfully with Git modules', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const result = await provider.initialize()
      expect(result).toBe(true)
    })

    it('should handle initialization failure gracefully', async () => {
      // Make dynamic import fail
      vi.doMock('isomorphic-git', () => {
        throw new Error('Module not found')
      })

      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const result = await provider.initialize()
      expect(result).toBe(false)
    })

    it('should create throwaway branch with correct pattern', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.createThrowawayBranch('custom-run-123')

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('hnc-ci/custom-run-123')
      
      expect(mockGit.clone).toHaveBeenCalledWith({
        fs: expect.any(Object),
        http: expect.any(Object),
        dir: expect.stringContaining('/tmp/github-'),
        url: 'https://github.com/test/repo.git',
        ref: 'main',
        singleBranch: false,
        depth: 1,
        onAuth: expect.any(Function)
      })

      expect(mockGit.branch).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: expect.stringContaining('/tmp/github-'),
        ref: 'hnc-ci/custom-run-123'
      })

      expect(mockGit.checkout).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: expect.stringContaining('/tmp/github-'),
        ref: 'hnc-ci/custom-run-123'
      })
    })

    it('should commit FGD files with proper structure', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.commitFGDFiles(
        'fabric-001',
        mockDiagram,
        'hnc-ci/test-branch',
        'Test commit message'
      )

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('hnc-ci/test-branch')
      expect(result.commitSha).toBe('abc123')

      // Verify FGD directory creation
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/fgd/fabric-001'),
        { recursive: true }
      )

      // Verify YAML files written
      expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(3)
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/fgd/fabric-001/servers.yaml'),
        expect.stringContaining('servers:'),
        'utf8'
      )
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/fgd/fabric-001/switches.yaml'),
        expect.stringContaining('switches:'),
        'utf8'
      )
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/fgd/fabric-001/connections.yaml'),
        expect.stringContaining('connections:'),
        'utf8'
      )

      // Verify Git operations
      expect(mockGit.add).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: expect.any(String),
        filepath: 'fgd/fabric-001'
      })

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: expect.any(String),
        message: 'Test commit message',
        author: {
          name: 'HNC CI',
          email: 'hnc-ci@example.com'
        }
      })

      expect(mockGit.push).toHaveBeenCalledWith({
        fs: expect.any(Object),
        http: expect.any(Object),
        dir: expect.any(String),
        remote: 'origin',
        ref: 'hnc-ci/test-branch',
        onAuth: expect.any(Function)
      })
    })

    it('should verify committed files successfully', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.verifyCommittedFiles('fabric-001', 'hnc-ci/test-branch')

      expect(result.success).toBe(true)
      expect(result.filesFound).toEqual([
        'fgd/fabric-001/servers.yaml',
        'fgd/fabric-001/switches.yaml',
        'fgd/fabric-001/connections.yaml'
      ])
      expect(result.filesExpected).toEqual([
        'fgd/fabric-001/servers.yaml',
        'fgd/fabric-001/switches.yaml',
        'fgd/fabric-001/connections.yaml'
      ])

      // Verify files were checked for existence and content
      expect(mockFs.promises.access).toHaveBeenCalledTimes(3)
      expect(mockFs.promises.readFile).toHaveBeenCalledTimes(3)
    })

    it('should handle missing files in verification', async () => {
      // Make some files not accessible
      mockFs.promises.access
        .mockResolvedValueOnce(undefined) // servers.yaml exists
        .mockRejectedValueOnce(new Error('ENOENT')) // switches.yaml missing
        .mockResolvedValueOnce(undefined) // connections.yaml exists
      
      // Mock readFile for the accessible files
      mockFs.promises.readFile
        .mockResolvedValueOnce('server content') // servers.yaml
        .mockResolvedValueOnce('connection content') // connections.yaml

      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.verifyCommittedFiles('fabric-001', 'hnc-ci/test-branch')

      expect(result.success).toBe(false)
      expect(result.filesFound).toEqual([
        'fgd/fabric-001/servers.yaml',
        'fgd/fabric-001/connections.yaml'
      ])
      expect(result.error).toContain('Found 2/3 expected files')
    })

    it('should delete throwaway branch successfully', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.deleteThrowawayBranch('hnc-ci/test-branch')

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('hnc-ci/test-branch')

      expect(mockGit.push).toHaveBeenCalledWith({
        fs: expect.any(Object),
        http: expect.any(Object),
        dir: expect.any(String),
        remote: 'origin',
        ref: 'hnc-ci/test-branch',
        delete: true,
        onAuth: expect.any(Function)
      })
    })

    it('should run complete integration test workflow', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      const result = await provider.runIntegrationTest('fabric-001', mockDiagram)

      expect(result.success).toBe(true)
      expect(result.branchName).toBe('hnc-ci/20240831-143022-ABCD1')
      expect(result.verification?.success).toBe(true)
      expect(result.verification?.filesFound).toHaveLength(3)

      // Verify all operations were called
      expect(mockGit.clone).toHaveBeenCalledTimes(4) // branch, commit, verify, delete
      expect(mockGit.branch).toHaveBeenCalledTimes(1)
      expect(mockGit.commit).toHaveBeenCalledTimes(1)
      expect(mockGit.push).toHaveBeenCalledTimes(2) // push commit, delete branch
    })

    it('should generate proper commit message', async () => {
      const provider = new GitHubProvider({
        token: 'test-token',
        remote: 'https://github.com/test/repo.git'
      })

      const initialized = await provider.initialize()
      expect(initialized).toBe(true)
      
      // Test the private method through commitFGDFiles
      await provider.commitFGDFiles('fabric-prod', mockDiagram, 'hnc-ci/test', undefined)

      expect(mockGit.commit).toHaveBeenCalled()
      const commitCall = mockGit.commit.mock.calls[0][0]
      expect(commitCall.message).toContain('CI: Save fabric-prod FGD files')
      expect(commitCall.message).toContain('1 leaves, 1 spines computed')
      expect(commitCall.message).toContain('2 endpoints allocated')
      expect(commitCall.message).toContain('1 servers, 2 switches total')
      expect(commitCall.message).toContain('[skip ci]')
    })

    describe('Error Handling', () => {
      it('should handle Git clone failure', async () => {
        // Reset mocks for this specific test
        vi.clearAllMocks()
        mockGit.clone.mockRejectedValue(new Error('Authentication failed'))

        const provider = new GitHubProvider({
          token: 'invalid-token',
          remote: 'https://github.com/test/repo.git'
        })

        const initialized = await provider.initialize()
        expect(initialized).toBe(true)
        
        const result = await provider.createThrowawayBranch('test-run')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Failed to create branch')
      })

      it('should handle commit failures', async () => {
        // Reset mocks for this specific test
        vi.clearAllMocks()
        mockGit.clone.mockResolvedValue(undefined)
        mockFs.promises.mkdir.mockResolvedValue(undefined)
        mockFs.promises.writeFile.mockResolvedValue(undefined)
        mockFs.promises.rm.mockResolvedValue(undefined)
        mockGit.add.mockResolvedValue(undefined)
        mockGit.commit.mockRejectedValue(new Error('Commit failed'))

        const provider = new GitHubProvider({
          token: 'test-token',
          remote: 'https://github.com/test/repo.git'
        })

        const initialized = await provider.initialize()
        expect(initialized).toBe(true)
        
        const result = await provider.commitFGDFiles(
          'fabric-001',
          mockDiagram,
          'hnc-ci/test',
          'Test commit'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Failed to commit FGD files')
      })

      it('should handle push failures', async () => {
        // Reset mocks for this specific test  
        vi.clearAllMocks()
        mockGit.clone.mockResolvedValue(undefined)
        mockFs.promises.mkdir.mockResolvedValue(undefined)
        mockFs.promises.writeFile.mockResolvedValue(undefined)
        mockFs.promises.rm.mockResolvedValue(undefined)
        mockGit.add.mockResolvedValue(undefined)
        mockGit.commit.mockResolvedValue('abc123')
        mockGit.push.mockRejectedValue(new Error('Push failed'))

        const provider = new GitHubProvider({
          token: 'test-token',
          remote: 'https://github.com/test/repo.git'
        })

        const initialized = await provider.initialize()
        expect(initialized).toBe(true)
        
        const result = await provider.commitFGDFiles(
          'fabric-001',
          mockDiagram,
          'hnc-ci/test',
          'Test commit'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Failed to commit FGD files')
      })

      it('should handle verification failures', async () => {
        // Reset mocks for this specific test
        vi.clearAllMocks()
        mockGit.clone.mockRejectedValue(new Error('Network error'))

        const provider = new GitHubProvider({
          token: 'test-token',
          remote: 'https://github.com/test/repo.git'
        })

        const initialized = await provider.initialize()
        expect(initialized).toBe(true)
        
        const result = await provider.verifyCommittedFiles('fabric-001', 'hnc-ci/test')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Verification failed')
        expect(result.filesFound).toEqual([])
      })

      it('should handle uninitialized provider', async () => {
        const provider = new GitHubProvider({
          token: 'test-token',
          remote: 'https://github.com/test/repo.git'
        })

        // Don't initialize
        const result = await provider.createThrowawayBranch('test')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Provider not initialized')
      })
    })

    describe('Authentication', () => {
      it('should use correct auth format for Git operations', async () => {
        const provider = new GitHubProvider({
          token: 'test-token-123',
          remote: 'https://github.com/test/repo.git'
        })

        const initialized = await provider.initialize()
        expect(initialized).toBe(true)
        
        await provider.createThrowawayBranch('test')

        expect(mockGit.clone).toHaveBeenCalled()
        const cloneCall = mockGit.clone.mock.calls[0][0]
        const authResult = cloneCall.onAuth()
        
        expect(authResult).toEqual({
          username: 'test-token-123',
          password: 'x-oauth-basic'
        })
      })
    })
  })

  describe('Factory Functions', () => {
    it('should create provider when environment variables are set', () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'https://github.com/test/repo.git'
      process.env.GIT_BASE_BRANCH = 'develop'

      const provider = createGitHubProvider()

      expect(provider).not.toBeNull()
      expect(provider).toBeInstanceOf(GitHubProvider)
    })

    it('should return null when environment variables are missing', () => {
      delete process.env.GITHUB_TOKEN
      delete process.env.GIT_REMOTE

      const provider = createGitHubProvider()

      expect(provider).toBeNull()
    })

    it('should check integration availability correctly', () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GIT_REMOTE = 'https://github.com/test/repo.git'

      expect(isGitHubIntegrationAvailable()).toBe(true)

      delete process.env.GITHUB_TOKEN
      expect(isGitHubIntegrationAvailable()).toBe(false)

      process.env.GITHUB_TOKEN = 'test-token'
      delete process.env.GIT_REMOTE
      expect(isGitHubIntegrationAvailable()).toBe(false)
    })
  })
})