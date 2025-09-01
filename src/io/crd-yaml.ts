import * as yaml from 'js-yaml'
import type { WiringDiagram } from '../app.types.js'
import type { 
  FabricDeploymentCRDs, 
  FabricCRD, 
  HNCSwitchCRD, 
  HNCServerCRD, 
  HNCConnectionCRD,
  LegacyFabricImport 
} from '../fabric.types.js'

/**
 * CRD-compliant YAML serialization for upstream compatibility
 * Converts HNC WiringDiagram to upstream CRD format
 */

export interface CRDYAMLs {
  fabric: string
  switches: string
  servers: string
  connections: string
}

export interface CRDSerializationOptions {
  namespace?: string
  generateK8sMetadata?: boolean
  preserveHNCExtensions?: boolean
  apiVersionOverride?: {
    fabric?: string
    switch?: string
    server?: string
    connection?: string
  }
}

/**
 * Convert WiringDiagram to CRD-compliant YAML structure
 * Generates separate CRD YAML documents for each resource type
 */
export function serializeWiringDiagramToCRDs(
  diagram: WiringDiagram,
  options: CRDSerializationOptions = {}
): CRDYAMLs {
  const opts = {
    namespace: 'default',
    generateK8sMetadata: true,
    preserveHNCExtensions: true,
    ...options
  }

  const fabricCRDs = convertWiringDiagramToFabricCRDs(diagram, opts)

  return {
    fabric: serializeK8sResource(fabricCRDs.fabric),
    switches: serializeK8sResourceArray(fabricCRDs.switches),
    servers: serializeK8sResourceArray(fabricCRDs.servers),
    connections: serializeK8sResourceArray(fabricCRDs.connections)
  }
}

/**
 * Convert WiringDiagram to FabricDeploymentCRDs structure
 */
export function convertWiringDiagramToFabricCRDs(
  diagram: WiringDiagram,
  options: CRDSerializationOptions
): FabricDeploymentCRDs {
  const { namespace = 'default', generateK8sMetadata = true, preserveHNCExtensions = true } = options

  // Generate fabric-level CRD
  const fabricCRD: FabricCRD = {
    apiVersion: (options.apiVersionOverride?.fabric || 'fabric.githedgehog.com/v1beta1') as 'fabric.githedgehog.com/v1beta1',
    kind: 'Fabric',
    metadata: generateK8sMetadata ? {
      name: sanitizeK8sName(diagram.metadata.fabricName),
      namespace,
      labels: {
        'app.kubernetes.io/name': 'hnc-fabric',
        'app.kubernetes.io/component': 'fabric-topology',
        'hnc.githedgehog.com/fabric': sanitizeK8sName(diagram.metadata.fabricName)
      },
      annotations: {
        'hnc.githedgehog.com/generated-at': diagram.metadata.generatedAt.toISOString(),
        'hnc.githedgehog.com/total-devices': diagram.metadata.totalDevices.toString()
      }
    } : { name: sanitizeK8sName(diagram.metadata.fabricName), namespace },
    spec: {
      switches: [...diagram.devices.spines, ...diagram.devices.leaves].map(s => s.id),
      servers: diagram.devices.servers.map(s => s.id),
      connections: diagram.connections.map(c => `${c.from.device}-${c.to.device}-${c.from.port}-${c.to.port}`),
      topology: {
        spineLeaf: {
          spines: diagram.devices.spines.length,
          leafs: diagram.devices.leaves.length,
          fabricLinks: diagram.connections.filter(c => 
            diagram.devices.spines.some(s => s.id === c.from.device) && 
            diagram.devices.leaves.some(l => l.id === c.to.device)
          ).length
        }
      }
    },
    status: generateK8sMetadata ? {
      conditions: [{
        type: 'Ready',
        status: 'True',
        lastTransitionTime: new Date().toISOString(),
        reason: 'FabricGenerated',
        message: 'Fabric topology generated successfully'
      }],
      totalSwitches: diagram.devices.spines.length + diagram.devices.leaves.length,
      totalServers: diagram.devices.servers.length,
      totalConnections: diagram.connections.length
    } : undefined
  }

  // Generate switch CRDs
  const switchCRDs: HNCSwitchCRD[] = [
    ...diagram.devices.spines.map(spine => createSwitchCRD(spine, 'spine', options)),
    ...diagram.devices.leaves.map(leaf => createSwitchCRD(leaf, 'leaf', options))
  ]

  // Generate server CRDs
  const serverCRDs: HNCServerCRD[] = diagram.devices.servers.map(server => 
    createServerCRD(server, options)
  )

  // Generate connection CRDs
  const connectionCRDs: HNCConnectionCRD[] = diagram.connections.map(connection =>
    createConnectionCRD(connection, diagram, options)
  )

  return {
    fabric: fabricCRD,
    switches: switchCRDs,
    servers: serverCRDs,
    connections: connectionCRDs
  }
}

