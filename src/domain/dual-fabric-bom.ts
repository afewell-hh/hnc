/**
 * WP-GPU1: Dual-Fabric BOM Generation
 * 
 * Unified Bill of Materials generation for dual-fabric configurations.
 * Combines frontend and backend fabric BOMs with shared resource accounting.
 */

import type { DualFabricSpec, BOMAnalysis, FGDOutput } from './dual-fabric'
import { computeEndpointsForFabric } from './dual-fabric'
import { computeDerived } from './topology'

// ====================================================================
// BOM COMPONENT TYPES
// ====================================================================

export interface BOMComponent {
  id: string
  category: 'switch' | 'server' | 'cable' | 'transceiver' | 'power' | 'cooling'
  model: string
  manufacturer?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  fabric?: 'frontend' | 'backend' | 'shared'
  specification?: Record<string, any>
  leadTime?: number // weeks
  powerConsumption?: number // watts
}

export interface BOMCostSummary {
  subtotalByCategory: Record<string, number>
  subtotalByFabric: {
    frontend: number
    backend: number
    shared: number
    total: number
  }
  taxRate?: number
  taxAmount?: number
  shippingCost?: number
  grandTotal: number
}

export interface DualFabricBOM {
  id: string
  fabricId: string
  generatedAt: Date
  components: BOMComponent[]
  summary: BOMCostSummary
  metadata: {
    totalDevices: number
    totalCables: number
    estimatedPowerConsumption: number // watts
    rackSpaceRequired: number // RU
  }
}

// ====================================================================
// BOM GENERATOR
// ====================================================================

export class DualFabricBOMGenerator {
  
  /**
   * Generates complete BOM for dual-fabric specification
   */
  static generateBOM(spec: DualFabricSpec): DualFabricBOM {
    const components: BOMComponent[] = []
    
    // Generate switch components
    components.push(...this.generateSwitchComponents(spec))
    
    // Generate server components (shared)
    components.push(...this.generateServerComponents(spec))
    
    // Generate cable components
    components.push(...this.generateCableComponents(spec))
    
    // Generate transceiver components
    components.push(...this.generateTransceiverComponents(spec))
    
    // Generate power and cooling components
    components.push(...this.generateInfrastructureComponents(spec))
    
    // Calculate summary
    const summary = this.calculateCostSummary(components)
    const metadata = this.calculateMetadata(components, spec)
    
    return {
      id: `bom-${spec.id}-${Date.now()}`,
      fabricId: spec.id,
      generatedAt: new Date(),
      components,
      summary,
      metadata
    }
  }
  
  /**
   * Generates switch components for both fabrics
   */
  private static generateSwitchComponents(spec: DualFabricSpec): BOMComponent[] {
    const components: BOMComponent[] = []
    
    // Frontend fabric switches
    const frontendTopology = this.computeFabricTopology(spec, 'frontend')
    components.push(...this.generateFabricSwitches(spec.frontend, frontendTopology, 'frontend'))
    
    // Backend fabric switches
    const backendTopology = this.computeFabricTopology(spec, 'backend')
    components.push(...this.generateFabricSwitches(spec.backend, backendTopology, 'backend'))
    
    return components
  }
  
