/**
 * Unit tests for HistoryView component
 * Tests the UI component that displays FGD commit and PR history
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistoryView from '../../src/components/HistoryView'
import type { HistoryEntry, HistoryFetchResult } from '../../src/features/github-history.service'

// Mock the GitHub History service
const mockHistoryService = {
  initialize: vi.fn(() => Promise.resolve(true)),
  fetchHistory: vi.fn(() => Promise.resolve({
    success: true,
    entries: [],
    hasMore: false,
    totalCount: 0
  } as HistoryFetchResult))
}

const mockCreateGitHubHistoryService = vi.fn(() => mockHistoryService)
const mockIsGitHubHistoryAvailable = vi.fn(() => true)

// Mock the service module
vi.mock('../../src/features/github-history.service', () => ({
  createGitHubHistoryService: () => mockCreateGitHubHistoryService(),
  isGitHubHistoryAvailable: () => mockIsGitHubHistoryAvailable()
}))

// Mock entries for testing
const mockCommitEntry: HistoryEntry = {
  type: 'commit',
  sha: 'abc123def456',
  message: 'Add FGD files for test-fabric\n\n- 2 leaves, 1 spine computed\n- Generated via HNC v0.4.0',
  author: {
    name: 'Test Developer',
    email: 'test@example.com',
    avatarUrl: 'https://github.com/testdev.png'
  },
  timestamp: new Date('2024-01-15T14:30:00Z'),
  url: 'https://github.com/test/repo/commit/abc123def456',
  files: ['fgd/test-fabric/servers.yaml', 'fgd/test-fabric/switches.yaml', 'fgd/test-fabric/connections.yaml'],
  isFGDRelated: true
}

const mockPREntry: HistoryEntry = {
  type: 'pr',
  number: 42,
  title: 'HNC: Save production-fabric FGD files',
  state: 'merged',
  author: {
    login: 'fabric-engineer',
    avatarUrl: 'https://github.com/fabric-engineer.png'
  },
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T12:30:00Z'),
  mergedAt: new Date('2024-01-15T12:30:00Z'),
  url: 'https://github.com/test/repo/pull/42',
  labels: ['hnc', 'fgd', 'production'],
  isFGDRelated: true,
  filesChanged: ['fgd/production-fabric/servers.yaml', 'fgd/production-fabric/switches.yaml']
}

describe('HistoryView', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsGitHubHistoryAvailable.mockReturnValue(true)
    mockCreateGitHubHistoryService.mockReturnValue(mockHistoryService)
    mockHistoryService.initialize.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('rendering states', () => {
    it('should not render when isOpen is false', () => {
      render(<HistoryView isOpen={false} onClose={vi.fn()} />)
      
      expect(screen.queryByTestId('history-view-overlay')).not.toBeInTheDocument()
    })

    it('should render modal when isOpen is true', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [],
        hasMore: false,
        totalCount: 0
      })

      render(<HistoryView {...defaultProps} />)
      
      expect(screen.getByTestId('history-view-overlay')).toBeInTheDocument()
      expect(screen.getByTestId('history-view-modal')).toBeInTheDocument()
      expect(screen.getByText('FGD History')).toBeInTheDocument()
    })

    it('should show loading state initially', async () => {
      // Make fetchHistory hang to test loading state
      mockHistoryService.fetchHistory.mockImplementation(() => new Promise(() => {}))

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-loading')).toBeInTheDocument()
      })
      expect(screen.getByText('Loading History...')).toBeInTheDocument()
    })

    it('should show service unavailable when GitHub integration not configured', () => {
      mockIsGitHubHistoryAvailable.mockReturnValue(false)

      render(<HistoryView {...defaultProps} />)
      
      expect(screen.getByTestId('history-unavailable')).toBeInTheDocument()
      expect(screen.getByText('GitHub History Not Available')).toBeInTheDocument()
      expect(screen.getByText(/GITHUB_TOKEN/)).toBeInTheDocument()
    })

    it('should show empty state when no history entries', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [],
        hasMore: false,
        totalCount: 0
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-empty')).toBeInTheDocument()
      })
      expect(screen.getByText('No FGD History Found')).toBeInTheDocument()
    })

    it('should show error state when fetch fails', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: false,
        entries: [],
        hasMore: false,
        error: 'API rate limit exceeded'
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-error')).toBeInTheDocument()
      })
      expect(screen.getByText('⚠ Error Loading History')).toBeInTheDocument()
      expect(screen.getByText(/API rate limit exceeded/)).toBeInTheDocument()
    })
  })

  describe('filter controls', () => {
    beforeEach(async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [mockCommitEntry, mockPREntry],
        hasMore: false,
        totalCount: 2
      })
    })

    it('should render filter controls', async () => {
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('include-commits-checkbox')).toBeInTheDocument()
        expect(screen.getByTestId('include-prs-checkbox')).toBeInTheDocument()
        expect(screen.getByTestId('fgd-only-checkbox')).toBeInTheDocument()
        expect(screen.getByTestId('refresh-history-button')).toBeInTheDocument()
      })
    })

    it('should have default filter values', async () => {
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('include-commits-checkbox')).toBeChecked()
        expect(screen.getByTestId('include-prs-checkbox')).toBeChecked()
        expect(screen.getByTestId('fgd-only-checkbox')).toBeChecked()
      })
    })

    it('should call fetchHistory when filters change', async () => {
      const user = userEvent.setup()
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('include-commits-checkbox')).toBeInTheDocument()
      })

      // Clear initial calls
      mockHistoryService.fetchHistory.mockClear()
      
      // Toggle commits filter
      await user.click(screen.getByTestId('include-commits-checkbox'))
      
      await waitFor(() => {
        expect(mockHistoryService.fetchHistory).toHaveBeenCalledWith(
          expect.objectContaining({
            includeCommits: false
          })
        )
      })
    })

    it('should refresh history when refresh button clicked', async () => {
      const user = userEvent.setup()
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('refresh-history-button')).toBeInTheDocument()
      })

      // Clear initial calls
      mockHistoryService.fetchHistory.mockClear()
      
      // Click refresh
      await user.click(screen.getByTestId('refresh-history-button'))
      
      await waitFor(() => {
        expect(mockHistoryService.fetchHistory).toHaveBeenCalled()
      })
    })
  })

  describe('history entries display', () => {
    it('should display commit entries correctly', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [mockCommitEntry],
        hasMore: false,
        totalCount: 1
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-entries')).toBeInTheDocument()
      })

      // Check commit entry display
      expect(screen.getByTestId('history-entry-commit')).toBeInTheDocument()
      expect(screen.getByText('abc123d')).toBeInTheDocument() // Short SHA
      expect(screen.getByText('Test Developer')).toBeInTheDocument()
      
      // Check commit link
      const commitLink = screen.getByTestId('commit-link')
      expect(commitLink).toHaveAttribute('href', 'https://github.com/test/repo/commit/abc123def456')
      expect(commitLink).toHaveAttribute('target', '_blank')
    })

    it('should display PR entries correctly', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [mockPREntry],
        hasMore: false,
        totalCount: 1
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-entries')).toBeInTheDocument()
      })

      // Check PR entry display
      expect(screen.getByTestId('history-entry-pr')).toBeInTheDocument()
      expect(screen.getByText('#42')).toBeInTheDocument()
      expect(screen.getByText('MERGED')).toBeInTheDocument()
      expect(screen.getByText('fabric-engineer')).toBeInTheDocument()
      
      // Check PR link
      const prLink = screen.getByTestId('pr-link')
      expect(prLink).toHaveAttribute('href', 'https://github.com/test/repo/pull/42')
      expect(prLink).toHaveAttribute('target', '_blank')
      
      // Check labels
      expect(screen.getByText('hnc')).toBeInTheDocument()
      expect(screen.getByText('fgd')).toBeInTheDocument()
    })

    it('should display files changed information', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [mockCommitEntry, mockPREntry],
        hasMore: false,
        totalCount: 2
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-entries')).toBeInTheDocument()
      })

      // Check files display
      expect(screen.getByText(/servers\.yaml/)).toBeInTheDocument()
      expect(screen.getByText(/switches\.yaml/)).toBeInTheDocument()
    })

    it('should show summary when entries loaded', async () => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [mockCommitEntry, mockPREntry],
        hasMore: true,
        totalCount: 10
      })

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Showing 2 of 10 entries/)).toBeInTheDocument()
        expect(screen.getByText(/more available/)).toBeInTheDocument()
      })
    })
  })

  describe('modal interactions', () => {
    beforeEach(() => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [],
        hasMore: false,
        totalCount: 0
      })
    })

    it('should close modal when close button clicked', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      
      render(<HistoryView isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('close-history-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('close-history-button'))
      expect(onClose).toHaveBeenCalled()
    })

    it('should close modal when overlay clicked', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      
      render(<HistoryView isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-view-overlay')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('history-view-overlay'))
      expect(onClose).toHaveBeenCalled()
    })

    it('should not close modal when modal content clicked', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      
      render(<HistoryView isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-view-modal')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('history-view-modal'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('service initialization', () => {
    it('should handle service initialization failure', async () => {
      mockHistoryService.initialize.mockResolvedValue(false)

      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('history-error')).toBeInTheDocument()
      })
      expect(screen.getByText(/Failed to initialize GitHub service/)).toBeInTheDocument()
    })

    it('should handle null service creation', () => {
      mockCreateGitHubHistoryService.mockReturnValue(null)

      render(<HistoryView {...defaultProps} />)
      
      expect(screen.getByTestId('history-error')).toBeInTheDocument()
      expect(screen.getByText(/GitHub History service not available/)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    beforeEach(() => {
      mockHistoryService.fetchHistory.mockResolvedValue({
        success: true,
        entries: [],
        hasMore: false,
        totalCount: 0
      })
    })

    it('should have proper ARIA labels', async () => {
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Close History View')).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<HistoryView {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('close-history-button')).toBeInTheDocument()
      })

      // Tab to close button and press Enter
      await user.tab()
      expect(screen.getByTestId('close-history-button')).toHaveFocus()
    })
  })
})