/**
 * Create a switch CRD from HNC switch data
 */
function createSwitchCRD(
  switchData: any,
  role: 'spine' | 'leaf',
  options: CRDSerializationOptions
): HNCSwitchCRD {
  const { namespace = 'default', generateK8sMetadata = true, preserveHNCExtensions = true } = options

  return {
    apiVersion: (options.apiVersionOverride?.switch || 'wiring.githedgehog.com/v1beta1') as 'wiring.githedgehog.com/v1beta1',
    kind: 'Switch',
    metadata: generateK8sMetadata ? {
      name: switchData.id,
      namespace,
      labels: {
        'app.kubernetes.io/name': 'hnc-switch',
        'app.kubernetes.io/component': 'network-switch',
        'hnc.githedgehog.com/role': role,
        'hnc.githedgehog.com/model': switchData.model
      }
    } : { name: switchData.id, namespace },
    spec: {
      role,
      profile: `${switchData.model.toLowerCase()}-profile`,
      ...(preserveHNCExtensions && {
        hncMetadata: {
          fabricRole: role,
          uplinkPorts: role === 'leaf' ? 4 : undefined,
          downlinkPorts: role === 'spine' ? 32 : undefined,
          endpointPorts: role === 'leaf' ? switchData.ports - 4 : undefined
        }
      })
    }
  }
}

/**
 * Create a server CRD from HNC server data
 */
function createServerCRD(
  serverData: any,
  options: CRDSerializationOptions
): HNCServerCRD {
  const { namespace = 'default', generateK8sMetadata = true, preserveHNCExtensions = true } = options

  return {
    apiVersion: (options.apiVersionOverride?.server || 'wiring.githedgehog.com/v1beta1') as 'wiring.githedgehog.com/v1beta1',
    kind: 'Server',
    metadata: generateK8sMetadata ? {
      name: serverData.id,
      namespace,
      labels: {
        'app.kubernetes.io/name': 'hnc-server',
        'app.kubernetes.io/component': 'endpoint-server',
        'hnc.githedgehog.com/type': serverData.type || 'server'
      }
    } : { name: serverData.id, namespace },
    spec: {
      description: `Server ${serverData.id} (${serverData.type || 'server'})`,
      profile: `${(serverData.type || 'server').toLowerCase()}-profile`,
      ...(preserveHNCExtensions && {
        hncMetadata: {
          endpointType: serverData.type || 'server',
          connectionCount: serverData.connections || 1,
          redundancy: (serverData.connections || 1) > 1
        }
      })
    }
  }
}

/**
 * Create a connection CRD from HNC connection data
 */
function createConnectionCRD(
  connectionData: any,
  diagram: WiringDiagram,
  options: CRDSerializationOptions
): HNCConnectionCRD {
  const { namespace = 'default', generateK8sMetadata = true, preserveHNCExtensions = true } = options

  // Determine connection type based on device roles
  let connectionType: 'uplink' | 'downlink' | 'endpoint' | 'fabric' = 'fabric'
  const fromDevice = [...diagram.devices.spines, ...diagram.devices.leaves, ...diagram.devices.servers]
    .find(d => d.id === connectionData.from.device)
  const toDevice = [...diagram.devices.spines, ...diagram.devices.leaves, ...diagram.devices.servers]
    .find(d => d.id === connectionData.to.device)

  if (fromDevice && toDevice) {
    const fromIsSpine = diagram.devices.spines.some(s => s.id === fromDevice.id)
    const fromIsLeaf = diagram.devices.leaves.some(l => l.id === fromDevice.id)
    const fromIsServer = diagram.devices.servers.some(s => s.id === fromDevice.id)
    
    const toIsSpine = diagram.devices.spines.some(s => s.id === toDevice.id)
    const toIsLeaf = diagram.devices.leaves.some(l => l.id === toDevice.id)
    const toIsServer = diagram.devices.servers.some(s => s.id === toDevice.id)

    if (fromIsLeaf && toIsSpine) connectionType = 'uplink'
    else if (fromIsSpine && toIsLeaf) connectionType = 'downlink'
    else if ((fromIsLeaf || fromIsSpine) && toIsServer) connectionType = 'endpoint'
    else if (fromIsServer && (toIsLeaf || toIsSpine)) connectionType = 'endpoint'
  }

  const connectionName = `${connectionData.from.device}-${connectionData.to.device}-${connectionData.from.port}-${connectionData.to.port}`

  return {
    apiVersion: (options.apiVersionOverride?.connection || 'wiring.githedgehog.com/v1beta1') as 'wiring.githedgehog.com/v1beta1',
    kind: 'Connection',
    metadata: generateK8sMetadata ? {
      name: sanitizeK8sName(connectionName),
      namespace,
      labels: {
        'app.kubernetes.io/name': 'hnc-connection',
        'app.kubernetes.io/component': 'network-connection',
        'hnc.githedgehog.com/type': connectionType,
        'hnc.githedgehog.com/from-device': connectionData.from.device,
        'hnc.githedgehog.com/to-device': connectionData.to.device
      }
    } : { name: sanitizeK8sName(connectionName), namespace },
    spec: {
      // Use unbundled connection type as the base CRD structure
      unbundled: {
        link: {
          server: connectionData.from.device.includes('server') ? connectionData.from.device : connectionData.to.device,
          switch: connectionData.from.device.includes('server') ? connectionData.to.device : connectionData.from.device
        }
      },
      ...(preserveHNCExtensions && {
        hncMetadata: {
          connectionType,
          portBinding: {
            sourcePort: connectionData.from.port,
            targetPort: connectionData.to.port
          }
        }
      })
    }
  }
}

