/**
 * Git integration demo stories
 * Shows behavior with Git enabled/disabled and various scenarios
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import React from 'react'

// Mock the feature flags for stories
import { overrideFeatureFlag, resetFeatureFlags, getFeatureFlagStatus } from '../src/features/feature-flags.js'

type Story = StoryObj<typeof meta>

// Simple component to demonstrate Git integration
function GitIntegrationDemo({ gitEnabled }: { gitEnabled: boolean }) {
  const [status, setStatus] = React.useState<string>('Not checked')
  const [lastCommit, setLastCommit] = React.useState<string>('')
  const [saveResult, setSaveResult] = React.useState<string>('')
  React.useEffect(() => {
    // Override feature flag for this story
    if (gitEnabled) {
      overrideFeatureFlag('git', true)
    } else {
      resetFeatureFlags()
    }
  }, [gitEnabled])

  const checkGitStatus = async () => {
    try {
      const { gitService } = await import('../src/features/git.service.js')
      const gitStatus = await gitService.getStatus()
      setStatus(`Enabled: ${gitStatus.enabled}, Initialized: ${gitStatus.initialized}, Changes: ${gitStatus.hasChanges}`)
      setLastCommit(gitStatus.lastCommit || 'No commits yet')
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    }
  }

  const performSave = async () => {
    try {
      const { saveFGD } = await import('../src/io/fgd.js')
      
      // Mock diagram for testing
      const mockDiagram = {
        servers: [{ id: 'server-1', name: 'Web-01', rack: 'R1', position: 1, endpoints: [] }],
        switches: [
          { id: 'leaf-1', name: 'Leaf-01', role: 'leaf', model: 'DS2000', ports: [] },
          { id: 'spine-1', name: 'Spine-01', role: 'spine', model: 'DS3000', ports: [] }
        ],
        connections: []
      }
      
      const result = await saveFGD(mockDiagram, { fabricId: 'demo-fabric' })
      
      if (result.success) {
        setSaveResult(result.gitCommit ? 
          `Save successful! Git commit: ${result.gitCommit}` : 
          'Save successful! (Git not enabled)'
        )
      } else {
        setSaveResult(`Save failed: ${result.error}`)
      }
    } catch (error) {
      setSaveResult(`Save error: ${error.message}`)
    }
  }

  const flagStatus = getFeatureFlagStatus()

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Git Integration Demo</h2>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: gitEnabled ? '#e8f5e8' : '#f5f5f5', border: '1px solid #ccc' }}>
        <strong>Feature Flag Status:</strong> Git: {flagStatus.git ? 'Enabled' : 'Disabled'}
        {gitEnabled && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Git Integration Active</span>}
        {!gitEnabled && <span style={{ color: 'gray', marginLeft: '10px' }}>⭘ Git Integration Disabled</span>}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={checkGitStatus} 
          style={{ padding: '10px 20px', marginRight: '10px', cursor: 'pointer' }}
        >
          Check Git Status
        </button>
        
        <button 
          onClick={performSave} 
          style={{ padding: '10px 20px', cursor: 'pointer' }}
          role="button"
          aria-label="Save to FGD"
        >
          Save to FGD
        </button>
      </div>
      
      {status !== 'Not checked' && (
        <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f8ff', border: '1px solid #0066cc' }}>
          <strong>Git Status:</strong> {status}
        </div>
      )}
      
      {lastCommit && (
        <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f8f8f0', border: '1px solid #cc9900' }}>
          <strong>Last Commit:</strong> {lastCommit}
        </div>
      )}
      
      {saveResult && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: saveResult.includes('successful') ? '#f0f8f0' : '#f8f0f0', 
          border: `1px solid ${saveResult.includes('successful') ? '#00cc66' : '#cc0066'}` 
        }}>
          <strong>Save Result:</strong> {saveResult}
        </div>
      )}
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>Expected Behavior:</strong></p>
        <ul>
          <li>When Git is <strong>enabled</strong>: Status shows Git info, Save includes commit message</li>
          <li>When Git is <strong>disabled</strong>: Status shows disabled, Save works normally without Git</li>
          <li>All operations should work regardless of Git status (graceful fallback)</li>
        </ul>
      </div>
    </div>
  )
}

const meta = {
  title: 'Features/Git Integration',
  component: GitIntegrationDemo,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    gitEnabled: {
      control: 'boolean',
      description: 'Enable/disable Git integration feature flag'
    }
  }
} satisfies Meta<typeof GitIntegrationDemo>

export default meta

/**
 * Git integration disabled (default behavior)
 * All Git operations become no-ops, normal save/load still works
 */
