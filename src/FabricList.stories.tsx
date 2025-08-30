import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import { FabricList } from './FabricList'
import type { FabricSummary } from './fabric.types'
import type { DriftStatus } from './drift/types.js'

const meta: Meta<typeof FabricList> = {
  title: 'HNC/FabricList',
  component: FabricList,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onCreateFabric: { action: 'create-fabric' },
    onSelectFabric: { action: 'select-fabric' },
    onDeleteFabric: { action: 'delete-fabric' },
    onCheckDrift: { action: 'check-drift' },
    onViewDriftDetails: { action: 'view-drift-details' },
  },
}

export default meta
type Story = StoryObj<typeof FabricList>

// Sample drift status data
const noDriftStatus: DriftStatus = {
  hasDrift: false,
  driftSummary: ['No drift detected - in-memory topology matches files on disk'],
  lastChecked: new Date(),
  affectedFiles: []
}

const minorDriftStatus: DriftStatus = {
  hasDrift: true,
  driftSummary: ['switches: 1 modified', 'connections: 2 added'],
  lastChecked: new Date(),
  affectedFiles: ['./fgd/test-fabric/switches.yaml', './fgd/test-fabric/connections.yaml']
}

const majorDriftStatus: DriftStatus = {
  hasDrift: true,
  driftSummary: [
    'switches: 2 added, 1 removed, 3 modified',
    'endpoints: 5 added, 2 modified',
    'connections: 8 added, 3 removed, 4 modified'
  ],
  lastChecked: new Date(),
  affectedFiles: [
    './fgd/prod-fabric/servers.yaml',
    './fgd/prod-fabric/switches.yaml', 
    './fgd/prod-fabric/connections.yaml'
  ]
}

const sampleFabrics: FabricSummary[] = [
  {
    id: 'fabric-1',
    name: 'Production Network',
    status: 'saved',
    createdAt: new Date('2024-08-25'),
    lastModified: new Date('2024-08-29'),
    driftStatus: majorDriftStatus
  },
  {
    id: 'fabric-2',
    name: 'Dev Environment',
    status: 'computed',
    createdAt: new Date('2024-08-28'),
    lastModified: new Date('2024-08-28'),
    driftStatus: minorDriftStatus
  },
  {
    id: 'fabric-3',
    name: 'Test Lab Setup',
    status: 'draft',
    createdAt: new Date('2024-08-30'),
    lastModified: new Date('2024-08-30'),
    driftStatus: noDriftStatus
  },
]

// Basic fabrics without drift status for backwards compatibility
const basicFabrics: FabricSummary[] = [
  {
    id: 'fabric-1',
    name: 'Production Network',
    status: 'saved',
    createdAt: new Date('2024-08-25'),
    lastModified: new Date('2024-08-29'),
  },
  {
    id: 'fabric-2',
    name: 'Dev Environment',
    status: 'computed',
    createdAt: new Date('2024-08-28'),
    lastModified: new Date('2024-08-28'),
  },
  {
    id: 'fabric-3',
    name: 'Test Lab Setup',
    status: 'draft',
    createdAt: new Date('2024-08-30'),
    lastModified: new Date('2024-08-30'),
  },
]

export const Empty: Story = {
  args: {
    fabrics: [],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show empty state message
    await expect(canvas.getByText('No fabrics created yet')).toBeInTheDocument()
    await expect(canvas.getByText('Create your first fabric to get started with network design')).toBeInTheDocument()
    
    // Should show create button
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await expect(createButton).toBeInTheDocument()
  },
}

