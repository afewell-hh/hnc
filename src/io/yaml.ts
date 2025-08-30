import * as yaml from 'js-yaml'
import { z } from 'zod'
import type { WiringDiagram } from '../app.types.js'

// YAML serialization structure - simplified for v0.2
interface SerializedYAMLs {
  servers: string
  switches: string 
  connections: string
}

// Zod schema for validation during deserialization
const SerializedWiringDiagramSchema = z.object({
  devices: z.object({
    spines: z.array(z.object({
      id: z.string(),
      model: z.string(), 
      ports: z.number()
    })),
    leaves: z.array(z.object({
      id: z.string(),
      model: z.string(),
      ports: z.number()
    })),
    servers: z.array(z.object({
      id: z.string(),
      type: z.string(),
      connections: z.number()
    }))
  }),
  connections: z.array(z.object({
    from: z.object({
      device: z.string(),
      port: z.string()
    }),
    to: z.object({
      device: z.string(),
      port: z.string()
    }),
    type: z.enum(['uplink', 'downlink', 'endpoint'])
  })),
  metadata: z.object({
    generatedAt: z.date(),
    fabricName: z.string(),
    totalDevices: z.number()
  })
})

/**
 * Serializes a WiringDiagram to separate YAML strings for servers, switches, and connections
 * Uses deterministic sorting for consistent output
 */
export function serializeWiringDiagram(diagram: WiringDiagram): SerializedYAMLs {
  // Servers YAML - includes both spines and leaves, plus endpoint servers
  const allSwitches = [
    ...diagram.devices.spines.map(s => ({ ...s, type: 'spine' as const })),
    ...diagram.devices.leaves.map(l => ({ ...l, type: 'leaf' as const }))
  ].sort((a, b) => a.id.localeCompare(b.id))

  const switchesData = {
    switches: allSwitches,
    metadata: {
      totalSwitches: allSwitches.length,
      generatedAt: diagram.metadata.generatedAt.toISOString()
    }
  }

  const serversData = {
    servers: diagram.devices.servers.sort((a, b) => a.id.localeCompare(b.id)),
    metadata: {
      totalServers: diagram.devices.servers.length,
      generatedAt: diagram.metadata.generatedAt.toISOString()
    }
  }

  const connectionsData = {
    connections: diagram.connections.sort((a, b) => 
      a.from.device.localeCompare(b.from.device) || 
      a.from.port.localeCompare(b.from.port)
    ),
    metadata: {
      totalConnections: diagram.connections.length,
      fabricName: diagram.metadata.fabricName,
      generatedAt: diagram.metadata.generatedAt.toISOString()
    }
  }

  return {
    servers: yaml.dump(serversData, { 
      sortKeys: true, 
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    }),
    switches: yaml.dump(switchesData, { 
      sortKeys: true, 
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    }),
    connections: yaml.dump(connectionsData, { 
      sortKeys: true, 
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    })
  }
}

/**
 * Deserializes YAML strings back to a WiringDiagram
 * Validates structure and reconstructs the complete diagram
 */
export function deserializeWiringDiagram(yamls: SerializedYAMLs): WiringDiagram {
  try {
    const serversData = yaml.load(yamls.servers) as any
    const switchesData = yaml.load(yamls.switches) as any
    const connectionsData = yaml.load(yamls.connections) as any

    // Validate basic structure
    if (!serversData || !Array.isArray(serversData.servers)) {
      throw new Error('Invalid servers data: missing or invalid servers array')
    }
    if (!switchesData || !Array.isArray(switchesData.switches)) {
      throw new Error('Invalid switches data: missing or invalid switches array')
    }
    if (!connectionsData || !Array.isArray(connectionsData.connections)) {
      throw new Error('Invalid connections data: missing or invalid connections array')
    }

    // Extract components from deserialized data
    const servers = serversData.servers
    const allSwitches = switchesData.switches
    const connections = connectionsData.connections

    // Separate spines and leaves
    const spines = allSwitches.filter((s: any) => s.type === 'spine')
      .map(({ type, ...rest }: any) => rest)
    const leaves = allSwitches.filter((s: any) => s.type === 'leaf')
      .map(({ type, ...rest }: any) => rest)

    // Reconstruct metadata - use the latest timestamp
    const timestamps = [
      serversData.metadata?.generatedAt,
      switchesData.metadata?.generatedAt,
      connectionsData.metadata?.generatedAt
    ].filter(Boolean)

    const latestTimestamp = timestamps.length > 0 
      ? new Date(Math.max(...timestamps.map(t => new Date(t).getTime())))
      : new Date()

    const diagram: WiringDiagram = {
      devices: { spines, leaves, servers },
      connections,
      metadata: {
        generatedAt: latestTimestamp,
        fabricName: connectionsData.metadata?.fabricName || 'unnamed-fabric',
        totalDevices: spines.length + leaves.length + servers.length
      }
    }

    // Validate the reconstructed diagram
    SerializedWiringDiagramSchema.parse(diagram)
    return diagram

  } catch (error) {
    throw new Error(`Failed to deserialize wiring diagram: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validates that a YAML string is well-formed
 */
export function validateYAML(yamlString: string): { isValid: boolean; error?: string } {
  try {
    yaml.load(yamlString)
    return { isValid: true }
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid YAML format' 
    }
  }
}