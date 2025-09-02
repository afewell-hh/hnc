/**
 * BOM Compiler Tests - WP-BOM2
 * Comprehensive tests for BOM compilation accuracy
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { compileBOM, type BOMAnalysis } from './bom-compiler'
import { countTransceivers } from './transceiver-counter'
import { type WiringDiagram } from '../app.types'
import { type ExternalLink } from './external-link'
import { type LeafModel } from './leaf-capability-filter'

// Test fixtures
const createBasicWiringDiagram = (): WiringDiagram => ({
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
      { id: 'server-2', type: 'server', connections: 1 }
    ]
  },
  connections: [
    // Uplinks (leaf to spine)
    { from: { device: 'leaf-1', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/1' }, type: 'uplink' },
    { from: { device: 'leaf-1', port: 'eth1/50' }, to: { device: 'spine-2', port: 'eth1/1' }, type: 'uplink' },
    { from: { device: 'leaf-2', port: 'eth1/49' }, to: { device: 'spine-1', port: 'eth1/2' }, type: 'uplink' },
    { from: { device: 'leaf-2', port: 'eth1/50' }, to: { device: 'spine-2', port: 'eth1/2' }, type: 'uplink' },
    // Server connections
    { from: { device: 'server-1', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/1' }, type: 'endpoint' },
    { from: { device: 'server-2', port: 'eth0' }, to: { device: 'leaf-2', port: 'eth1/1' }, type: 'endpoint' }
  ],
  metadata: {
    fabricName: 'Test Fabric',
    generatedAt: new Date(),
    totalDevices: 6
  }
})

const createExternalLinks = (): ExternalLink[] => [
  {
    id: 'ext-1',
    name: 'External Link 1',
    mode: 'explicit-ports',
    explicitPorts: [
      { speed: '100G', count: 2 }
    ],
    category: 'vpc.external',
    enabled: true
  }
]

const createLeafModels = (): LeafModel[] => [
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

describe('BOM Compiler', () => {
  let basicWiring: WiringDiagram
  let externalLinks: ExternalLink[]
  let leafModels: LeafModel[]

  beforeEach(() => {
    basicWiring = createBasicWiringDiagram()
    externalLinks = createExternalLinks()
    leafModels = createLeafModels()
  })

  describe('Switch Counting', () => {
    it('should count switches by model correctly', () => {
      const bom = compileBOM(basicWiring, [], leafModels)
      
      // Should have switch entries for DS2000 and DS3000
      expect(bom.switches).toHaveLength(2)
      
      const ds2000 = bom.switches.find(s => s.sku.includes('DS2000'))
      const ds3000 = bom.switches.find(s => s.sku.includes('DS3000'))
      
      expect(ds2000).toBeDefined()
      expect(ds2000?.quantity).toBe(2) // 2 leaves
      
      expect(ds3000).toBeDefined() 
      expect(ds3000?.quantity).toBe(2) // 2 spines
    })

    it('should include switch pricing when available', () => {
      const bom = compileBOM(basicWiring, [], leafModels)
      
      for (const switchItem of bom.switches) {
        expect(switchItem.unitPrice).toBeGreaterThan(0)
        expect(switchItem.totalPrice).toBe(switchItem.unitPrice! * switchItem.quantity)
      }
    })
  })

  describe('Transceiver Counting - Per Link End', () => {
    it('should count 2 transceivers per uplink connection', () => {
      const bom = compileBOM(basicWiring, [], leafModels)
      
      // 4 uplinks = 8 transceivers (2 per uplink)
      // 2 server connections = 2 transceivers (1 per server connection)
      // Total expected: 10 transceivers minimum
      const totalTransceivers = bom.transceivers.reduce((sum, t) => sum + t.quantity, 0)
      expect(totalTransceivers).toBeGreaterThanOrEqual(10)
    })

    it('should count 1 transceiver per server connection (at leaf end)', () => {
      const bom = compileBOM(basicWiring, [], leafModels)
      
      // Look for server access transceivers (typically 25G DAC)
      const serverTransceivers = bom.transceivers.filter(t => 
        t.sku.includes('25G') && t.sku.includes('DAC')
      )
      
      expect(serverTransceivers.length).toBeGreaterThan(0)
      
      // Should have at least 2 (one per server connection)
      const serverTransceiverCount = serverTransceivers.reduce((sum, t) => sum + t.quantity, 0)
      expect(serverTransceiverCount).toBeGreaterThanOrEqual(2)
    })

    it('should use appropriate transceiver types for different connections', () => {
      const bom = compileBOM(basicWiring, [], leafModels)
      
      // Should have both 25G (server) and 100G (uplink) transceivers
      const has25G = bom.transceivers.some(t => t.sku.includes('25G'))
      const has100G = bom.transceivers.some(t => t.sku.includes('100G'))
      
      expect(has25G).toBe(true)
      expect(has100G).toBe(true)
    })
  })

  describe('External Link Transceivers', () => {
    it('should count 2 transceivers per external link port', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      // External link has 2x100G ports, should add 4 transceivers (2 per port)
      const externalTransceivers = bom.transceivers.filter(t => 
        t.source === 'external-link' || t.sku.includes('LR') // External typically uses LR transceivers
      )
      
      const externalTransceiverCount = externalTransceivers.reduce((sum, t) => sum + t.quantity, 0)
      expect(externalTransceiverCount).toBeGreaterThanOrEqual(4)
    })

    it('should use fiber transceivers for external links', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      // External links should prefer fiber LR transceivers
      const fiberTransceivers = bom.transceivers.filter(t => 
        t.sku.includes('LR') || t.description.toLowerCase().includes('fiber')
      )
      
      expect(fiberTransceivers.length).toBeGreaterThan(0)
    })
  })

  describe('Breakout Cable Counting', () => {
    it('should detect breakout requirements from port naming patterns', () => {
      // Create wiring with breakout port patterns
      const breakoutWiring: WiringDiagram = {
        ...basicWiring,
        connections: [
          ...basicWiring.connections,
          // Add breakout connections (parent port broken to child ports)
          { from: { device: 'server-3', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/2/1' }, type: 'endpoint' },
          { from: { device: 'server-4', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/2/2' }, type: 'endpoint' },
          { from: { device: 'server-5', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/2/3' }, type: 'endpoint' },
          { from: { device: 'server-6', port: 'eth0' }, to: { device: 'leaf-1', port: 'eth1/2/4' }, type: 'endpoint' }
        ]
      }

      const bom = compileBOM(breakoutWiring, [], leafModels)
      
      // Should detect 100G->4x25G breakout requirement
      const breakoutCables = bom.breakouts.filter(b => 
        b.sku.includes('4X25G') || b.description.includes('4x25G')
      )
      
      expect(breakoutCables.length).toBeGreaterThan(0)
    })
  })

  describe('BOM Summary', () => {
    it('should calculate accurate totals', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      // Verify summary totals match item counts
      const actualSwitches = bom.switches.reduce((sum, s) => sum + s.quantity, 0)
      const actualTransceivers = bom.transceivers.reduce((sum, t) => sum + t.quantity, 0)
      const actualBreakouts = bom.breakouts.reduce((sum, b) => sum + b.quantity, 0)
      
      expect(bom.summary.totalSwitches).toBe(actualSwitches)
      expect(bom.summary.totalTransceivers).toBe(actualTransceivers)
      expect(bom.summary.totalBreakouts).toBe(actualBreakouts)
    })

    it('should calculate total cost correctly', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      const expectedTotal = [
        ...bom.switches,
        ...bom.transceivers,
        ...bom.breakouts,
        ...bom.cables
      ].reduce((sum, item) => sum + (item.totalPrice || 0), 0)

      expect(Math.abs(bom.summary.totalCost - expectedTotal)).toBeLessThan(0.01)
    })

    it('should calculate cost breakdown by category', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      // Verify cost breakdown matches category totals
      const switchCost = bom.switches.reduce((sum, s) => sum + (s.totalPrice || 0), 0)
      const transceiverCost = bom.transceivers.reduce((sum, t) => sum + (t.totalPrice || 0), 0)
      
      expect(Math.abs(bom.summary.costBreakdown.switches - switchCost)).toBeLessThan(0.01)
      expect(Math.abs(bom.summary.costBreakdown.transceivers - transceiverCost)).toBeLessThan(0.01)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty wiring diagram', () => {
      const emptyWiring: WiringDiagram = {
        devices: { spines: [], leaves: [], servers: [] },
        connections: [],
        metadata: { fabricName: 'Empty', generatedAt: new Date(), totalDevices: 0 }
      }

      const bom = compileBOM(emptyWiring, [], leafModels)
      
      expect(bom.switches).toHaveLength(0)
      expect(bom.transceivers).toHaveLength(0)
      expect(bom.summary.totalCost).toBe(0)
    })

    it('should handle unknown switch models gracefully', () => {
      const unknownWiring: WiringDiagram = {
        ...basicWiring,
        devices: {
          ...basicWiring.devices,
          leaves: [{ id: 'leaf-1', model: 'UNKNOWN-SWITCH', ports: 48 }]
        }
      }

      expect(() => compileBOM(unknownWiring, [], leafModels)).not.toThrow()
      
      const bom = compileBOM(unknownWiring, [], leafModels)
      const unknownSwitch = bom.switches.find(s => s.sku.includes('UNKNOWN-SWITCH'))
      expect(unknownSwitch).toBeDefined()
    })

    it('should handle disabled external links', () => {
      const disabledLinks: ExternalLink[] = [
        { ...externalLinks[0], enabled: false }
      ]

      const bomWithDisabled = compileBOM(basicWiring, disabledLinks, leafModels)
      const bomWithoutExternal = compileBOM(basicWiring, [], leafModels)

      // Should have same transceiver count (disabled links don't add transceivers)
      expect(bomWithDisabled.summary.totalTransceivers).toBe(bomWithoutExternal.summary.totalTransceivers)
    })
  })

  describe('Integration with Transceiver Counter', () => {
    it('should produce consistent results with standalone transceiver counter', () => {
      const bomAnalysis = compileBOM(basicWiring, externalLinks, leafModels)
      const transceiverAnalysis = countTransceivers(basicWiring, externalLinks)

      // Both should count the same number of transceivers
      expect(bomAnalysis.summary.totalTransceivers).toBe(transceiverAnalysis.summary.totalTransceivers)
    })

    it('should validate transceiver counts against connection topology', () => {
      const bom = compileBOM(basicWiring, externalLinks, leafModels)
      
      const uplinkConnections = basicWiring.connections.filter(c => c.type === 'uplink').length
      const serverConnections = basicWiring.connections.filter(c => c.type === 'endpoint').length
      const externalPorts = externalLinks.reduce((sum, link) => 
        sum + (link.explicitPorts?.reduce((portSum, port) => portSum + port.count, 0) || 0), 0
      )

      // Expected minimum: 2 per uplink + 1 per server + 2 per external port
      const expectedMinimum = (uplinkConnections * 2) + serverConnections + (externalPorts * 2)
      
      expect(bom.summary.totalTransceivers).toBeGreaterThanOrEqual(expectedMinimum)
    })
  })
})