/**
 * Deserialize CRD YAML structure back to WiringDiagram
 * Handles both CRD-compliant and legacy formats
 */
export function deserializeCRDsToWiringDiagram(yamls: CRDYAMLs): WiringDiagram {
  try {
    // Handle both single and multi-document YAML
    const fabricData = yaml.load(yamls.fabric) as FabricCRD
    const switchesData = (yamls.switches.includes('---') 
      ? yaml.loadAll(yamls.switches) 
      : [yaml.load(yamls.switches)]) as HNCSwitchCRD[]
    const serversData = (yamls.servers.includes('---') 
      ? yaml.loadAll(yamls.servers) 
      : [yaml.load(yamls.servers)]) as HNCServerCRD[]
    const connectionsData = (yamls.connections.includes('---') 
      ? yaml.loadAll(yamls.connections) 
      : [yaml.load(yamls.connections)]) as HNCConnectionCRD[]

    // Validate CRD structure
    if (!fabricData || fabricData.kind !== 'Fabric') {
      throw new Error('Invalid fabric CRD: missing or invalid kind')
    }

    // Extract spines and leaves from switches
    const spines = switchesData
      .filter(s => s.spec.role === 'spine')
      .map(s => ({
        id: s.metadata.name || '',
        model: s.spec.hncMetadata?.fabricRole === 'spine' ? 'DS3000' : 'DS3000',
        ports: s.spec.hncMetadata?.downlinkPorts || 64
      }))

    const leaves = switchesData
      .filter(s => s.spec.role === 'leaf' || s.spec.role === 'server-leaf' || s.spec.role === 'border-leaf')
      .map(s => ({
        id: s.metadata.name || '',
        model: s.spec.hncMetadata?.fabricRole === 'leaf' ? 'DS2000' : 'DS2000', 
        ports: (s.spec.hncMetadata?.endpointPorts || 44) + (s.spec.hncMetadata?.uplinkPorts || 4)
      }))

    // Extract servers
    const servers = serversData.map(s => ({
      id: s.metadata.name || '',
      type: s.spec.hncMetadata?.endpointType || 'server',
      connections: s.spec.hncMetadata?.connectionCount || 1
    }))

    // Extract connections and convert back to HNC format
    const connections = connectionsData.map(c => {
      const hncMeta = c.spec.hncMetadata
      if (hncMeta && hncMeta.portBinding) {
        return {
          from: {
            device: c.metadata.labels?.['hnc.githedgehog.com/from-device'] || '',
            port: hncMeta.portBinding.sourcePort
          },
          to: {
            device: c.metadata.labels?.['hnc.githedgehog.com/to-device'] || '',
            port: hncMeta.portBinding.targetPort
          },
          type: hncMeta.connectionType as 'uplink' | 'downlink' | 'endpoint'
        }
      }

      // Fallback: try to infer from connection spec
      const unbundled = c.spec.unbundled
      if (unbundled && unbundled.link) {
        return {
          from: { device: unbundled.link.server || '', port: 'eth0' },
          to: { device: unbundled.link.switch || '', port: '1/1' },
          type: 'endpoint' as const
        }
      }

      throw new Error(`Unable to parse connection: ${c.metadata.name}`)
    })

    // Reconstruct metadata
    const generatedAt = fabricData.metadata.annotations?.['hnc.githedgehog.com/generated-at']
      ? new Date(fabricData.metadata.annotations['hnc.githedgehog.com/generated-at'])
      : new Date()

    const diagram: WiringDiagram = {
      devices: { spines, leaves, servers },
      connections,
      metadata: {
        generatedAt,
        fabricName: fabricData.metadata.name || 'unnamed-fabric',
        totalDevices: spines.length + leaves.length + servers.length
      }
    }

    return diagram

  } catch (error) {
    throw new Error(`Failed to deserialize CRD YAML: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Convert legacy HNC format to CRD format for backwards compatibility
 */
export function convertLegacyToCRD(legacyData: LegacyFabricImport): CRDYAMLs {
  // Create a temporary WiringDiagram from legacy format
  const diagram: WiringDiagram = {
    devices: {
      spines: legacyData.switches.filter(s => s.type === 'spine').map(s => ({ id: s.id, model: s.model, ports: s.ports })),
      leaves: legacyData.switches.filter(s => s.type === 'leaf').map(s => ({ id: s.id, model: s.model, ports: s.ports })),
      servers: legacyData.servers.map(s => ({ id: s.id, type: s.type, connections: s.connections }))
    },
    connections: legacyData.connections,
    metadata: {
      generatedAt: new Date(legacyData.metadata.generatedAt),
      fabricName: legacyData.metadata.fabricName,
      totalDevices: legacyData.metadata.totalSwitches + legacyData.metadata.totalServers
    }
  }

  return serializeWiringDiagramToCRDs(diagram)
}

/**
 * Utility functions
 */
function serializeK8sResource(resource: any): string {
  return yaml.dump(resource, {
    sortKeys: true,
    indent: 2,
    lineWidth: 120,
    quotingType: '"'
  })
}

function serializeK8sResourceArray(resources: any[]): string {
  return resources.map(resource => 
    yaml.dump(resource, {
      sortKeys: true,
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    })
  ).join('---\n')
}

function sanitizeK8sName(name: string): string {
  // K8s names must be lowercase alphanumeric with hyphens
  return name.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 63)
}

/**
 * Semantic validation for round-trip testing
 */
export function validateCRDSemantics(
  original: FabricDeploymentCRDs,
  roundTripped: FabricDeploymentCRDs
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  semanticDifferences: Array<{
    path: string
    original: any
    roundTripped: any
    impact: 'breaking' | 'semantic' | 'cosmetic'
  }>
} {
  const errors: string[] = []
  const warnings: string[] = []
  const semanticDifferences: Array<{
    path: string
    original: any
    roundTripped: any
    impact: 'breaking' | 'semantic' | 'cosmetic'
  }> = []

  // Validate fabric-level consistency
  if (original.fabric.spec.switches.length !== roundTripped.fabric.spec.switches.length) {
    errors.push('Switch count mismatch after round-trip')
    semanticDifferences.push({
      path: 'fabric.spec.switches.length',
      original: original.fabric.spec.switches.length,
      roundTripped: roundTripped.fabric.spec.switches.length,
      impact: 'breaking'
    })
  }

  if (original.fabric.spec.servers.length !== roundTripped.fabric.spec.servers.length) {
    errors.push('Server count mismatch after round-trip')
    semanticDifferences.push({
      path: 'fabric.spec.servers.length',
      original: original.fabric.spec.servers.length,
      roundTripped: roundTripped.fabric.spec.servers.length,
      impact: 'breaking'
    })
  }

  // Validate topology preservation
  const origTopo = original.fabric.spec.topology?.spineLeaf
  const rtTopo = roundTripped.fabric.spec.topology?.spineLeaf
  
  if (origTopo && rtTopo) {
    if (origTopo.spines !== rtTopo.spines) {
      errors.push('Spine count topology mismatch')
      semanticDifferences.push({
        path: 'fabric.spec.topology.spineLeaf.spines',
        original: origTopo.spines,
        roundTripped: rtTopo.spines,
        impact: 'breaking'
      })
    }

    if (origTopo.leafs !== rtTopo.leafs) {
      errors.push('Leaf count topology mismatch')
      semanticDifferences.push({
        path: 'fabric.spec.topology.spineLeaf.leafs',
        original: origTopo.leafs,
        roundTripped: rtTopo.leafs,
        impact: 'breaking'
      })
    }
  }

  // Check for cosmetic differences (metadata, annotations, etc.)
  if (original.fabric.metadata.name !== roundTripped.fabric.metadata.name) {
    warnings.push('Fabric name changed during round-trip')
    semanticDifferences.push({
      path: 'fabric.metadata.name',
      original: original.fabric.metadata.name,
      roundTripped: roundTripped.fabric.metadata.name,
      impact: 'cosmetic'
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    semanticDifferences
  }
}