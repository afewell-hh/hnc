import type { Meta, StoryObj } from '@storybook/react'
import { DriftIndicator } from '../drift/DriftIndicator.js'
import { DriftSection } from '../drift/DriftSection.js'
import { DriftBadge } from '../drift/DriftBadge.js'
import { DriftListView } from '../drift/DriftListView.js'
import type { DriftStatus } from '../drift/types.js'

// Sample drift status data
const noDriftStatus: DriftStatus = {
  hasDrift: false,
  driftSummary: ['No drift detected - in-memory topology matches files on disk'],
  lastChecked: new Date(),
  affectedFiles: []
}

const minorDriftStatus: DriftStatus = {
  hasDrift: true,
  driftSummary: [
    'switches: 1 modified',
    'connections: 2 added'
  ],
  lastChecked: new Date(),
  affectedFiles: [
    './fgd/test-fabric/switches.yaml',
    './fgd/test-fabric/connections.yaml'
  ]
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

// Mock functions for interactive stories
const mockFunctions = {
  onRefreshDrift: () => console.log('Refreshing drift...'),
  onShowDetails: () => console.log('Showing drift details...'),
  onClick: () => console.log('Drift indicator clicked'),
  onGetDriftStatus: async (fabricId: string) => {
    console.log(`Getting drift status for ${fabricId}`)
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Return different drift statuses based on fabric ID
    if (fabricId.includes('drift')) return majorDriftStatus
    if (fabricId.includes('minor')) return minorDriftStatus
    return noDriftStatus
  },
  onSelectFabric: (fabricId: string) => console.log(`Selecting fabric: ${fabricId}`)
}

// Meta configuration
const meta: Meta<typeof DriftIndicator> = {
  title: 'Drift/FabricDriftStatus',
  component: DriftIndicator,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Components for displaying fabric drift status and detection results'
      }
    }
  }
}

export default meta

// Drift Indicator Stories
type DriftIndicatorStory = StoryObj<typeof DriftIndicator>

export const IndicatorNoDrift: DriftIndicatorStory = {
  name: 'Indicator - No Drift',
  args: {
    driftStatus: noDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}

export const IndicatorMinorDrift: DriftIndicatorStory = {
  name: 'Indicator - Minor Drift',
  args: {
    driftStatus: minorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}

export const IndicatorMajorDrift: DriftIndicatorStory = {
  name: 'Indicator - Major Drift',
  args: {
    driftStatus: majorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick
  }
}

export const IndicatorChecking: DriftIndicatorStory = {
  name: 'Indicator - Checking',
  args: {
    driftStatus: null,
    isChecking: true,
    onClick: mockFunctions.onClick,
    compact: true
  }
}

export const IndicatorCompact: DriftIndicatorStory = {
  name: 'Indicator - Compact Mode',
  args: {
    driftStatus: minorDriftStatus,
    isChecking: false,
    onClick: mockFunctions.onClick,
    compact: true
  }
}

// Drift Badge Stories
type DriftBadgeStory = StoryObj<typeof DriftBadge>

export const BadgeNoDrift: DriftBadgeStory = {
  name: 'Badge - No Drift',
  render: () => (
    <DriftBadge 
      driftCount={0} 
      onClick={mockFunctions.onClick}
    />
  )
}

export const BadgeSingleFabric: DriftBadgeStory = {
  name: 'Badge - Single Fabric',
  render: () => (
    <DriftBadge 
      driftCount={1} 
      onClick={mockFunctions.onClick}
    />
  )
}

export const BadgeMultipleFabrics: DriftBadgeStory = {
  name: 'Badge - Multiple Fabrics',
  render: () => (
    <DriftBadge 
      driftCount={3} 
      onClick={mockFunctions.onClick}
    />
  )
}

// Drift Section Stories
type DriftSectionStory = StoryObj<typeof DriftSection>

export const SectionNoDriftStatus: DriftSectionStory = {
  name: 'Section - No Status',
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <DriftSection
        fabricId="test-fabric"
        driftStatus={null}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
        isRefreshing={false}
      />
    </div>
  )
}

export const SectionNoDrift: DriftSectionStory = {
  name: 'Section - No Drift',
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <DriftSection
        fabricId="test-fabric"
        driftStatus={noDriftStatus}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
        isRefreshing={false}
      />
    </div>
  )
}

export const SectionMinorDrift: DriftSectionStory = {
  name: 'Section - Minor Drift',
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <DriftSection
        fabricId="test-fabric"
        driftStatus={minorDriftStatus}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
        isRefreshing={false}
      />
    </div>
  )
}

export const SectionMajorDrift: DriftSectionStory = {
  name: 'Section - Major Drift',
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <DriftSection
        fabricId="prod-fabric"
        driftStatus={majorDriftStatus}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
        isRefreshing={false}
      />
    </div>
  )
}

export const SectionRefreshing: DriftSectionStory = {
  name: 'Section - Refreshing',
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <DriftSection
        fabricId="test-fabric"
        driftStatus={minorDriftStatus}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
        isRefreshing={true}
      />
    </div>
  )
}

// Drift List View Stories
type DriftListViewStory = StoryObj<typeof DriftListView>

export const ListView: DriftListViewStory = {
  name: 'List View - Multiple Fabrics',
  render: () => (
    <div style={{ maxWidth: '800px' }}>
      <DriftListView
        fabrics={[
          { id: 'fabric-with-drift', name: 'Production Fabric' },
          { id: 'fabric-minor-drift', name: 'Staging Fabric' },
          { id: 'fabric-clean', name: 'Development Fabric' },
          { id: 'fabric-unchecked', name: 'Test Fabric' }
        ]}
        onGetDriftStatus={mockFunctions.onGetDriftStatus}
        onSelectFabric={mockFunctions.onSelectFabric}
      />
    </div>
  )
}

export const ListViewEmpty: DriftListViewStory = {
  name: 'List View - No Fabrics',
  render: () => (
    <div style={{ maxWidth: '800px' }}>
      <DriftListView
        fabrics={[]}
        onGetDriftStatus={mockFunctions.onGetDriftStatus}
        onSelectFabric={mockFunctions.onSelectFabric}
      />
    </div>
  )
}

// Combined Demo Story
export const CombinedDemo: DriftSectionStory = {
  name: 'Combined Demo',
  render: () => (
    <div style={{ maxWidth: '800px', padding: '1rem' }}>
      <h2>Drift Detection Components Demo</h2>
      
      <h3>Workspace Badge</h3>
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <DriftBadge driftCount={2} onClick={mockFunctions.onClick} />
      </div>
      
      <h3>Fabric Card Indicators</h3>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          No drift: <DriftIndicator driftStatus={noDriftStatus} compact />
        </div>
        <div style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          Minor drift: <DriftIndicator driftStatus={minorDriftStatus} compact />
        </div>
        <div style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          Checking: <DriftIndicator driftStatus={null} isChecking compact />
        </div>
      </div>
      
      <h3>Fabric Designer Section</h3>
      <DriftSection
        fabricId="demo-fabric"
        driftStatus={majorDriftStatus}
        onRefreshDrift={mockFunctions.onRefreshDrift}
        onShowDetails={mockFunctions.onShowDetails}
      />
    </div>
  )
}