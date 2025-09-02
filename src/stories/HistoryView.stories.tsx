/**
 * Storybook stories for HistoryView component
 * Demonstrates empty and populated states with mock data
 */

import type { Meta, StoryObj } from '@storybook/react'
import { within, userEvent, expect, fn } from '@storybook/test'
import HistoryView from '../components/HistoryView'
import type { HistoryEntry } from '../features/github-history.service'

// Mock the GitHub History service for Storybook
const mockHistoryService = {
  initialize: () => Promise.resolve(true),
  fetchHistory: (options: any) => {
    const entries = getMockHistoryEntries()
    return Promise.resolve({
      success: true,
      entries: entries.slice(0, options?.limit || 20),
      hasMore: entries.length > (options?.limit || 20),
      totalCount: entries.length
    })
  }
}

// Mock availability check
const mockIsGitHubHistoryAvailable = fn(() => true)
const mockCreateGitHubHistoryService = fn(() => mockHistoryService)

// Replace the service imports for Storybook
Object.defineProperty(HistoryView, 'mockService', {
  value: mockHistoryService,
  writable: true
})

// Create mock history data
function getMockHistoryEntries(): HistoryEntry[] {
  return [
    // Recent PR (merged)
    {
      type: 'pr',
      number: 42,
      title: 'Add FGD files for production-fabric-v2',
      state: 'merged',
      author: {
        login: 'fabric-engineer',
        avatarUrl: 'https://github.com/fabric-engineer.png'
      },
      createdAt: new Date('2024-01-15T10:30:00Z'),
      updatedAt: new Date('2024-01-15T14:20:00Z'),
      mergedAt: new Date('2024-01-15T14:20:00Z'),
      url: 'https://github.com/example/repo/pull/42',
      labels: ['hnc', 'fgd', 'production'],
      isFGDRelated: true,
      filesChanged: ['fgd/production-fabric-v2/servers.yaml', 'fgd/production-fabric-v2/switches.yaml', 'fgd/production-fabric-v2/connections.yaml']
    },
    // Recent commit
    {
      type: 'commit',
      sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
      message: 'Save dev-environment: Updated topology configuration\n\n- 4 leaves, 2 spines computed\n- 96 endpoints allocated\n- 48 servers, 6 switches total\n- Generated via HNC v0.4.0',
      author: {
        name: 'Development Team',
        email: 'dev-team@company.com',
        avatarUrl: 'https://github.com/dev-team.png'
      },
      timestamp: new Date('2024-01-14T16:45:00Z'),
      url: 'https://github.com/example/repo/commit/a1b2c3d4e5f6789012345678901234567890abcd',
      files: ['fgd/dev-environment/servers.yaml', 'fgd/dev-environment/switches.yaml', 'fgd/dev-environment/connections.yaml'],
      isFGDRelated: true
    },
    // Open PR
    {
      type: 'pr',
      number: 41,
      title: 'WIP: Test fabric configuration updates',
      state: 'open',
      author: {
        login: 'network-admin',
        avatarUrl: 'https://github.com/network-admin.png'
      },
      createdAt: new Date('2024-01-12T09:15:00Z'),
      updatedAt: new Date('2024-01-13T11:30:00Z'),
      mergedAt: null,
      url: 'https://github.com/example/repo/pull/41',
      labels: ['wip', 'hnc', 'testing'],
      isFGDRelated: true,
      filesChanged: ['fgd/test-fabric/servers.yaml', 'fgd/test-fabric/switches.yaml']
    },
    // Older commit
    {
      type: 'commit',
      sha: 'b2c3d4e5f6789012345678901234567890abcdef1',
      message: 'CI: Save staging-cluster FGD files\n\n- 2 leaves, 1 spine computed\n- 48 endpoints allocated\n- 24 servers, 3 switches total\n- Generated via HNC CI integration test\n\n[skip ci]',
      author: {
        name: 'HNC CI',
        email: 'hnc-ci@example.com'
      },
      timestamp: new Date('2024-01-10T12:20:00Z'),
      url: 'https://github.com/example/repo/commit/b2c3d4e5f6789012345678901234567890abcdef1',
      files: ['fgd/staging-cluster/servers.yaml', 'fgd/staging-cluster/switches.yaml', 'fgd/staging-cluster/connections.yaml'],
      isFGDRelated: true
    },
    // Closed PR
    {
      type: 'pr',
      number: 40,
      title: 'Experimental: High-density server configuration',
      state: 'closed',
      author: {
        login: 'research-team',
        avatarUrl: 'https://github.com/research-team.png'
      },
      createdAt: new Date('2024-01-08T14:00:00Z'),
      updatedAt: new Date('2024-01-09T16:45:00Z'),
      mergedAt: null,
      url: 'https://github.com/example/repo/pull/40',
      labels: ['experimental', 'hnc', 'high-density'],
      isFGDRelated: true,
      filesChanged: ['fgd/experimental-hd/servers.yaml', 'fgd/experimental-hd/switches.yaml', 'fgd/experimental-hd/connections.yaml']
    }
  ]
}