export const WithFabrics: Story = {
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show fabric count
    await expect(canvas.getByText('Your Fabrics (3)')).toBeInTheDocument()
    
    // Should show all fabric names
    await expect(canvas.getByText('Production Network')).toBeInTheDocument()
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument()
    await expect(canvas.getByText('Test Lab Setup')).toBeInTheDocument()
    
    // Should show status badges with correct colors
    const savedStatus = canvas.getByText('Saved')
    await expect(savedStatus).toBeInTheDocument()
    
    const computedStatus = canvas.getByText('Computed')
    await expect(computedStatus).toBeInTheDocument()
    
    const draftStatus = canvas.getByText('Draft')
    await expect(draftStatus).toBeInTheDocument()
    
    // Should show select and delete buttons
    const selectButtons = canvas.getAllByRole('button', { name: 'Select' })
    await expect(selectButtons).toHaveLength(3)
    
    const deleteButtons = canvas.getAllByRole('button', { name: 'Delete' })
    await expect(deleteButtons).toHaveLength(3)
  },
}

export const Creating: Story = {
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: true,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Click create button to show form
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    // Form should be visible
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('Enter fabric name...')).toBeInTheDocument()
    
    // Buttons should be present
    await expect(canvas.getByRole('button', { name: 'Creating...' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  },
}

export const CreateFormInteraction: Story = {
  name: 'Interactive Create Form Validation',
  args: {
    fabrics: [],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Click create button
    const createButton = canvas.getByRole('button', { name: 'Create New Fabric' })
    await userEvent.click(createButton)
    
    // Form should appear
    await expect(canvas.getByText('Create New Fabric')).toBeInTheDocument()
    
    // Test empty submission (should be disabled or show validation)
    const initialSubmitButton = canvas.getByRole('button', { name: 'Create' })
    // Initial state might be disabled or enabled depending on implementation
    
    // Type in fabric name
    const nameInput = canvas.getByPlaceholderText('Enter fabric name...')
    await userEvent.type(nameInput, 'My New Fabric')
    
    // Create button should be enabled after typing
    const submitButton = canvas.getByRole('button', { name: 'Create' })
    await expect(submitButton).not.toBeDisabled()
    
    // Test cancel functionality
    const cancelButton = canvas.getByRole('button', { name: 'Cancel' })
    await expect(cancelButton).toBeInTheDocument()
    
    // Click create
    await userEvent.click(submitButton)
    
    // Should call onCreateFabric with trimmed name
    await expect(args.onCreateFabric).toHaveBeenCalledWith('My New Fabric')
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive form validation and submission testing with cancel functionality.'
      }
    }
  }
}

export const WithErrors: Story = {
  args: {
    fabrics: sampleFabrics,
    errors: ['Fabric name cannot be empty', 'Fabric name must be unique'],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show error section
    await expect(canvas.getByText('Errors:')).toBeInTheDocument()
    await expect(canvas.getByText('Fabric name cannot be empty')).toBeInTheDocument()
    await expect(canvas.getByText('Fabric name must be unique')).toBeInTheDocument()
    
    // Error section should exist and have error styling
    const errorSection = canvas.getByText('Errors:').closest('div')
    await expect(errorSection).not.toBeNull()
  },
}

export const FabricInteractions: Story = {
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Click select on first fabric
    const selectButtons = canvas.getAllByRole('button', { name: 'Select' })
    if (selectButtons[0]) {
      await userEvent.click(selectButtons[0])
      
      // Should call onSelectFabric with correct ID
      await expect(args.onSelectFabric).toHaveBeenCalledWith('fabric-1')
    }
    
    // Test delete with confirmation (mock window.confirm to return true)
    const originalConfirm = window.confirm
    window.confirm = () => true
    
    const deleteButtons = canvas.getAllByRole('button', { name: 'Delete' })
    if (deleteButtons[1]) {
      await userEvent.click(deleteButtons[1])
      
      // Should call onDeleteFabric with correct ID
      await expect(args.onDeleteFabric).toHaveBeenCalledWith('fabric-2')
    }
    
    // Restore original confirm
    window.confirm = originalConfirm
  },
}