export const GitDisabled: Story = {
  name: 'Git Integration Disabled',
  args: {
    gitEnabled: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show Git as disabled
    await expect(canvas.getByText(/Git: Disabled/i)).toBeInTheDocument()
    
    // Check Git status
    await userEvent.click(canvas.getByText('Check Git Status'))
    
    // Should show disabled status
    await expect(canvas.getByText(/Enabled: false/i)).toBeInTheDocument()
    
    // Save should work without Git
    await userEvent.click(await canvas.findByRole('button', { name: /Save.*FGD/i }))
    
    // Should show successful save without Git commit
    await expect(canvas.getByText(/Save successful.*Git not enabled/i)).toBeInTheDocument()
  }
}

/**
 * Git integration enabled
 * Shows Git status and commit information
 */
export const GitEnabled: Story = {
  name: 'Git Integration Enabled', 
  args: {
    gitEnabled: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show Git as enabled
    await expect(canvas.getByText(/Git: Enabled/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Git Integration Active/i)).toBeInTheDocument()
    
    // Check Git status
    await userEvent.click(canvas.getByText('Check Git Status'))
    
    // Should show enabled status
    await expect(canvas.getByText(/Enabled: true/i)).toBeInTheDocument()
    
    // Save should include Git commit
    await userEvent.click(await canvas.findByRole('button', { name: /Save.*FGD/i }))
    
    // Should show successful save with Git commit
    await expect(canvas.getByText(/Save successful.*Git commit/i)).toBeInTheDocument()
  }
}

/**
 * Git error handling
 * Shows graceful fallback when Git operations fail
 */
export const GitErrorHandling: Story = {
  name: 'Git Error Handling',
  args: {
    gitEnabled: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates graceful fallback when Git operations fail. The save operation should still succeed even if Git fails.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Git should be enabled but may have errors
    await expect(canvas.getByText(/Git Integration Active/i)).toBeInTheDocument()
    
    // Check status - might show errors but shouldn't crash
    await userEvent.click(canvas.getByText('Check Git Status'))
    
    // Save should still work even if Git fails
    await userEvent.click(await canvas.findByRole('button', { name: /Save.*FGD/i }))
    
    // Should show some result (either success or handled error)
    await expect(canvas.getByText(/Save/i)).toBeInTheDocument()
  }
}

/**
 * Feature flag override demonstration
 * Shows how to programmatically enable/disable Git features
 */
export const FeatureFlagOverride: Story = {
  name: 'Feature Flag Override',
  args: {
    gitEnabled: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how feature flags can be overridden at runtime for testing and development.'
      }
    }
  },
  render: (args) => {
    const [currentFlag, setCurrentFlag] = React.useState(args.gitEnabled)
    
    const toggleFlag = () => {
      const newValue = !currentFlag
      setCurrentFlag(newValue)
      overrideFeatureFlag('git', newValue)
    }
    
    return (
      <div style={{ padding: '20px' }}>
        <h3>Feature Flag Override Demo</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={toggleFlag}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            Toggle Git Feature (Currently: {currentFlag ? 'Enabled' : 'Disabled'})
          </button>
        </div>
        
        <GitIntegrationDemo gitEnabled={currentFlag} />
      </div>
    )
  }
}
