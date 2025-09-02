/**
 * BOM Breakout Affects Counts Storybook Stories - WP-BOM2
 * Demonstrates how breakout configurations affect BOM totals
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from '@storybook/test'
import BOMPanel from '../components/BOMPanel'
import { type WiringDiagram } from '../app.types'
import { type LeafModel } from '../domain/leaf-capability-filter'

const meta: Meta<typeof BOMPanel> = {
  title: 'Components/BOMPanel/Breakout Affects Counts',
  component: BOMPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'BOM Panel demonstrating how breakout configurations change hardware counts and costs'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof BOMPanel>

// Test fixtures
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
  },
  {
    id: 'DS4000',
    name: 'Dell DS4000',
    description: '32x400G Spine/Super-ToR Switch',
    totalPorts: 40,
    portTypes: ['400G', '100G', '25G'],
    lagSupport: true,
    lacpSupport: true,
    breakoutOptions: {
      '400G': ['4x100G', '8x50G', '16x25G']
    }
  }
]

const baseWiring: WiringDiagram = {
  devices: {
    spines: [
      { id: 'spine-1', model: 'DS3000', ports: 32 }
    ],
    leaves: [
      { id: 'leaf-1', model: 'DS2000', ports: 56 }
    ],
    servers: []
  },
  connections: [
    // Single uplink
    { from: { device: 'leaf-1', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/1' }, type: 'uplink' }
  ],
  metadata: {
    fabricName: 'Breakout Test Fabric',
    generatedAt: new Date('2025-09-02T12:00:00Z'),
    totalDevices: 2
  }
}

// Stories

export const NoBreakoutBaseline: Story = {
  args: {
    wiringDiagram: {
      ...baseWiring,
      devices: {
        ...baseWiring.devices,
        servers: Array.from({ length: 8 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        ...baseWiring.connections,
        // Direct 25G connections (no breakout)
        ...Array.from({ length: 8 }, (_, i) => ({
          from: { device: `server-${i + 1}`, port: 'eth0' },
          to: { device: 'leaf-1', port: `eth1/${i + 1}` },
          type: 'endpoint' as const
        }))
      ]
    },
    leafModels,
    showPricing: true,
    showDetailedBreakdown: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Baseline: No breakout cables should be needed
    const breakoutsTab = canvas.getByRole('tab', { name: /breakouts/i })
    await breakoutsTab.click()
    
    // Should show "No breakout cables required" or empty list
    await expect(
      canvas.getByText(/No breakouts required|No breakout cables required/) ||
      canvas.queryByText('0') // Zero breakout items
    ).toBeTruthy()
  },
  parameters: {
    docs: {
      description: {
        story: 'Baseline scenario without breakouts - 8 servers with direct 25G connections'
      }
    }
  }
}

export const SimpleBreakoutScenario: Story = {
  args: {
    wiringDiagram: {
      ...baseWiring,
      devices: {
        ...baseWiring.devices,
        servers: Array.from({ length: 8 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        ...baseWiring.connections,
        // Breakout connections (100G port broken to 4x25G)
        { from: { device: 'server-1', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/49/1' }, type: 'endpoint' },
        { from: { device: 'server-2', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/49/2' }, type: 'endpoint' },
        { from: { device: 'server-3', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/49/3' }, type: 'endpoint' },
        { from: { device: 'server-4', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/49/4' }, type: 'endpoint' },
        // Second breakout group
        { from: { device: 'server-5', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/50/1' }, type: 'endpoint' },
        { from: { device: 'server-6', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/50/2' }, type: 'endpoint' },
        { from: { device: 'server-7', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/50/3' }, type: 'endpoint' },
        { from: { device: 'server-8', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/50/4' }, type: 'endpoint' }
      ]
    },
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Should now show breakout cables
    const breakoutsTab = canvas.getByRole('tab', { name: /breakouts/i })
    await breakoutsTab.click()
    
    // Should show 2 breakout cables (2 parent ports broken out)
    await expect(canvas.getByText(/4x25G|4X25G/)).toBeInTheDocument()
    
    // Check that we have the right quantity
    await expect(canvas.getByText('2x')).toBeInTheDocument() // 2 breakout cables
  },
  parameters: {
    docs: {
      description: {
        story: 'Simple breakout scenario - 8 servers connected via 2 breakout cables (100G→4×25G)'
      }
    }
  }
}

export const BreakoutVsDirectComparison: Story = {
  args: {
    wiringDiagram: {
      ...baseWiring,
      devices: {
        ...baseWiring.devices,
        servers: Array.from({ length: 16 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        ...baseWiring.connections,
        // First 8 servers: Direct connections
        ...Array.from({ length: 8 }, (_, i) => ({
          from: { device: `server-${i + 1}`, port: 'eth0' },
          to: { device: 'leaf-1', port: `eth1/${i + 1}` },
          type: 'endpoint' as const
        })),
        // Next 8 servers: Breakout connections
        { from: { device: 'server-9', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/1' }, type: 'endpoint' },
        { from: { device: 'server-10', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/2' }, type: 'endpoint' },
        { from: { device: 'server-11', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/3' }, type: 'endpoint' },
        { from: { device: 'server-12', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/4' }, type: 'endpoint' },
        { from: { device: 'server-13', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/1' }, type: 'endpoint' },
        { from: { device: 'server-14', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/2' }, type: 'endpoint' },
        { from: { device: 'server-15', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/3' }, type: 'endpoint' },
        { from: { device: 'server-16', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/4' }, type: 'endpoint' }
      ]
    },
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Should show both transceivers and breakout cables
    const transceiversTab = canvas.getByRole('tab', { name: /transceivers/i })
    await transceiversTab.click()
    
    // Should see 25G transceivers for direct connections
    await expect(canvas.getByText(/25G/)).toBeInTheDocument()
    
    // Check breakouts tab
    const breakoutsTab = canvas.getByRole('tab', { name: /breakouts/i })
    await breakoutsTab.click()
    
    // Should show 2 breakout cables
    await expect(canvas.getByText('2x')).toBeInTheDocument()
    
    // Go to summary to see cost impact
    const summaryTab = canvas.getByRole('tab', { name: /summary/i })
    await summaryTab.click()
    
    // Should show cost for both transceivers and breakouts
    await expect(canvas.getByText(/Total Cost/)).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Comparison showing mix of direct and breakout connections - demonstrates cost trade-offs'
      }
    }
  }
}

export const HighDensityBreakoutScenario: Story = {
  args: {
    wiringDiagram: {
      ...baseWiring,
      devices: {
        ...baseWiring.devices,
        leaves: [
          { id: 'leaf-1', model: 'DS4000', ports: 40 } // 400G capable leaf
        ],
        servers: Array.from({ length: 48 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        ...baseWiring.connections,
        // 400G → 16×25G breakouts (3 parent ports × 16 children = 48 connections)
        ...Array.from({ length: 48 }, (_, i) => {
          const parentPort = Math.floor(i / 16) + 1 // 3 parent ports
          const childPort = (i % 16) + 1
          return {
            from: { device: `server-${i + 1}`, port: 'eth0' },
            to: { device: 'leaf-1', port: `eth1/${parentPort}/${childPort}` },
            type: 'endpoint' as const
          }
        })
      ]
    },
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // High density should show advanced breakout cables
    const breakoutsTab = canvas.getByRole('tab', { name: /breakouts/i })
    await breakoutsTab.click()
    
    // Should show 16×25G breakout cables
    await expect(canvas.getByText(/16x25G|16X25G/)).toBeInTheDocument()
    
    // Should show 3 breakout cables (3 parent ports)
    await expect(canvas.getByText('3x')).toBeInTheDocument()
    
    // Check summary for high counts
    const summaryTab = canvas.getByRole('tab', { name: /summary/i })
    await summaryTab.click()
    
    // Should show 48+ transceivers and 3 breakouts
    await expect(canvas.getByText('3')).toBeInTheDocument() // breakout count
    
    // High transceiver count due to 48 server connections + uplinks
    const transceiverCounts = canvas.getAllByText(/\d+/)
    const hasHighCount = transceiverCounts.some(el => {
      const count = parseInt(el.textContent || '0')
      return count >= 48 // Should have at least 48 transceivers for servers
    })
    expect(hasHighCount).toBe(true)
  },
  parameters: {
    docs: {
      description: {
        story: 'High-density scenario with 400G→16×25G breakouts for maximum port efficiency'
      }
    }
  }
}

export const BreakoutCostAnalysis: Story = {
  args: {
    wiringDiagram: {
      ...baseWiring,
      devices: {
        ...baseWiring.devices,
        servers: Array.from({ length: 12 }, (_, i) => ({ 
          id: `server-${i + 1}`, 
          type: 'server', 
          connections: 1 
        }))
      },
      connections: [
        ...baseWiring.connections,
        // Mix of breakout patterns to show cost differences
        // 4×25G breakout (efficient)
        { from: { device: 'server-1', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/1' }, type: 'endpoint' },
        { from: { device: 'server-2', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/2' }, type: 'endpoint' },
        { from: { device: 'server-3', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/3' }, type: 'endpoint' },
        { from: { device: 'server-4', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/45/4' }, type: 'endpoint' },
        // Partially used breakout (inefficient - 2 out of 4 ports used)
        { from: { device: 'server-5', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/1' }, type: 'endpoint' },
        { from: { device: 'server-6', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/46/2' }, type: 'endpoint' },
        // Direct connections for comparison
        ...Array.from({ length: 6 }, (_, i) => ({
          from: { device: `server-${i + 7}`, port: 'eth0' },
          to: { device: 'leaf-1', port: `eth1/${i + 1}` },
          type: 'endpoint' as const
        }))
      ]
    },
    leafModels,
    showPricing: true,
    showDetailedBreakdown: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    await expect(canvas.getByText('Bill of Materials')).toBeInTheDocument()
    
    // Should show cost comparison between breakout and direct
    const summaryTab = canvas.getByRole('tab', { name: /summary/i })
    await summaryTab.click()
    
    // Should show both breakout and transceiver costs
    await expect(canvas.getByText('Cost Breakdown')).toBeInTheDocument()
    
    // Check utilization stats
    await expect(canvas.getByText('Utilization Statistics')).toBeInTheDocument()
    
    // Navigate to breakouts to see efficiency
    const breakoutsTab = canvas.getByRole('tab', { name: /breakouts/i })
    await breakoutsTab.click()
    
    // Should show 2 breakout cables (one efficient, one underutilized)
    await expect(canvas.getByText('2x')).toBeInTheDocument()
  },
  parameters: {
    docs: {
      description: {
        story: 'Cost analysis showing efficient vs inefficient breakout utilization'
      }
    }
  }
}