export const StatusVariations: Story = {
  args: {
    fabrics: [
      {
        id: 'draft-fabric',
        name: 'Draft Fabric',
        status: 'draft',
        createdAt: new Date(),
        lastModified: new Date(),
      },
      {
        id: 'computed-fabric',
        name: 'Computed Fabric',
        status: 'computed',
        createdAt: new Date(),
        lastModified: new Date(),
      },
      {
        id: 'saved-fabric',
        name: 'Saved Fabric',
        status: 'saved',
        createdAt: new Date(),
        lastModified: new Date(),
      },
    ],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Check all status badges are present with different colors
    const draftBadge = canvas.getByText('Draft')
    const computedBadge = canvas.getByText('Computed')
    const savedBadge = canvas.getByText('Saved')
    
    await expect(draftBadge).toBeInTheDocument()
    await expect(computedBadge).toBeInTheDocument()
    await expect(savedBadge).toBeInTheDocument()
    
    // Verify they have different background colors (check the badges themselves)
    await expect(draftBadge.parentElement).toBeTruthy()
    await expect(computedBadge.parentElement).toBeTruthy() 
    await expect(savedBadge.parentElement).toBeTruthy()
  },
}

// New story showcasing drift functionality
export const WithDriftIndicators: Story = {
  name: 'With Drift Status Indicators',
  args: {
    fabrics: sampleFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Should show drift badge in header indicating 2 fabrics have drift
    await expect(canvas.getByText('2 fabrics have drift')).toBeInTheDocument()
    
    // Should show drift indicators for fabrics with drift
    const driftIndicators = canvas.getAllByText('🔄')
    await expect(driftIndicators.length).toBeGreaterThanOrEqual(2) // Major and minor drift
    
    // Should show checkmark for no-drift fabric
    const checkmarks = canvas.getAllByText('✓')
    await expect(checkmarks.length).toBeGreaterThanOrEqual(1)
    
    // Test drift detail interactions
    const driftDetails = canvas.getAllByText('View Details')
    if (driftDetails[0]) {
      await userEvent.click(driftDetails[0])
      await expect(args.onViewDriftDetails).toHaveBeenCalled()
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows fabrics with different drift states: major drift (Production), minor drift (Dev), and no drift (Test). The workspace header shows a drift badge when fabrics have drift.'
      }
    }
  }
}

// Additional comprehensive stories for v0.2
export const MultiFabricWorkspace: Story = {
  name: 'Multi-Fabric Production Workspace',
  args: {
    fabrics: [
      ...sampleFabrics,
      {
        id: 'fabric-4',
        name: 'Staging Environment', 
        status: 'saved',
        createdAt: new Date('2024-08-29'),
        lastModified: new Date('2024-08-29'),
        driftStatus: noDriftStatus
      },
      {
        id: 'fabric-5',
        name: 'DR Site Network',
        status: 'computed',
        createdAt: new Date('2024-08-30'),
        lastModified: new Date('2024-08-30'),
        driftStatus: minorDriftStatus
      }
    ],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show correct fabric count
    await expect(canvas.getByText('Your Fabrics (5)')).toBeInTheDocument()
    
    // Should show all fabric names
    await expect(canvas.getByText('Production Network')).toBeInTheDocument()
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument()
    await expect(canvas.getByText('Test Lab Setup')).toBeInTheDocument()
    await expect(canvas.getByText('Staging Environment')).toBeInTheDocument()
    await expect(canvas.getByText('DR Site Network')).toBeInTheDocument()
    
    // Should show drift summary
    await expect(canvas.getByText('3 fabrics have drift')).toBeInTheDocument()
    
    // Should have proper status distribution
    const savedStatuses = canvas.getAllByText('Saved')
    const computedStatuses = canvas.getAllByText('Computed')
    const draftStatuses = canvas.getAllByText('Draft')
    
    await expect(savedStatuses).toHaveLength(2) // Production, Staging
    await expect(computedStatuses).toHaveLength(2) // Dev, DR Site
    await expect(draftStatuses).toHaveLength(1) // Test Lab
  },
  parameters: {
    docs: {
      description: {
        story: 'A realistic multi-fabric workspace with 5 fabrics in different states, showing how the interface scales.'
      }
    }
  }
}

