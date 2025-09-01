import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { BulkOperationsPanel } from '../components/BulkOperationsPanel'
import { FabricSpec } from '../app.types'

const mockFabricSpec: FabricSpec = {
  name: 'demo-fabric',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  leafClasses: [
    {
      id: 'web-tier',
      name: 'Web Tier',
      role: 'standard',
      uplinksPerLeaf: 4,
      count: 2,
      endpointProfiles: [
        {
          name: 'server-web-frontend',
          portsPerEndpoint: 2,
          type: 'server',
          count: 16
        }
      ]
    },
    {
      id: 'app-tier',
      name: 'Application Tier', 
      role: 'standard',
      uplinksPerLeaf: 4,
      count: 2,
      endpointProfiles: [
        {
          name: 'server-app-java',
          portsPerEndpoint: 2,
          type: 'server',
          count: 24
        }
      ]
    }
  ]
}

const BulkOperationsWrapper: React.FC<{ fabricSpec: FabricSpec; disabled?: boolean }> = ({ 
  fabricSpec, 
  disabled = false 
}) => {
  const [currentSpec, setCurrentSpec] = useState(fabricSpec)

  const handleApplyChanges = (modifiedSpec: FabricSpec) => {
    setCurrentSpec(modifiedSpec)
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <BulkOperationsPanel
        fabricSpec={currentSpec}
        onApplyChanges={handleApplyChanges}
        disabled={disabled}
      />
    </div>
  )
}

const meta: Meta<typeof BulkOperationsWrapper> = {
  title: 'Features/BulkOperations',
  component: BulkOperationsWrapper,
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof BulkOperationsWrapper>

export const PatternBasedRenaming: Story = {
  args: {
    fabricSpec: mockFabricSpec,
    disabled: false
  }
}

export const ClassReassignmentScenario: Story = {
  args: {
    fabricSpec: mockFabricSpec,
    disabled: false
  }
}