const meta: Meta<typeof HistoryView> = {
  title: 'Components/HistoryView',
  component: HistoryView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'History view component that displays FGD-related commits and pull requests from GitHub. Read-only component that links to GitHub for detailed views.'
      }
    }
  },
  argTypes: {
    isOpen: {
      description: 'Controls whether the history modal is open',
      control: 'boolean'
    },
    onClose: {
      description: 'Callback function called when the modal is closed',
      action: 'onClose'
    }
  },
  decorators: [
    (Story) => {
      // Mock the service functions in the global scope for the component
      (global as any).mockIsGitHubHistoryAvailable = mockIsGitHubHistoryAvailable
      ;(global as any).mockCreateGitHubHistoryService = mockCreateGitHubHistoryService
      return <Story />
    }
  ]
}

export default meta
type Story = StoryObj<typeof HistoryView>

// Story: History modal closed (default state)
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {}
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Should not render modal when closed', async () => {
      // Modal should not be visible
      const overlay = canvas.queryByTestId('history-view-overlay')
      expect(overlay).not.toBeInTheDocument()
    })
  }
}

// Story: Empty history state
export const Empty: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  decorators: [
    (Story) => {
      // Override the service to return empty results
      const emptyService = {
        ...mockHistoryService,
        fetchHistory: () => Promise.resolve({
          success: true,
          entries: [],
          hasMore: false,
          totalCount: 0
        })
      }
      
      ;(global as any).mockCreateGitHubHistoryService = () => emptyService
      return <Story />
    }
  ],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Should display empty state', async () => {
      // Wait for loading to complete
      await expect(canvas.findByTestId('history-empty')).resolves.toBeInTheDocument()
      
      // Check empty state message
      expect(canvas.getByText('No FGD History Found')).toBeInTheDocument()
      expect(canvas.getByText(/No recent commits or pull requests/)).toBeInTheDocument()
    })
    
    await step('Should show filter controls', async () => {
      // Check filter checkboxes are present
      expect(canvas.getByTestId('include-commits-checkbox')).toBeInTheDocument()
      expect(canvas.getByTestId('include-prs-checkbox')).toBeInTheDocument()
      expect(canvas.getByTestId('fgd-only-checkbox')).toBeInTheDocument()
    })
  }
}

// Story: Populated history with various entry types
export const WithHistory: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Should display history entries', async () => {
      // Wait for entries to load
      await expect(canvas.findByTestId('history-entries')).resolves.toBeInTheDocument()
      
      // Check that we have entries
      const entries = canvas.getAllByTestId(/^history-entry-/)
      expect(entries.length).toBeGreaterThan(0)
    })
    
    await step('Should show commit entries', async () => {
      // Check for commit entries
      const commitEntries = canvas.getAllByTestId('history-entry-commit')
      expect(commitEntries.length).toBeGreaterThan(0)
      
      // Verify commit has SHA and author
      expect(canvas.getByText('a1b2c3d')).toBeInTheDocument() // Short SHA
      expect(canvas.getByText('Development Team')).toBeInTheDocument()
    })
    
    await step('Should show PR entries', async () => {
      // Check for PR entries  
      const prEntries = canvas.getAllByTestId('history-entry-pr')
      expect(prEntries.length).toBeGreaterThan(0)
      
      // Verify PR has number and status
      expect(canvas.getByText('#42')).toBeInTheDocument()
      expect(canvas.getByText('MERGED')).toBeInTheDocument()
      expect(canvas.getByText('fabric-engineer')).toBeInTheDocument()
    })
    
    await step('Should have working external links', async () => {
      // Check that PR and commit links exist and point to GitHub
      const prLink = canvas.getByTestId('pr-link')
      expect(prLink).toHaveAttribute('href', 'https://github.com/example/repo/pull/42')
      expect(prLink).toHaveAttribute('target', '_blank')
      
      const commitLink = canvas.getByTestId('commit-link')
      expect(commitLink).toHaveAttribute('href', 'https://github.com/example/repo/commit/a1b2c3d4e5f6789012345678901234567890abcd')
      expect(commitLink).toHaveAttribute('target', '_blank')
    })
  }
}

