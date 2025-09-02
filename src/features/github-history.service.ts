/**
 * GitHub History service for fetching FGD commit and PR history
 * Read-only service that leverages existing GitHub integration patterns
 * Uses existing GitHubProvider and GitHub PR service for data fetching
 */

import { Octokit } from '@octokit/rest'
import { isGhPrEnabled } from './feature-flags.js'

export interface CommitHistoryEntry {
  type: 'commit'
  sha: string
  message: string
  author: {
    name: string
    email: string
    avatarUrl?: string
  }
  timestamp: Date
  url: string
  files?: string[]
  isFGDRelated: boolean
}

export interface PRHistoryEntry {
  type: 'pr'
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  author: {
    login: string
    avatarUrl?: string
  }
  createdAt: Date
  updatedAt: Date
  mergedAt?: Date | null
  url: string
  labels: string[]
  isFGDRelated: boolean
  filesChanged?: string[]
}

export type HistoryEntry = CommitHistoryEntry | PRHistoryEntry

export interface GitHubHistoryConfig {
  token: string
  remote: string // e.g., 'https://github.com/owner/repo.git' or 'owner/repo'
  baseBranch?: string // default: 'main'
}

export interface HistoryFetchOptions {
  limit?: number // default: 20
  includeCommits?: boolean // default: true
  includePRs?: boolean // default: true
  fgdOnly?: boolean // default: true - only FGD-related changes
  since?: Date // fetch history since this date
}

export interface HistoryFetchResult {
  success: boolean
  entries: HistoryEntry[]
  hasMore: boolean
  error?: string
  totalCount?: number
}

export class GitHubHistoryService {
  private octokit: Octokit | null = null
  private owner: string = ''
  private repo: string = ''
  
  constructor(private config: GitHubHistoryConfig) {
    this.parseRemote()
  }

  /**
   * Initialize the service with Octokit client
   */
  async initialize(): Promise<boolean> {
    if (!isGhPrEnabled()) {
      return false
    }

    try {
      this.octokit = new Octokit({
        auth: this.config.token,
      })
      return true
    } catch (error) {
      console.warn('Failed to initialize GitHub History service:', error)
      return false
    }
  }

  /**
   * Parse GitHub remote URL to extract owner/repo
   */
  private parseRemote(): void {
    const remote = this.config.remote

    // Handle different remote formats
    if (remote.includes('github.com')) {
      // HTTPS: https://github.com/owner/repo.git
      // SSH: git@github.com:owner/repo.git
      const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
      if (match) {
        this.owner = match[1]
        this.repo = match[2]
        return
      }
    }

    // Simple format: owner/repo
    if (remote.includes('/') && !remote.includes('://')) {
      const parts = remote.split('/')
      if (parts.length >= 2) {
        this.owner = parts[0]
        this.repo = parts[1]
        return
      }
    }

    throw new Error(`Invalid GitHub remote format: ${remote}`)
  }

  /**
   * Fetch commit and PR history
   */
  async fetchHistory(options: HistoryFetchOptions = {}): Promise<HistoryFetchResult> {
    if (!this.octokit) {
      return { 
        success: false, 
        entries: [], 
        hasMore: false, 
        error: 'Service not initialized' 
      }
    }

    const {
      limit = 20,
      includeCommits = true,
      includePRs = true,
      fgdOnly = true,
      since
    } = options

    try {
      const entries: HistoryEntry[] = []

      // Fetch commits if requested
      if (includeCommits) {
        const commits = await this.fetchCommits(limit, since, fgdOnly)
        entries.push(...commits)
      }

      // Fetch PRs if requested
      if (includePRs) {
        const prs = await this.fetchPullRequests(limit, since, fgdOnly)
        entries.push(...prs)
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => {
        const aTime = a.type === 'commit' ? a.timestamp : a.createdAt
        const bTime = b.type === 'commit' ? b.timestamp : b.createdAt
        return bTime.getTime() - aTime.getTime()
      })

      // Limit results
      const limitedEntries = entries.slice(0, limit)
      const hasMore = entries.length > limit

      return {
        success: true,
        entries: limitedEntries,
        hasMore,
        totalCount: entries.length
      }

    } catch (error: any) {
      return {
        success: false,
        entries: [],
        hasMore: false,
        error: `Failed to fetch history: ${error.message}`
      }
    }
  }

