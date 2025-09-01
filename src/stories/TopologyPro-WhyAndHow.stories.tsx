/**
 * Storybook stories for TopologyPro/WhyAndHow validation feedback - WP-TOP2
 * 
 * Demonstrates actionable validation messages with specific remediation guidance
 * that tell users exactly what to fix and why.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { IssuesPanel } from '../ui/IssuesPanel'
import { evaluateTopology } from '../domain/rules'
import type { FabricSpec, DerivedTopology } from '../app.types'
import { useState, useEffect } from 'react'

const meta: Meta<typeof IssuesPanel> = {
  title: 'Validation/TopologyPro WhyAndHow',
  component: IssuesPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Enhanced validation with actionable feedback that provides specific remediation steps for topology issues'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// Mock field click handler
const mockFieldClick = (fieldPath: string) => {
  alert(`Navigate to field: ${fieldPath}`)
}

// Helper to create validation scenarios
function ValidationScenario({ 
  title, 
  spec, 
  derived, 
  description 
}: { 
  title: string
  spec: FabricSpec
  derived: DerivedTopology
  description: string
}) {
  const [validationMessages, setValidationMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const runValidation = async () => {
      setLoading(true)
      try {
        const result = await evaluateTopology(spec, derived, {
          enableIntegrations: false // Disable for Storybook
        })
        setValidationMessages([...result.errors, ...result.warnings, ...result.info])
      } catch (error) {
        console.error('Validation error:', error)
        setValidationMessages([])
      }
      setLoading(false)
    }
    runValidation()
  }, [spec, derived])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Running validation...</div>
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ marginBottom: '1rem', color: '#495057' }}>{title}</h3>
      <p style={{ marginBottom: '1.5rem', color: '#6c757d', fontSize: '0.9rem' }}>
        {description}
      </p>
      <IssuesPanel
        issues={[]}
        validationMessages={validationMessages}
        onFieldClick={mockFieldClick}
      />
    </div>
  )
}

// Story: Spine Capacity Exceeded - Shows specific remediation
export const SpineCapacityExceeded: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'overloaded-spine-fabric',
      spineModelId: 'DS3000', // 32 ports per spine
      leafModelId: 'DS2000',
      uplinksPerLeaf: 8, // High uplink count
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 6,    // 6 leaves × 8 uplinks = 48 uplinks needed
      spinesNeeded: 1,    // 1 spine × 32 ports = 32 capacity
      totalPorts: 320,
      usedPorts: 176,
      oversubscriptionRatio: 2.0,
      isValid: false,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Spine Capacity Exceeded"
        spec={spec}
        derived={derived}
        description="This scenario shows what happens when uplink demand (48 ports) exceeds spine capacity (32 ports). Notice the specific remediation steps provided."
      />
    )
  }
}

// Story: Leaf Capacity Exceeded - Shows endpoint capacity issues
export const LeafCapacityExceeded: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'overloaded-leaf-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000', // 48 ports per leaf
      uplinksPerLeaf: 4,
      endpointCount: 300, // Too many endpoints
      endpointProfile: {
        name: 'server',
        portsPerEndpoint: 1,
        count: 300
      }
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 3,    // 3 leaves × (48-4) = 132 endpoint ports available
      spinesNeeded: 1,    // but 300 endpoints needed
      totalPorts: 192,
      usedPorts: 312,
      oversubscriptionRatio: 2.0,
      isValid: false,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Leaf Capacity Exceeded"
        spec={spec}
        derived={derived}
        description="Endpoint demand exceeds available leaf ports after accounting for uplinks. Shows multiple remediation options."
      />
    )
  }
}

// Story: Uneven Load Distribution - Shows uplink divisibility warning
export const UnevenLoadDistribution: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'uneven-load-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 3, // Not divisible by 2 spines
      endpointCount: 50,
      endpointProfile: {
        name: 'server',
        portsPerEndpoint: 1,
        count: 50
      }
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 2,
      spinesNeeded: 2,    // 3 uplinks % 2 spines = 1 remainder
      totalPorts: 160,
      usedPorts: 62,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Uneven Load Distribution"
        spec={spec}
        derived={derived}
        description="Uplinks per leaf not evenly divisible by spine count causes load imbalance. Shows optimization recommendations."
      />
    )
  }
}

// Story: Multi-Class MC-LAG Issues - Shows advanced configuration problems
export const McLagConfigurationIssue: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'mclag-issue-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      leafClasses: [{
        id: 'compute-class',
        name: 'Compute Leaf Class',
        role: 'standard',
        uplinksPerLeaf: 4,
        count: 3, // Odd number with MC-LAG enabled
        mcLag: true,
        endpointProfiles: [{
          name: 'compute-server',
          portsPerEndpoint: 1,
          count: 20
        }]
      }]
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 3,
      spinesNeeded: 2,
      totalPorts: 208,
      usedPorts: 72,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="MC-LAG Configuration Issue"
        spec={spec}
        derived={derived}
        description="MC-LAG enabled but leaf count is odd (3), leaving one leaf unpaired. Shows pairing requirements and remediation."
      />
    )
  }
}

// Story: ES-LAG Single NIC Warning - Shows endpoint configuration issues
export const EsLagSingleNic: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'eslag-single-nic-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 4,
      endpointCount: 50,
      endpointProfile: {
        name: 'server',
        portsPerEndpoint: 1,
        count: 50,
        esLag: true,
        nics: 1 // Single NIC with ES-LAG enabled
      }
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 2,
      spinesNeeded: 1,
      totalPorts: 128,
      usedPorts: 58,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="ES-LAG Single NIC Issue"
        spec={spec}
        derived={derived}
        description="ES-LAG enabled but endpoints have only 1 NIC. ES-LAG requires multiple NICs for redundancy across leaf switches."
      />
    )
  }
}

// Story: Model Profile Mismatch - Shows compatibility warnings
export const ModelProfileMismatch: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'model-mismatch-fabric',
      spineModelId: 'DS2000', // Leaf model used as spine
      leafModelId: 'DS2000',
      uplinksPerLeaf: 4,
      endpointCount: 40,
      endpointProfile: {
        name: 'storage',
        portsPerEndpoint: 2,
        count: 40,
        type: 'storage'
      }
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 2,
      spinesNeeded: 1,
      totalPorts: 144,
      usedPorts: 88,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Model Profile Mismatch"
        spec={spec}
        derived={derived}
        description="Using DS2000 (server-optimized) as spine switch instead of DS3000 (uplink-optimized). Shows alternative model suggestions."
      />
    )
  }
}

// Story: Complex Multi-Issue Scenario - Shows multiple validation issues
export const MultipleIssues: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'complex-problematic-fabric',
      spineModelId: 'DS2000', // Wrong model for spine
      leafModelId: 'DS2000',
      leafClasses: [{
        id: 'problematic-class',
        name: 'Problematic Leaf Class',
        role: 'standard',
        uplinksPerLeaf: 7, // Not divisible by 2 spines
        count: 1, // Single leaf with MC-LAG
        mcLag: true,
        endpointProfiles: [{
          name: 'problematic-server',
          portsPerEndpoint: 2,
          count: 100, // Too many endpoints
          esLag: true,
          nics: 1 // Single NIC with ES-LAG
        }]
      }]
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 1,
      spinesNeeded: 2,
      totalPorts: 96,
      usedPorts: 207,
      oversubscriptionRatio: 2.0,
      isValid: false,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Multiple Validation Issues"
        spec={spec}
        derived={derived}
        description="A fabric with multiple issues: wrong spine model, uneven uplink distribution, MC-LAG with single leaf, ES-LAG with single NIC, and capacity exceeded."
      />
    )
  }
}

// Story: Success Case - Shows what good validation looks like
export const WellConfiguredFabric: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'well-configured-fabric',
      spineModelId: 'DS3000', // Correct spine model
      leafModelId: 'DS2000',   // Correct leaf model
      leafClasses: [{
        id: 'compute-class',
        name: 'Compute Leaf Class',
        role: 'standard',
        uplinksPerLeaf: 4, // Divisible by 2 spines
        count: 4,          // Even number for MC-LAG
        mcLag: true,
        endpointProfiles: [{
          name: 'compute-server',
          portsPerEndpoint: 1,
          count: 20, // Reasonable endpoint count
          esLag: true,
          nics: 2    // Multiple NICs for ES-LAG
        }]
      }]
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 4,
      spinesNeeded: 2,
      totalPorts: 256,
      usedPorts: 96,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <ValidationScenario
        title="Well-Configured Fabric (Success Case)"
        spec={spec}
        derived={derived}
        description="A properly configured fabric with no validation issues. Should show 'All Clear' status with no remediation needed."
      />
    )
  }
}

// Story: Field Navigation Demo - Shows how field links work
export const FieldNavigationDemo: Story = {
  render: () => {
    const [lastClickedField, setLastClickedField] = useState<string>('')
    
    const handleFieldClick = (fieldPath: string) => {
      setLastClickedField(fieldPath)
      // In real app, this would navigate to the actual field
    }
    
    const spec: FabricSpec = {
      name: 'navigation-demo-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      uplinksPerLeaf: 10, // Cause spine capacity issue
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 4,
      spinesNeeded: 1,
      totalPorts: 224,
      usedPorts: 40,
      oversubscriptionRatio: 2.0,
      isValid: false,
      validationErrors: [],
      guards: []
    }

    return (
      <div>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '4px', 
          marginBottom: '1rem',
          border: '1px solid #b3d7ff'
        }}>
          <strong>Interactive Demo:</strong> Click on field buttons in the validation messages below to see navigation in action.
          {lastClickedField && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              <strong>Last clicked field:</strong> <code>{lastClickedField}</code>
            </div>
          )}
        </div>
        
        <ValidationScenario
          title="Field Navigation Demo"
          spec={spec}
          derived={derived}
          description="Click on the blue field buttons to see how users can navigate directly to problem areas in the UI."
        />
      </div>
    )
  }
}

// Story: Documentation Links Demo - Shows contextual help
export const DocumentationLinksDemo: Story = {
  render: () => {
    const spec: FabricSpec = {
      name: 'documentation-demo-fabric',
      spineModelId: 'DS3000',
      leafModelId: 'DS2000',
      leafClasses: [{
        id: 'lag-demo-class',
        name: 'LAG Demo Class',
        role: 'standard',
        uplinksPerLeaf: 4,
        count: 3, // Odd count to trigger MC-LAG warning
        mcLag: true,
        endpointProfiles: [{
          name: 'lag-endpoint',
          portsPerEndpoint: 1,
          count: 20,
          esLag: true,
          nics: 1 // Single NIC to trigger ES-LAG warning
        }]
      }]
    }
    
    const derived: DerivedTopology = {
      leavesNeeded: 3,
      spinesNeeded: 1,
      totalPorts: 176,
      usedPorts: 72,
      oversubscriptionRatio: 2.0,
      isValid: true,
      validationErrors: [],
      guards: []
    }

    return (
      <div>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3cd', 
          borderRadius: '4px', 
          marginBottom: '1rem',
          border: '1px solid #ffeaa7'
        }}>
          <strong>Documentation Links:</strong> LAG-related validation messages include links to GitHedgehog documentation for additional context and learning.
        </div>
        
        <ValidationScenario
          title="Documentation Links Demo"
          spec={spec}
          derived={derived}
          description="Notice the documentation links that appear for LAG-related issues, providing additional learning resources."
        />
      </div>
    )
  }
}