// Story: Service unavailable state
export const ServiceUnavailable: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  decorators: [
    (Story) => {
      // Override availability check to return false
      (global as any).mockIsGitHubHistoryAvailable = () => false
      return <Story />
    }
  ],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Should show unavailable message', async () => {
      expect(canvas.getByTestId('history-unavailable')).toBeInTheDocument()
      expect(canvas.getByText('GitHub History Not Available')).toBeInTheDocument()
      expect(canvas.getByText(/GITHUB_TOKEN/)).toBeInTheDocument()
      expect(canvas.getByText(/GIT_REMOTE/)).toBeInTheDocument()
      expect(canvas.getByText(/FEATURE_GH_PR=true/)).toBeInTheDocument()
    })
  }
}

// Story: Error loading history
export const LoadingError: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  decorators: [
    (Story) => {
      // Override service to return error
      const errorService = {
        initialize: () => Promise.resolve(true),
        fetchHistory: () => Promise.resolve({
          success: false,
          entries: [],
          hasMore: false,
          error: 'Failed to fetch from GitHub API: Rate limit exceeded'
        })
      }
      
      ;(global as any).mockCreateGitHubHistoryService = () => errorService
      return <Story />
    }
  ],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    
    await step('Should display error message', async () => {
      await expect(canvas.findByTestId('history-error')).resolves.toBeInTheDocument()
      
      expect(canvas.getByText('⚠ Error Loading History')).toBeInTheDocument()
      expect(canvas.getByText(/Rate limit exceeded/)).toBeInTheDocument()
    })
  }
}

// Story: Interactive filtering
export const InteractiveFilters: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    
    await step('Should load with default filters', async () => {
      await expect(canvas.findByTestId('history-entries')).resolves.toBeInTheDocument()
      
      // Default filters should be checked
      expect(canvas.getByTestId('include-commits-checkbox')).toBeChecked()
      expect(canvas.getByTestId('include-prs-checkbox')).toBeChecked()
      expect(canvas.getByTestId('fgd-only-checkbox')).toBeChecked()
    })
    
    await step('Should be able to toggle commit filter', async () => {
      const commitsCheckbox = canvas.getByTestId('include-commits-checkbox')
      
      // Uncheck commits
      await user.click(commitsCheckbox)
      expect(commitsCheckbox).not.toBeChecked()
      
      // Check commits again
      await user.click(commitsCheckbox)
      expect(commitsCheckbox).toBeChecked()
    })
    
    await step('Should be able to refresh', async () => {
      const refreshButton = canvas.getByTestId('refresh-history-button')
      expect(refreshButton).toBeInTheDocument()
      
      await user.click(refreshButton)
      // Button should be present and clickable
      expect(refreshButton).toBeInTheDocument()
    })
  }
}

// Story: Modal interaction
export const ModalInteraction: Story = {
  args: {
    isOpen: true,
    onClose: () => {}
  },
  play: async ({ canvasElement, step, args }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    
    await step('Should be able to close modal with X button', async () => {
      const closeButton = canvas.getByTestId('close-history-button')
      expect(closeButton).toBeInTheDocument()
      
      await user.click(closeButton)
      expect(args.onClose).toHaveBeenCalled()
    })
    
    await step('Should be able to close modal by clicking overlay', async () => {
      // Reset the mock
      (args.onClose as any).mockClear()
      
      const overlay = canvas.getByTestId('history-view-overlay')
      await user.click(overlay)
      expect(args.onClose).toHaveBeenCalled()
    })
  }
}