  /**
   * Fetch commit history
   */
  private async fetchCommits(
    limit: number, 
    since?: Date, 
    fgdOnly: boolean = true
  ): Promise<CommitHistoryEntry[]> {
    if (!this.octokit) return []

    const baseBranch = this.config.baseBranch || 'main'
    
    const response = await this.octokit.repos.listCommits({
      owner: this.owner,
      repo: this.repo,
      sha: baseBranch,
      per_page: Math.min(limit * 2, 100), // Fetch more to account for filtering
      since: since?.toISOString()
    })

    const commits: CommitHistoryEntry[] = []

    for (const commit of response.data) {
      // Check if commit is FGD-related
      const isFGDRelated = this.isCommitFGDRelated(commit.commit.message)
      
      if (fgdOnly && !isFGDRelated) {
        continue
      }

      // Fetch files changed in this commit for detailed info
      let files: string[] = []
      try {
        const commitDetails = await this.octokit.repos.getCommit({
          owner: this.owner,
          repo: this.repo,
          ref: commit.sha
        })
        files = commitDetails.data.files?.map(f => f.filename) || []
      } catch (error) {
        // File details fetch failed, continue without files list
      }

      commits.push({
        type: 'commit',
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || '',
          avatarUrl: commit.author?.avatar_url
        },
        timestamp: new Date(commit.commit.author?.date || Date.now()),
        url: commit.html_url,
        files,
        isFGDRelated
      })

      if (commits.length >= limit) {
        break
      }
    }

    return commits
  }

  /**
   * Fetch pull request history
   */
  private async fetchPullRequests(
    limit: number, 
    since?: Date, 
    fgdOnly: boolean = true
  ): Promise<PRHistoryEntry[]> {
    if (!this.octokit) return []

    const response = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: Math.min(limit * 2, 100) // Fetch more to account for filtering
    })

    const prs: PRHistoryEntry[] = []

    for (const pr of response.data) {
      const createdAt = new Date(pr.created_at)
      const updatedAt = new Date(pr.updated_at)
      
      // Filter by date if specified
      if (since && updatedAt < since) {
        continue
      }

      // Check if PR is FGD-related
      const isFGDRelated = this.isPRFGDRelated(pr)
      
      if (fgdOnly && !isFGDRelated) {
        continue
      }

      // Fetch files changed in this PR
      let filesChanged: string[] = []
      try {
        const filesResponse = await this.octokit.pulls.listFiles({
          owner: this.owner,
          repo: this.repo,
          pull_number: pr.number
        })
        filesChanged = filesResponse.data.map(f => f.filename)
      } catch (error) {
        // File details fetch failed, continue without files list
      }

      prs.push({
        type: 'pr',
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
        author: {
          login: pr.user?.login || 'unknown',
          avatarUrl: pr.user?.avatar_url
        },
        createdAt,
        updatedAt,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        url: pr.html_url,
        labels: pr.labels?.map(label => label.name) || [],
        isFGDRelated,
        filesChanged
      })

      if (prs.length >= limit) {
        break
      }
    }

    return prs
  }

  /**
   * Check if commit message indicates FGD-related changes
   */
  private isCommitFGDRelated(message: string): boolean {
    const fgdKeywords = [
      'fgd',
      'fabric',
      'hnc',
      'wiring',
      'topology',
      'servers.yaml',
      'switches.yaml',
      'connections.yaml',
      'CI: Save',
      'Add FGD files'
    ]
    
    const lowerMessage = message.toLowerCase()
    return fgdKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
  }

  /**
   * Check if PR is FGD-related based on title, labels, and content
   */
  private isPRFGDRelated(pr: any): boolean {
    // Check title
    if (this.isCommitFGDRelated(pr.title)) {
      return true
    }

    // Check labels
    const fgdLabels = ['hnc', 'fgd', 'fabric', 'topology', 'wiring']
    const prLabels = (pr.labels || []).map((label: any) => label.name.toLowerCase())
    if (fgdLabels.some(label => prLabels.includes(label))) {
      return true
    }

    // Check for HNC-specific PR patterns
    if (pr.head?.ref?.includes('hnc-')) {
      return true
    }

    return false
  }

  /**
   * Check if GitHub History service is available and configured
   */
  static isAvailable(): boolean {
    return isGhPrEnabled() && Boolean(
      process.env.GITHUB_TOKEN && 
      process.env.GIT_REMOTE
    )
  }
}

/**
 * Factory function to create GitHub History service with environment-based config
 */
export function createGitHubHistoryService(): GitHubHistoryService | null {
  if (!GitHubHistoryService.isAvailable()) {
    return null
  }

  const token = process.env.GITHUB_TOKEN!
  const remote = process.env.GIT_REMOTE!
  
  return new GitHubHistoryService({
    token,
    remote,
    baseBranch: process.env.GIT_BASE_BRANCH || 'main'
  })
}

/**
 * Check if GitHub History integration is available
 */
export function isGitHubHistoryAvailable(): boolean {
  return GitHubHistoryService.isAvailable()
}