  /**
   * Generates switches for a specific fabric
   */
  private static generateFabricSwitches(
    fabric: any, 
    topology: any, 
    fabricType: 'frontend' | 'backend'
  ): BOMComponent[] {
    const components: BOMComponent[] = []
    
    // Spine switches
    if (topology.spinesNeeded > 0) {
      const spineSwitch = this.getSwitchSpec(fabric.spineModelId)
      components.push({
        id: `spine-${fabricType}`,
        category: 'switch',
        model: fabric.spineModelId,
        manufacturer: spineSwitch.manufacturer,
        quantity: topology.spinesNeeded,
        unitPrice: spineSwitch.price,
        totalPrice: topology.spinesNeeded * spineSwitch.price,
        fabric: fabricType,
        specification: spineSwitch.specs,
        leadTime: spineSwitch.leadTime,
        powerConsumption: spineSwitch.powerConsumption * topology.spinesNeeded
      })
    }
    
    // Leaf switches
    if (topology.leavesNeeded > 0) {
      const leafSwitch = this.getSwitchSpec(fabric.leafModelId)
      components.push({
        id: `leaf-${fabricType}`,
        category: 'switch',
        model: fabric.leafModelId,
        manufacturer: leafSwitch.manufacturer,
        quantity: topology.leavesNeeded,
        unitPrice: leafSwitch.price,
        totalPrice: topology.leavesNeeded * leafSwitch.price,
        fabric: fabricType,
        specification: leafSwitch.specs,
        leadTime: leafSwitch.leadTime,
        powerConsumption: leafSwitch.powerConsumption * topology.leavesNeeded
      })
    }
    
    return components
  }
  
  /**
   * Generates shared server components
   */
  private static generateServerComponents(spec: DualFabricSpec): BOMComponent[] {
    const components: BOMComponent[] = []
    
    // Group servers by type
    const serverTypeGroups = spec.sharedServers.reduce((groups, server) => {
      const type = server.serverType || 'general-purpose'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(server)
      return groups
    }, {} as Record<string, typeof spec.sharedServers>)
    
    // Generate BOM entries per server type
    for (const [serverType, servers] of Object.entries(serverTypeGroups)) {
      const serverSpec = this.getServerSpec(serverType)
      
      components.push({
        id: `server-${serverType}`,
        category: 'server',
        model: serverSpec.model,
        manufacturer: serverSpec.manufacturer,
        quantity: servers.length,
        unitPrice: serverSpec.price,
        totalPrice: servers.length * serverSpec.price,
        fabric: 'shared',
        specification: {
          ...serverSpec.specs,
          totalNics: servers[0]?.totalNics || 4,
          nicDistribution: this.analyzeNicDistribution(servers)
        },
        leadTime: serverSpec.leadTime,
        powerConsumption: serverSpec.powerConsumption * servers.length
      })
    }
    
    return components
  }
  
  /**
   * Generates cable components
   */
  private static generateCableComponents(spec: DualFabricSpec): BOMComponent[] {
    const components: BOMComponent[] = []
    
    // Calculate cable requirements for each fabric
    const frontendTopology = this.computeFabricTopology(spec, 'frontend')
    const backendTopology = this.computeFabricTopology(spec, 'backend')
    
    // Frontend fabric cables
    const frontendCables = this.calculateCableRequirements(spec.frontend, frontendTopology)
    components.push(...this.generateCableEntries(frontendCables, 'frontend'))
    
    // Backend fabric cables
    const backendCables = this.calculateCableRequirements(spec.backend, backendTopology)
    components.push(...this.generateCableEntries(backendCables, 'backend'))
    
    return components
  }
  
  /**
   * Generates transceiver components
   */
  private static generateTransceiverComponents(spec: DualFabricSpec): BOMComponent[] {
    const components: BOMComponent[] = []
    
    // Analyze NIC speeds across all servers
    const nicSpeedCounts = spec.sharedServers.reduce((counts, server) => {
      server.nicAllocations.forEach(alloc => {
        const key = `${alloc.nicSpeed}-${alloc.targetFabric}`
        counts[key] = (counts[key] || 0) + alloc.nicCount
      })
      return counts
    }, {} as Record<string, number>)
    
    // Generate transceiver entries
    for (const [speedFabric, quantity] of Object.entries(nicSpeedCounts)) {
      const [speed, fabric] = speedFabric.split('-')
      const transceiverSpec = this.getTransceiverSpec(speed)
      
      components.push({
        id: `transceiver-${speed}-${fabric}`,
        category: 'transceiver',
        model: transceiverSpec.model,
        manufacturer: transceiverSpec.manufacturer,
        quantity: quantity * 2, // Each connection needs 2 transceivers
        unitPrice: transceiverSpec.price,
        totalPrice: quantity * 2 * transceiverSpec.price,
        fabric: fabric as 'frontend' | 'backend',
        specification: transceiverSpec.specs,
        leadTime: transceiverSpec.leadTime
      })
    }
    
    return components
  }
  