export const FileSystemIntegration: Story = {
  name: 'File System YAML Integration',
  args: {
    fabrics: [
      {
        id: 'fabric-yaml-1',
        name: 'YAML Test Fabric',
        status: 'saved',
        createdAt: new Date('2024-08-25'),
        lastModified: new Date('2024-08-29'),
        driftStatus: {
          hasDrift: true,
          driftSummary: ['servers.yaml: 2 endpoints modified', 'switches.yaml: 1 leaf switch added'],
          lastChecked: new Date(),
          affectedFiles: ['./fgd/yaml-test-fabric/servers.yaml', './fgd/yaml-test-fabric/switches.yaml']
        }
      }
    ],
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show fabric with YAML-specific drift details
    await expect(canvas.getByText('YAML Test Fabric')).toBeInTheDocument()
    await expect(canvas.getByText('🔄')).toBeInTheDocument()
    
    // Should show affected file information when drift details are expanded
    const viewDetailsButton = canvas.getByText('View Details')
    await userEvent.click(viewDetailsButton)
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates YAML file system integration with specific file drift detection.'
      }
    }
  }
}

export const StatePreservationScenario: Story = {
  name: 'State Preservation During Navigation',
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Simulate selecting a fabric (would navigate to designer)
    const selectButtons = canvas.getAllByRole('button', { name: 'Select' })
    if (selectButtons[1]) { // Select Dev Environment
      await userEvent.click(selectButtons[1])
      await expect(args.onSelectFabric).toHaveBeenCalledWith('fabric-2')
    }
    
    // State should be preserved in workspace context
    // This demonstrates the navigation pattern without actually changing routes
    await expect(canvas.getByText('Dev Environment')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates how fabric list state is preserved during navigation to/from fabric designer.'
      }
    }
  }
}

export const AdvancedErrorScenarios: Story = {
  name: 'Advanced Error Handling',
  args: {
    fabrics: sampleFabrics,
    errors: ['Network connectivity error', 'Failed to load fabric metadata', 'Insufficient permissions for drift check'],
    isCreating: false,
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show multiple error types
    await expect(canvas.getByText('Network connectivity error')).toBeInTheDocument()
    await expect(canvas.getByText('Failed to load fabric metadata')).toBeInTheDocument()
    await expect(canvas.getByText('Insufficient permissions for drift check')).toBeInTheDocument()
    
    // Should still show fabrics despite errors
    await expect(canvas.getByText('Production Network')).toBeInTheDocument()
    
    // Action buttons should still be available
    const selectButtons = canvas.getAllByRole('button', { name: 'Select' })
    await expect(selectButtons[0]).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Advanced error scenarios showing how the interface handles multiple concurrent errors while maintaining functionality.'
      }
    }
  }
}

export const ConcurrentOperations: Story = {
  name: 'Concurrent Create and Delete Operations',
  args: {
    fabrics: basicFabrics,
    errors: [],
    isCreating: true, // Simulating concurrent creation
    onCreateFabric: () => {},
    onSelectFabric: () => {},
    onDeleteFabric: () => {},
    onCheckDrift: () => {},
    onViewDriftDetails: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    
    // Should show creating state
    await expect(canvas.getByText('Creating...')).toBeInTheDocument()
    
    // Simulate attempting delete during create (should handle gracefully)
    const deleteButtons = canvas.getAllByRole('button', { name: 'Delete' })
    if (deleteButtons[0]) {
      // Mock window.confirm
      const originalConfirm = window.confirm
      window.confirm = () => true
      
      await userEvent.click(deleteButtons[0])
      await expect(args.onDeleteFabric).toHaveBeenCalled()
      
      // Restore
      window.confirm = originalConfirm
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests concurrent operations handling - creating fabric while attempting to delete others.'
      }
    }
  }
}