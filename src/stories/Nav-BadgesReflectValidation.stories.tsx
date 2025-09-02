/**
 * Navigation Stories - WP-NAV1
 * Status badges reflect real-time validation state
 */

import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import StatusBadge, { ValidationBadge, ValidationIssue, getBadgeForIssues } from '../components/gfd/StatusBadge'

const meta: Meta<typeof StatusBadge> = {
  title: 'Navigation/BadgesReflectValidation',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Status badges that reflect real-time validation state with priority system'
      }
    }
  },
  argTypes: {
    badge: {
      control: 'select',
      options: ['ok', 'warning', 'error', 'pending', 'loading'],
      description: 'Badge type to display'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Badge size'
    },
    showTooltip: {
      control: 'boolean',
      description: 'Show tooltip on hover'
    }
  }
}

export default meta
type Story = StoryObj<typeof StatusBadge>

// Sample validation issues for testing
const sampleErrorIssues: ValidationIssue[] = [
  { type: 'error', message: 'Switch model not selected', field: 'switchModel' },
  { type: 'error', message: 'Invalid endpoint count', field: 'endpointCount', suggestion: 'Set count between 1 and 1000' }
]

const sampleWarningIssues: ValidationIssue[] = [
  { type: 'warning', message: 'High endpoint count may impact performance', suggestion: 'Consider splitting into multiple fabrics' },
  { type: 'warning', message: 'MC-LAG recommended for redundancy', field: 'lagConfig' }
]

const sampleMixedIssues: ValidationIssue[] = [
  { type: 'error', message: 'Border capability mismatch' },
  { type: 'warning', message: 'Suboptimal topology detected' },
  { type: 'info', message: 'Using default spine count' }
]

// Basic badge states
export const AllBadgeStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="ok" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Success</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="warning" issues={sampleWarningIssues} />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Warning (2)</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="error" issues={sampleErrorIssues} />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Error (2)</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="pending" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Pending</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="loading" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Loading</div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify all badge types are rendered
    expect(canvas.getByText('✓')).toBeInTheDocument()  // Success
    expect(canvas.getByText('⚠')).toBeInTheDocument()   // Warning  
    expect(canvas.getByText('✖')).toBeInTheDocument()   // Error
    expect(canvas.getByText('○')).toBeInTheDocument()   // Pending
    expect(canvas.getByText('⟳')).toBeInTheDocument()   // Loading
    
    // Verify issue counts are shown
    expect(canvas.getByText('2')).toBeInTheDocument() // Error count
  }
}

// Badge sizes
export const BadgeSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="error" issues={sampleErrorIssues} size="sm" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Small</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="error" issues={sampleErrorIssues} size="md" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Medium</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="error" issues={sampleErrorIssues} size="lg" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Large</div>
      </div>
    </div>
  )
}