  /**
   * Generates power and cooling infrastructure components
   */
  private static generateInfrastructureComponents(spec: DualFabricSpec): BOMComponent[] {
    const components: BOMComponent[] = []
    
    const totalDevices = spec.sharedServers.length + this.getTotalSwitches(spec)
    const estimatedPowerConsumption = this.estimateTotalPowerConsumption(spec)
    
    // Power distribution units
    const pduCount = Math.ceil(totalDevices / 24) // ~24 devices per PDU
    components.push({
      id: 'power-pdu',
      category: 'power',
      model: 'PDU-48-20A',
      manufacturer: 'Generic',
      quantity: pduCount,
      unitPrice: 2500,
      totalPrice: pduCount * 2500,
      fabric: 'shared',
      specification: {
        outlets: 48,
        amperage: '20A',
        voltage: '208V'
      },
      leadTime: 4
    })
    
    // UPS systems
    const upsCount = Math.ceil(estimatedPowerConsumption / 5000) // 5kW per UPS
    if (upsCount > 0) {
      components.push({
        id: 'power-ups',
        category: 'power',
        model: 'UPS-5000VA',
        manufacturer: 'Generic',
        quantity: upsCount,
        unitPrice: 8000,
        totalPrice: upsCount * 8000,
        fabric: 'shared',
        specification: {
          capacity: '5000VA',
          runtime: '10 minutes at full load'
        },
        leadTime: 6
      })
    }
    
    // Cooling systems
    const coolingUnits = Math.ceil(estimatedPowerConsumption / 10000) // 10kW per cooling unit
    if (coolingUnits > 0) {
      components.push({
        id: 'cooling-unit',
        category: 'cooling',
        model: 'CRAC-10kW',
        manufacturer: 'Generic',
        quantity: coolingUnits,
        unitPrice: 15000,
        totalPrice: coolingUnits * 15000,
        fabric: 'shared',
        specification: {
          capacity: '10kW',
          efficiency: 'SEER 12'
        },
        leadTime: 8
      })
    }
    
    return components
  }
  
  // ====================================================================
  // HELPER METHODS
  // ====================================================================
  
  private static computeFabricTopology(spec: DualFabricSpec, fabricType: 'frontend' | 'backend') {
    const fabric = fabricType === 'frontend' ? spec.frontend : spec.backend
    const endpoints = computeEndpointsForFabric(spec, fabricType)
    
    return computeDerived({
      ...fabric,
      endpointCount: endpoints
    })
  }
  
  private static getSwitchSpec(modelId: string) {
    const specs = {
      'DS3000': {
        manufacturer: 'Hedgehog',
        price: 45000,
        specs: { ports: 32, speed: '100G', powerConsumption: 350 },
        leadTime: 12,
        powerConsumption: 350
      },
      'DS2000': {
        manufacturer: 'Hedgehog',
        price: 25000,
        specs: { ports: 48, speed: '25G', powerConsumption: 250 },
        leadTime: 8,
        powerConsumption: 250
      }
    }
    
    return specs[modelId as keyof typeof specs] || specs['DS2000']
  }
  
