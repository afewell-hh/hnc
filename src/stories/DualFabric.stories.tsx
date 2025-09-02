/**
 * WP-GPU1: Dual-Fabric Storybook Stories
 * 
 * Comprehensive test stories for GPU/AI dual-fabric scenarios.
 * Covers basic functionality, scalability, error handling, and determinism validation.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { within, expect, userEvent } from '@storybook/test'
import { DualFabricEditor } from '../components/gfd/DualFabricEditor'
import { createDualFabricTemplate, type DualFabricSpec } from '../domain/dual-fabric'

const meta: Meta<typeof DualFabricEditor> = {
  title: 'WP-GPU1/Dual-Fabric Scenarios',
  component: DualFabricEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Dual-fabric configuration for GPU/AI use cases with shared server NICs'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// ====================================================================
// GPU/SMALL STORY - Basic dual-fabric scenario
// ====================================================================

const gpuSmallSpec: DualFabricSpec = {
  id: 'gpu-small-test',
  name: 'GPU Small Cluster',
  mode: 'dual-fabric',
  frontend: {
    name: 'Compute Fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'compute-leaf',
      name: 'Compute Leaf',
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [{
        name: 'GPU Server',
        portsPerEndpoint: 2,
        type: 'compute',
        bandwidth: 25,
        count: 8
      }]
    }]
  },
  backend: {
    name: 'Storage Fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'storage-leaf',
      name: 'Storage Leaf',
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [{
        name: 'Storage Server',
        portsPerEndpoint: 2,
        type: 'storage',
        bandwidth: 100,
        count: 8
      }]
    }]
  },
  sharedServers: Array.from({ length: 8 }, (_, i) => ({
    id: `gpu-node-${i + 1}`,
    name: `GPU-Node-${String(i + 1).padStart(2, '0')}`,
    totalNics: 4,
    serverType: 'gpu-compute' as const,
    nicAllocations: [
      {
        nicCount: 2,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'compute' as const
      },
      {
        nicCount: 2,
        nicSpeed: '100G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  })),
  metadata: {
    createdAt: new Date(),
    version: '1.0.0',
    useCase: 'ai-training'
  }
} as DualFabricSpec

export const GPUSmall: Story = {
  args: {
    spec: gpuSmallSpec,
    validationErrors: [],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify basic dual-fabric configuration loaded
    await expect(canvas.getByText('GPU Small Cluster')).toBeInTheDocument()
    await expect(canvas.getByText('Compute Fabric')).toBeInTheDocument()
    await expect(canvas.getByText('Storage Fabric')).toBeInTheDocument()
    
    // Check shared servers are displayed
    await expect(canvas.getByText('8')).toBeInTheDocument() // Server count
    
    // Verify NIC conservation
    const nicBadges = canvas.getAllByText(/F: 2|B: 2/)
    expect(nicBadges).toHaveLength(16) // 8 servers × 2 badges each
    
    // Test server selection and NIC allocation viewing
    const firstServer = canvas.getByText('GPU-Node-01')
    await userEvent.click(firstServer)
    
    // Verify NIC allocation editor appears
    await expect(canvas.getByText('NIC Allocation - GPU-Node-01')).toBeInTheDocument()
    
    // Verify validation status
    await expect(canvas.getByText('Valid')).toBeInTheDocument()
    
    // Test fabric tab navigation
    await userEvent.click(canvas.getByText('Frontend Fabric'))
    await expect(canvas.getByText('Frontend Fabric Configuration')).toBeInTheDocument()
    
    await userEvent.click(canvas.getByText('Backend Fabric'))
    await expect(canvas.getByText('Backend Fabric Configuration')).toBeInTheDocument()
  }
}

// ====================================================================
// GPU/SCALE-UP STORY - Scalability scenario (8→32 servers)
// ====================================================================

const gpuScaleUpSpec: DualFabricSpec = {
  ...gpuSmallSpec,
  id: 'gpu-scale-up-test',
  name: 'GPU Scale-Up Cluster',
  sharedServers: Array.from({ length: 32 }, (_, i) => ({
    id: `gpu-node-${i + 1}`,
    name: `GPU-Node-${String(i + 1).padStart(2, '0')}`,
    totalNics: 6,
    serverType: 'gpu-compute' as const,
    nicAllocations: [
      {
        nicCount: 4,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'gpu-interconnect' as const
      },
      {
        nicCount: 2,
        nicSpeed: '100G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  }))
}

export const GPUScaleUp: Story = {
  args: {
    spec: gpuScaleUpSpec,
    validationErrors: [],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify scaled configuration
    await expect(canvas.getByText('GPU Scale-Up Cluster')).toBeInTheDocument()
    await expect(canvas.getByText('32')).toBeInTheDocument() // Server count
    
    // Verify higher NIC utilization
    const frontendNics = canvas.getByText('128') // 32 servers × 4 NICs
    await expect(frontendNics).toBeInTheDocument()
    
    const backendNics = canvas.getByText('64') // 32 servers × 2 NICs  
    await expect(backendNics).toBeInTheDocument()
    
    // Test server selection works with larger scale
    const randomServer = canvas.getByText('GPU-Node-16')
    await userEvent.click(randomServer)
    
    await expect(canvas.getByText('NIC Allocation - GPU-Node-16')).toBeInTheDocument()
    
    // Verify consistent server IDs and deterministic ordering
    const serverElements = canvas.getAllByText(/GPU-Node-\d{2}/)
    expect(serverElements.length).toBeGreaterThan(0)
    
    // Test validation with larger scale
    await userEvent.click(canvas.getByText('Validation'))
    await expect(canvas.getByText('Overall Validation Status')).toBeInTheDocument()
  }
}

// ====================================================================
// GPU/INVALID-NIC-MAPPING STORY - Error scenarios
// ====================================================================

const gpuInvalidNicSpec: DualFabricSpec = {
  ...gpuSmallSpec,
  id: 'gpu-invalid-nic-test',
  name: 'GPU Invalid NIC Mapping',
  sharedServers: [
    // Over-allocated server
    {
      id: 'over-allocated-server',
      name: 'Over-Allocated-Server',
      totalNics: 4,
      serverType: 'gpu-compute',
      nicAllocations: [
        {
          nicCount: 3,
          nicSpeed: '25G',
          targetFabric: 'frontend',
          purpose: 'compute'
        },
        {
          nicCount: 3, // Total = 6, but only 4 NICs available
          nicSpeed: '100G',
          targetFabric: 'backend',
          purpose: 'storage'
        }
      ]
    },
    // Under-allocated server
    {
      id: 'under-allocated-server',
      name: 'Under-Allocated-Server',
      totalNics: 6,
      serverType: 'gpu-compute',
      nicAllocations: [
        {
          nicCount: 2, // Only 2 of 6 NICs allocated
          nicSpeed: '25G',
          targetFabric: 'frontend',
          purpose: 'compute'
        }
      ]
    },
    // Zero allocation server
    {
      id: 'zero-allocation-server',
      name: 'Zero-Allocation-Server',
      totalNics: 4,
      serverType: 'gpu-compute',
      nicAllocations: []
    }
  ]
}

export const GPUInvalidNICMapping: Story = {
  args: {
    spec: gpuInvalidNicSpec,
    validationErrors: [
      'Server Over-Allocated-Server: Over-allocated by 2 NICs',
      'Server Under-Allocated-Server has 4 unallocated NICs',
      'Server Zero-Allocation-Server has no NIC allocations'
    ],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify error state is displayed
    await expect(canvas.getByText('GPU Invalid NIC Mapping')).toBeInTheDocument()
    
    // Check for validation error alerts
    const errorAlerts = canvas.getAllByText(/Validation Errors/)
    expect(errorAlerts.length).toBeGreaterThan(0)
    
    // Verify specific error messages
    await expect(canvas.getByText(/Over-allocated by 2 NICs/)).toBeInTheDocument()
    await expect(canvas.getByText(/unallocated NICs/)).toBeInTheDocument()
    
    // Check that validation status shows invalid
    const invalidBadges = canvas.getAllByText('Invalid')
    expect(invalidBadges.length).toBeGreaterThan(0)
    
    // Test server with over-allocation
    const overAllocatedServer = canvas.getByText('Over-Allocated-Server')
    await userEvent.click(overAllocatedServer)
    
    // Verify error details in NIC allocation editor
    await expect(canvas.getByText(/Over-allocated/)).toBeInTheDocument()
    
    // Test validation panel
    await userEvent.click(canvas.getByText('Validation'))
    await expect(canvas.getByText('FAILED')).toBeInTheDocument()
    
    // Verify recommendations are provided
    await expect(canvas.getByText(/Optimization Recommendations/)).toBeInTheDocument()
  }
}

// ====================================================================
// GPU/DETERMINISM STORY - Consistency validation
// ====================================================================

const gpuDeterminismSpec1: DualFabricSpec = {
  id: 'gpu-determinism-test-1',
  name: 'GPU Determinism Test A',
  mode: 'dual-fabric',
  frontend: {
    name: 'Compute Fabric A',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'compute-leaf-a',
      name: 'Compute Leaf A',
      role: 'standard',
      uplinksPerLeaf: 4,
      endpointProfiles: [{
        name: 'GPU Server A',
        portsPerEndpoint: 2,
        type: 'compute',
        count: 16
      }]
    }]
  },
  backend: {
    name: 'Storage Fabric A',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    leafClasses: [{
      id: 'storage-leaf-a',
      name: 'Storage Leaf A',
      role: 'standard',
      uplinksPerLeaf: 2,
      endpointProfiles: [{
        name: 'Storage Server A',
        portsPerEndpoint: 4,
        type: 'storage',
        count: 16
      }]
    }]
  },
  sharedServers: Array.from({ length: 8 }, (_, i) => ({
    id: `server-${String(i + 1).padStart(3, '0')}`, // Deterministic IDs
    name: `Server-${String(i + 1).padStart(3, '0')}`,
    totalNics: 6,
    serverType: 'gpu-compute' as const,
    nicAllocations: [
      {
        nicCount: 4,
        nicSpeed: '25G',
        targetFabric: 'frontend' as const,
        purpose: 'compute' as const
      },
      {
        nicCount: 2,
        nicSpeed: '100G',
        targetFabric: 'backend' as const,
        purpose: 'storage' as const
      }
    ]
  })),
  metadata: {
    createdAt: new Date('2024-01-01T00:00:00Z'), // Fixed date for determinism
    version: '1.0.0',
    useCase: 'ai-training'
  }
} as DualFabricSpec

// Identical spec with different ID for comparison
const gpuDeterminismSpec2: DualFabricSpec = {
  ...gpuDeterminismSpec1,
  id: 'gpu-determinism-test-2',
  name: 'GPU Determinism Test B'
}

export const GPUDeterminism: Story = {
  args: {
    spec: gpuDeterminismSpec1,
    validationErrors: [],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify deterministic configuration loaded
    await expect(canvas.getByText('GPU Determinism Test A')).toBeInTheDocument()
    
    // Check deterministic server ordering
    const servers = canvas.getAllByText(/Server-\d{3}/)
    expect(servers.length).toBeGreaterThan(0)
    
    // Verify consistent NIC allocations
    const frontendBadges = canvas.getAllByText('F: 4')
    const backendBadges = canvas.getAllByText('B: 2')
    expect(frontendBadges).toHaveLength(8) // 8 servers
    expect(backendBadges).toHaveLength(8) // 8 servers
    
    // Test deterministic validation results
    await userEvent.click(canvas.getByText('Validation'))
    const validationResults = canvas.getByText('Overall Validation Status')
    await expect(validationResults).toBeInTheDocument()
    
    // Verify resource utilization is consistent
    await userEvent.click(canvas.getByText('Overview'))
    const utilizationElements = canvas.getAllByText(/100%/) // Should be fully utilized
    expect(utilizationElements.length).toBeGreaterThan(0)
    
    // Test that server selection is consistent
    const firstServer = canvas.getByText('Server-001')
    await userEvent.click(firstServer)
    
    await expect(canvas.getByText('NIC Allocation - Server-001')).toBeInTheDocument()
    
    // Verify NIC allocation details are deterministic
    const nicAllocationElements = canvas.getAllByDisplayValue('4') // Frontend NICs
    expect(nicAllocationElements.length).toBeGreaterThan(0)
  }
}

// ====================================================================
// GPU/RENDERING-FARM STORY - Alternative use case
// ====================================================================

export const GPURenderingFarm: Story = {
  args: {
    spec: createDualFabricTemplate('gpu-rendering') as DualFabricSpec,
    validationErrors: [],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify rendering farm template loaded
    await expect(canvas.getByText('GPU Rendering Farm')).toBeInTheDocument()
    await expect(canvas.getByText('Render Fabric')).toBeInTheDocument()
    await expect(canvas.getByText('Asset Fabric')).toBeInTheDocument()
    
    // Check higher NIC counts for rendering workload
    await expect(canvas.getByText('16')).toBeInTheDocument() // Server count
    
    // Verify different NIC allocation pattern
    const frontendHeavyAllocation = canvas.getAllByText('F: 6') // 6 NICs to frontend
    const backendAllocation = canvas.getAllByText('B: 2') // 2 NICs to backend
    
    expect(frontendHeavyAllocation.length).toBeGreaterThan(0)
    expect(backendAllocation.length).toBeGreaterThan(0)
    
    // Test different server type
    const renderServer = canvas.getByText(/Render-Node-01/)
    await userEvent.click(renderServer)
    
    // Verify GPU interconnect purpose
    await expect(canvas.getByDisplayValue('gpu-interconnect')).toBeInTheDocument()
    
    // Test validation with different workload pattern
    await userEvent.click(canvas.getByText('Validation'))
    await expect(canvas.getByText('Overall Validation Status')).toBeInTheDocument()
  }
}

// ====================================================================
// GPU/HPC-CLUSTER STORY - HPC use case
// ====================================================================

export const GPUHPCCluster: Story = {
  args: {
    spec: createDualFabricTemplate('hpc') as DualFabricSpec,
    validationErrors: [],
    isComputing: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify HPC template loaded
    await expect(canvas.getByText('HPC Cluster')).toBeInTheDocument()
    await expect(canvas.getByText('Compute Fabric')).toBeInTheDocument()
    await expect(canvas.getByText('Management Fabric')).toBeInTheDocument()
    
    // Check large server count
    await expect(canvas.getByText('32')).toBeInTheDocument() // Server count
    
    // Verify management fabric has 1G NICs
    const hpcServer = canvas.getByText(/HPC-Node-01/)
    await userEvent.click(hpcServer)
    
    // Should show management purpose allocation
    await expect(canvas.getByDisplayValue('management')).toBeInTheDocument()
    
    // Test lower bandwidth allocation for management
    await expect(canvas.getByDisplayValue('1G')).toBeInTheDocument()
  }
}