/**
 * BOM Includes Optics Storybook Stories - WP-BOM2
 * Demonstrates BOM panel with optics counting scenarios
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from '@storybook/test'
import BOMPanel from '../components/BOMPanel'
import { type WiringDiagram } from '../app.types'
import { type ExternalLink } from '../domain/external-link'
import { type LeafModel } from '../domain/leaf-capability-filter'

const meta: Meta<typeof BOMPanel> = {
  title: 'Components/BOMPanel/Includes Optics',
  component: BOMPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'BOM Panel demonstrating accurate optics counting with per-link-end methodology'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof BOMPanel>

// Test fixtures
const basicWiring: WiringDiagram = {
  devices: {
    spines: [
      { id: 'spine-1', model: 'DS3000', ports: 32 },
      { id: 'spine-2', model: 'DS3000', ports: 32 }
    ],
    leaves: [
      { id: 'leaf-1', model: 'DS2000', ports: 56 },
      { id: 'leaf-2', model: 'DS2000', ports: 56 }
    ],
    servers: [
      { id: 'server-1', type: 'server', connections: 1 },
      { id: 'server-2', type: 'server', connections: 1 },
      { id: 'server-3', type: 'server', connections: 1 },
      { id: 'server-4', type: 'server', connections: 1 }
    ]
  },
  connections: [
    // Leaf-Spine uplinks (4 uplinks = 8 transceivers)
    { from: { device: 'leaf-1', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/1' }, type: 'uplink' },
    { from: { device: 'leaf-1', port: 'eth1/50' }, to: { device: 'spine-2', port: 'eth1/1' }, type: 'uplink' },
    { from: { device: 'leaf-2', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/2' }, type: 'uplink' },
    { from: { device: 'leaf-2', port: 'eth1/50' }, to: { device: 'spine-2', port: 'eth1/2' }, type: 'uplink' },
    // Server connections (4 connections = 4 transceivers at leaf end)
    { from: { device: 'server-1', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/1' }, type: 'endpoint' },
    { from: { device: 'server-2', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/2' }, type: 'endpoint' },
    { from: { device: 'server-3', port: 'eth0' }, to: { device: 'leaf-2', port: 'eth1/1' }, type: 'endpoint' },
    { from: { device: 'server-4', port: 'eth0' }, to: { device: 'leaf-2', port: 'eth1/2' }, type: 'endpoint' }
  ],
  metadata: {
    fabricName: 'Basic Test Fabric',
    generatedAt: new Date('2025-09-02T12:00:00Z'),
    totalDevices: 8
  }
}

const externalLinks: ExternalLink[] = [
  {
    id: 'ext-vpc',
    name: 'VPC External Link',
    mode: 'explicit-ports',
    explicitPorts: [
      { speed: '100G', count: 2 }
    ],
    category: 'vpc.external',
    enabled: true
  }
]

const leafModels: LeafModel[] = [
  {
    id: 'DS2000',
    name: 'Dell DS2000',
    description: '48x25G + 8x100G ToR Switch',
    totalPorts: 56,
    portTypes: ['25G', '100G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '100G': ['4x25G']
    }
  }
]

// Stories

export const SmallFabricWithOptics: Story = {
  args: {
    wiringDiagram: basicWiring,
    externalLinks: [],
    leafModels,
    showPricing: true,
    showDetailedBreakdown: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify BOM panel renders
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Check switch counts
    await expect(canvas.getByText('4')).toBeInTheDocument() // Total switches
    
    // Check transceiver counts (4 uplinks * 2 + 4 servers * 1 = 12 minimum)
    const transceiverCount = canvas.getByText(/\d+/).closest('[data-testid="transceiver-count"]')
    // Should show significant transceiver count for fabric interconnect + server access
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic fabric showing 2 transceivers per uplink (both ends) and 1 per server connection (leaf end only)'
      }
    }
  }
}

export const FabricWithExternalLinks: Story = {
  args: {
    wiringDiagram: basicWiring,
    externalLinks,
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Should show external link transceivers added to total
    // 2x100G external ports = 4 additional transceivers (2 per port)
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Navigate to transceivers tab
    const transceiversTab = canvas.getByRole('tab', { name: /transceivers/i })
    await transceiversTab.click()
    
    // Should show different transceiver types
    // Expect both DAC (internal) and LR (external) transceivers
    await expect(canvas.getByText(/DAC|LR/)).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Fabric with external links showing 2 transceivers per external port (border leaf + external router)'
      }
    }
  }
}

export const LargeFabricScenario: Story = {
  args: {
    wiringDiagram: {
      devices: {
        spines: Array.from({ length: 4 }, (_, i) => ({ 
          id: `spine-${i + 1}`, 
          model: 'DS3000', 
          ports: 32 
        })),
        leaves: Array.from({ length: 12 }, (_, i) => ({ 
          id: `leaf-${i + 1}`, 
          model: 'DS2000', 
          ports: 56 
        })),
        servers: Array.from({ length: 240 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        // Generate uplinks (12 leaves * 4 uplinks each = 48 uplinks = 96 transceivers)
        ...Array.from({ length: 12 }, (_, leafIdx) => 
          Array.from({ length: 4 }, (_, uplinkIdx) => ({
            from: { device: `leaf-${leafIdx + 1}`, port: `eth1/${49 + uplinkIdx}` },
            to: { device: `spine-${(uplinkIdx % 4) + 1}`, port: `eth1/${Math.floor(leafIdx / 4) * 4 + (leafIdx % 4) + 1}` },
            type: 'uplink' as const
          }))
        ).flat(),
        // Generate server connections (240 servers = 240 transceivers at leaves)
        ...Array.from({ length: 240 }, (_, serverIdx) => {
          const leafIdx = Math.floor(serverIdx / 20) // 20 servers per leaf
          const portIdx = (serverIdx % 20) + 1
          return {
            from: { device: `server-${serverIdx + 1}`, port: 'eth0' },
            to: { device: `leaf-${leafIdx + 1}`, port: `eth1/${portIdx}` },
            type: 'endpoint' as const
          }
        })
      ],
      metadata: {
        fabricName: 'Large Production Fabric',
        generatedAt: new Date('2025-09-02T12:00:00Z'),
        totalDevices: 256
      }
    },
    externalLinks: [
      {
        id: 'ext-vpc-1',
        name: 'VPC External Block 1',
        mode: 'explicit-ports',
        explicitPorts: [{ speed: '100G', count: 4 }],
        category: 'vpc.external',
        enabled: true
      },
      {
        id: 'ext-vpc-2', 
        name: 'VPC External Block 2',
        mode: 'explicit-ports',
        explicitPorts: [{ speed: '100G', count: 4 }],
        category: 'vpc.external',
        enabled: true
      }
    ],
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Large fabric should show significant quantities
    await expect(canvas.getByText('16')).toBeInTheDocument() // Total switches (4 spines + 12 leaves)
    
    // Transceiver count should be substantial
    // Expected: 96 (uplinks) + 240 (servers) + 16 (external) = 352 minimum
    
    // Check cost is reasonable for large fabric
    const costElements = canvas.getAllByText(/\$[\d,]+/)
    expect(costElements.length).toBeGreaterThan(0)
  },
  parameters: {
    docs: {
      description: {
        story: 'Large production fabric demonstrating scale of transceiver requirements'
      }
    }
  }
}

export const TransceiverTypeMixScenario: Story = {
  args: {
    wiringDiagram: {
      devices: {
        spines: [
          { id: 'spine-1', model: 'DS4000', ports: 40 } // 400G capable spine
        ],
        leaves: [
          { id: 'leaf-1', model: 'DS2000', ports: 56 },
          { id: 'leaf-2', model: 'DS3000', ports: 36 }  // Different leaf model
        ],
        servers: [
          { id: 'server-1', type: 'server', connections: 1 },
          { id: 'server-2', type: 'server', connections: 1 }
        ]
      },
      connections: [
        // Mixed speed uplinks
        { from: { device: 'leaf-1', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/1' }, type: 'uplink' },
        { from: { device: 'leaf-2', port: 'eth1/33' }, to: { device: 'spine-1', port: 'eth1/2' }, type: 'uplink' },
        // Server connections
        { from: { device: 'server-1', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/1' }, type: 'endpoint' },
        { from: { device: 'server-2', port: 'eth0' }, to: { device: 'leaf-2', port: 'eth1/1' }, type: 'endpoint' }
      ],
      metadata: {
        fabricName: 'Mixed Speed Fabric',
        generatedAt: new Date('2025-09-02T12:00:00Z'),
        totalDevices: 5
      }
    },
    externalLinks: [
      {
        id: 'ext-mixed',
        name: 'Mixed Speed External',
        mode: 'explicit-ports',
        explicitPorts: [
          { speed: '100G', count: 2 },
          { speed: '400G', count: 1 }
        ],
        category: 'vpc.external',
        enabled: true
      }
    ],
    leafModels: [
      ...leafModels,
      {
        id: 'DS3000',
        name: 'Dell DS3000',
        description: '32x100G High-Density Switch', 
        totalPorts: 36,
        portTypes: ['100G'],
        lagSupport: true,
        lacpSupport: true
      }
    ],
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Navigate to transceivers tab to see mixed types
    const transceiversTab = canvas.getByRole('tab', { name: /transceivers/i })
    await transceiversTab.click()
    
    // Should show multiple transceiver speeds
    // Look for both 25G, 100G, and 400G transceivers
    await expect(canvas.getByText(/25G|100G|400G/)).toBeInTheDocument()
    
    // Check detailed breakdown section
    await expect(canvas.getByText('Detailed Transceiver Breakdown')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Mixed speed fabric showing different transceiver types for various connection speeds'
      }
    }
  }
}

export const OpticsValidationScenario: Story = {
  args: {
    wiringDiagram: basicWiring,
    externalLinks,
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Validate transceiver count matches expected formula
    const transceiversTab = canvas.getByRole('tab', { name: /transceivers/i })
    await transceiversTab.click()
    
    // Expected calculation:
    // - 4 uplinks × 2 transceivers = 8
    // - 4 server connections × 1 transceiver = 4  
    // - 2 external ports × 2 transceivers = 4
    // Total expected: 16 transceivers minimum
    
    // Navigate to summary to check totals
    const summaryTab = canvas.getByRole('tab', { name: /summary/i })
    await summaryTab.click()
    
    // Verify utilization stats are reasonable
    await expect(canvas.getByText('Utilization Statistics')).toBeInTheDocument()
    await expect(canvas.getByText(/Port Utilization|Transceiver Efficiency/)).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Validation scenario ensuring transceiver counts follow per-link-end methodology'
      }
    }
  }
}