  private static getServerSpec(serverType: string) {
    const specs = {
      'gpu-compute': {
        model: 'GPU-Server-V100',
        manufacturer: 'Generic',
        price: 50000,
        specs: { gpu: 'NVIDIA V100', ram: '256GB', storage: '4TB NVMe' },
        leadTime: 16,
        powerConsumption: 2500
      },
      'storage': {
        model: 'Storage-Server-24TB',
        manufacturer: 'Generic',
        price: 15000,
        specs: { storage: '24TB SAS', ram: '64GB', raid: 'RAID6' },
        leadTime: 8,
        powerConsumption: 400
      },
      'general-purpose': {
        model: 'Server-Standard',
        manufacturer: 'Generic',
        price: 8000,
        specs: { cpu: '2x Xeon Gold', ram: '128GB', storage: '2TB SSD' },
        leadTime: 6,
        powerConsumption: 300
      }
    }
    
    return specs[serverType as keyof typeof specs] || specs['general-purpose']
  }
  
  private static getTransceiverSpec(speed: string) {
    const specs = {
      '1G': { model: 'SFP-1G-T', manufacturer: 'Generic', price: 50, specs: { speed: '1Gbps', connector: 'RJ45' }, leadTime: 2 },
      '10G': { model: 'SFP+-10G-SR', manufacturer: 'Generic', price: 150, specs: { speed: '10Gbps', connector: 'LC' }, leadTime: 4 },
      '25G': { model: 'SFP28-25G-SR', manufacturer: 'Generic', price: 300, specs: { speed: '25Gbps', connector: 'LC' }, leadTime: 4 },
      '40G': { model: 'QSFP+-40G-SR4', manufacturer: 'Generic', price: 800, specs: { speed: '40Gbps', connector: 'MPO' }, leadTime: 6 },
      '50G': { model: 'SFP56-50G-SR', manufacturer: 'Generic', price: 500, specs: { speed: '50Gbps', connector: 'LC' }, leadTime: 6 },
      '100G': { model: 'QSFP28-100G-SR4', manufacturer: 'Generic', price: 1200, specs: { speed: '100Gbps', connector: 'MPO' }, leadTime: 6 },
      '200G': { model: 'QSFP56-200G-SR4', manufacturer: 'Generic', price: 2500, specs: { speed: '200Gbps', connector: 'MPO' }, leadTime: 8 },
      '400G': { model: 'QSFP-DD-400G-SR8', manufacturer: 'Generic', price: 4000, specs: { speed: '400Gbps', connector: 'MPO' }, leadTime: 12 }
    }
    
    return specs[speed as keyof typeof specs] || specs['25G']
  }
  
  private static calculateCableRequirements(fabric: any, topology: any) {
    // Calculate fabric internal connections (spine-leaf)
    const fabricConnections = topology.leavesNeeded * (fabric.leafClasses?.[0]?.uplinksPerLeaf || 2)
    
    // Calculate server connections
    const serverConnections = topology.usedPorts / 2 // Approximate server connections
    
    return {
      'DAC-1m': Math.floor(fabricConnections * 0.3), // Short spine-leaf connections
      'DAC-3m': Math.floor(fabricConnections * 0.7), // Longer spine-leaf connections
      'Fiber-OM4-5m': Math.floor(serverConnections * 0.8), // Server connections
      'Fiber-OM4-10m': Math.floor(serverConnections * 0.2) // Longer server connections
    }
  }
  
  private static generateCableEntries(
    cableRequirements: Record<string, number>, 
    fabric: 'frontend' | 'backend'
  ): BOMComponent[] {
    const cableSpecs = {
      'DAC-1m': { price: 100, specs: { length: '1m', type: 'Direct Attach Copper' } },
      'DAC-3m': { price: 150, specs: { length: '3m', type: 'Direct Attach Copper' } },
      'Fiber-OM4-5m': { price: 80, specs: { length: '5m', type: 'OM4 Multimode Fiber' } },
      'Fiber-OM4-10m': { price: 120, specs: { length: '10m', type: 'OM4 Multimode Fiber' } }
    }
    
    return Object.entries(cableRequirements)
      .filter(([_, quantity]) => quantity > 0)
      .map(([cableType, quantity]) => {
        const spec = cableSpecs[cableType as keyof typeof cableSpecs]
        return {
          id: `cable-${cableType}-${fabric}`,
          category: 'cable' as const,
          model: cableType,
          manufacturer: 'Generic',
          quantity,
          unitPrice: spec.price,
          totalPrice: quantity * spec.price,
          fabric,
          specification: spec.specs,
          leadTime: 2
        }
      })
  }
  