// Real-time validation demonstration
export const RealTimeValidation: Story = {
  render: () => {
    const [fabricName, setFabricName] = React.useState('')
    const [endpointCount, setEndpointCount] = React.useState('')
    
    // Compute validation issues based on current input
    const computeIssues = (): ValidationIssue[] => {
      const issues: ValidationIssue[] = []
      
      if (!fabricName.trim()) {
        issues.push({ type: 'error', message: 'Fabric name is required', field: 'name' })
      } else if (fabricName.length < 3) {
        issues.push({ type: 'warning', message: 'Fabric name should be at least 3 characters', field: 'name' })
      }
      
      const count = parseInt(endpointCount)
      if (!endpointCount) {
        issues.push({ type: 'error', message: 'Endpoint count is required', field: 'endpointCount' })
      } else if (count <= 0) {
        issues.push({ type: 'error', message: 'Endpoint count must be positive', field: 'endpointCount' })
      } else if (count > 500) {
        issues.push({ type: 'warning', message: 'High endpoint count may impact performance', field: 'endpointCount', suggestion: 'Consider splitting into multiple fabrics' })
      }
      
      return issues
    }
    
    const issues = computeIssues()
    const badge = getBadgeForIssues(issues)
    
    return (
      <div style={{ maxWidth: '600px', padding: '2rem' }}>
        <h3>Real-time Validation Demo</h3>
        <p>Badges update immediately as you type:</p>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Fabric Name:
            <input
              type="text"
              value={fabricName}
              onChange={(e) => setFabricName(e.target.value)}
              placeholder="my-fabric"
              style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Endpoint Count:
            <input
              type="number"
              value={endpointCount}
              onChange={(e) => setEndpointCount(e.target.value)}
              placeholder="100"
              style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
            />
          </label>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
          <StatusBadge badge={badge} issues={issues} size="md" />
          <div>
            <strong>Validation Status:</strong> {badge.toUpperCase()}
            {issues.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                {issues.map((issue, i) => (
                  <div key={i} style={{ color: issue.type === 'error' ? '#d32f2f' : '#ed6c02', fontSize: '0.875rem' }}>
                    {issue.type === 'error' ? '❌' : '⚠️'} {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Initially should show errors for empty fields
    expect(canvas.getByText('✖')).toBeInTheDocument()
    
    // Fill in fabric name
    const nameInput = canvas.getByPlaceholderText('my-fabric')
    await userEvent.type(nameInput, 'test-fabric')
    
    // Badge should still show error for missing endpoint count
    expect(canvas.getByText('✖')).toBeInTheDocument()
    
    // Fill in endpoint count
    const countInput = canvas.getByPlaceholderText('100')
    await userEvent.type(countInput, '100')
    
    // Badge should now show success
    expect(canvas.getByText('✓')).toBeInTheDocument()
    
    // Test high endpoint count warning
    await userEvent.clear(countInput)
    await userEvent.type(countInput, '600')
    
    // Should show warning badge
    expect(canvas.getByText('⚠')).toBeInTheDocument()
  }
}

// Badge priority system
export const BadgePriority: Story = {
  render: () => (
    <div style={{ maxWidth: '800px', padding: '2rem' }}>
      <h3>Badge Priority System</h3>
      <p>When multiple issue types exist, the highest priority badge is shown:</p>
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', minWidth: '200px' }}>
          <h4>Mixed Issues</h4>
          <StatusBadge badge={getBadgeForIssues(sampleMixedIssues)} issues={sampleMixedIssues} />
          <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <div>1 Error (highest priority)</div>
            <div>1 Warning</div>
            <div>1 Info</div>
            <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Shows: ERROR badge</div>
          </div>
        </div>
        
        <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', minWidth: '200px' }}>
          <h4>Warnings Only</h4>
          <StatusBadge badge={getBadgeForIssues(sampleWarningIssues)} issues={sampleWarningIssues} />
          <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <div>2 Warnings</div>
            <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Shows: WARNING badge</div>
          </div>
        </div>
        
        <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', minWidth: '200px' }}>
          <h4>No Issues</h4>
          <StatusBadge badge={getBadgeForIssues([])} issues={[]} />
          <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <div>0 Issues</div>
            <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Shows: SUCCESS badge</div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
        <h4>Priority Order (highest to lowest):</h4>
        <ol>
          <li><strong>Error</strong> - Must be resolved before proceeding</li>
          <li><strong>Warning</strong> - Should be addressed but not blocking</li>
          <li><strong>Loading</strong> - Processing in progress</li>
          <li><strong>Success</strong> - All validations passed</li>
          <li><strong>Pending</strong> - Not yet validated</li>
        </ol>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify priority system shows error badge for mixed issues
    const mixedIssuesBadge = canvas.getAllByText('✖')[0]
    expect(mixedIssuesBadge).toBeInTheDocument()
    
    // Verify warning badge for warning-only issues  
    const warningBadge = canvas.getByText('⚠')
    expect(warningBadge).toBeInTheDocument()
    
    // Verify success badge for no issues
    const successBadge = canvas.getByText('✓')
    expect(successBadge).toBeInTheDocument()
  }
}

// Tooltip behavior
export const TooltipBehavior: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="error" issues={sampleErrorIssues} showTooltip={true} />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>With Tooltip</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StatusBadge badge="warning" issues={sampleWarningIssues} showTooltip={false} />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>No Tooltip</div>
      </div>
    </div>
  )
}

// Loading animation
export const LoadingAnimation: Story = {
  args: {
    badge: 'loading',
    size: 'lg'
  },
  render: (args) => (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <StatusBadge {...args} />
      <div style={{ marginTop: '1rem' }}>Loading badge should rotate continuously</div>
    </div>
  )
}