  private static analyzeNicDistribution(servers: any[]) {
    const distribution = {
      totalServers: servers.length,
      averageNicsPerServer: servers.length > 0 ? 
        servers.reduce((sum, s) => sum + s.totalNics, 0) / servers.length : 0,
      nicPurposes: {} as Record<string, number>
    }
    
    servers.forEach(server => {
      server.nicAllocations.forEach((alloc: any) => {
        const purpose = alloc.purpose || 'general'
        distribution.nicPurposes[purpose] = (distribution.nicPurposes[purpose] || 0) + alloc.nicCount
      })
    })
    
    return distribution
  }
  
  private static getTotalSwitches(spec: DualFabricSpec): number {
    const frontendTopology = this.computeFabricTopology(spec, 'frontend')
    const backendTopology = this.computeFabricTopology(spec, 'backend')
    
    return frontendTopology.spinesNeeded + frontendTopology.leavesNeeded +
           backendTopology.spinesNeeded + backendTopology.leavesNeeded
  }
  
  private static estimateTotalPowerConsumption(spec: DualFabricSpec): number {
    // Server power consumption
    const serverPower = spec.sharedServers.reduce((total, server) => {
      const serverSpec = this.getServerSpec(server.serverType || 'general-purpose')
      return total + serverSpec.powerConsumption
    }, 0)
    
    // Switch power consumption
    const switchPower = this.getTotalSwitches(spec) * 300 // Average 300W per switch
    
    return serverPower + switchPower
  }
  
  private static calculateCostSummary(components: BOMComponent[]): BOMCostSummary {
    const subtotalByCategory = components.reduce((totals, component) => {
      totals[component.category] = (totals[component.category] || 0) + component.totalPrice
      return totals
    }, {} as Record<string, number>)
    
    const subtotalByFabric = components.reduce((totals, component) => {
      const fabric = component.fabric || 'shared'
      totals[fabric] = (totals[fabric] || 0) + component.totalPrice
      return totals
    }, { frontend: 0, backend: 0, shared: 0 } as any)
    
    subtotalByFabric.total = subtotalByFabric.frontend + subtotalByFabric.backend + subtotalByFabric.shared
    
    // Apply tax and shipping estimates
    const taxRate = 0.08 // 8% tax rate
    const taxAmount = subtotalByFabric.total * taxRate
    const shippingCost = Math.max(5000, subtotalByFabric.total * 0.02) // 2% or minimum $5k
    const grandTotal = subtotalByFabric.total + taxAmount + shippingCost
    
    return {
      subtotalByCategory,
      subtotalByFabric,
      taxRate,
      taxAmount,
      shippingCost,
      grandTotal
    }
  }
  
  private static calculateMetadata(components: BOMComponent[], spec: DualFabricSpec) {
    const totalDevices = components
      .filter(c => c.category === 'switch' || c.category === 'server')
      .reduce((sum, c) => sum + c.quantity, 0)
    
    const totalCables = components
      .filter(c => c.category === 'cable')
      .reduce((sum, c) => sum + c.quantity, 0)
    
    const estimatedPowerConsumption = components
      .reduce((sum, c) => sum + (c.powerConsumption || 0), 0)
    
    // Estimate rack space (42U racks)
    const rackSpaceRequired = Math.ceil((totalDevices * 2) / 42) // ~2RU per device average
    
    return {
      totalDevices,
      totalCables,
      estimatedPowerConsumption,
      rackSpaceRequired
    }
  }
}