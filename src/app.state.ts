import { z } from 'zod'

// Re-export types from app.types.ts for backward compatibility
export type {
  SwitchModel,
  EndpointProfile,
  DerivedTopology,
  WiringConnection,
  WiringDiagram,
  FabricDesignContext,
  FabricDesignEvent
} from './app.types'
import type { DerivedTopology, WiringDiagram, WiringConnection } from './app.types'

// Zod schemas for validation
export const FabricSpecSchema = z.object({
  name: z.string().min(1, 'Fabric name is required'),
  spineModelId: z.string().min(1, 'Spine model ID is required'),
  leafModelId: z.string().min(1, 'Leaf model ID is required'),
  uplinksPerLeaf: z.number().int().min(2, 'Must have at least 2 uplinks per leaf').refine(val => val % 2 === 0, {
    message: 'Uplinks per leaf must be even for proper distribution'
  }),
  endpointProfile: z.object({
    name: z.string(),
    portsPerEndpoint: z.number().int().min(1)
  }),
  endpointCount: z.number().int().min(1, 'Must have at least 1 endpoint')
})

export type FabricSpec = z.infer<typeof FabricSpecSchema>

// Core computation functions
export const computeLeavesNeeded = (endpointCount: number, portsPerLeaf: number): number => 
  (portsPerLeaf <= 0 || endpointCount <= 0) ? 0 : Math.ceil(endpointCount / portsPerLeaf)

export const computeSpinesNeeded = (leaves: number, uplinksPerLeaf: number): number => 
  (leaves <= 0 || uplinksPerLeaf <= 0) ? 0 : Math.max(1, Math.ceil((leaves * uplinksPerLeaf) / 32))

export const computeOversubscription = (uplinks: number, downlinks: number): number => 
  uplinks <= 0 ? 0 : downlinks / uplinks

export const validateFabricSpec = (spec: unknown): { isValid: boolean; errors: string[]; data?: FabricSpec } => {
  try {
    const data = FabricSpecSchema.parse(spec)
    return { isValid: true, errors: [], data }
  } catch (error: unknown) {
    const errors = error instanceof z.ZodError 
      ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      : ['Invalid fabric specification']
    return { isValid: false, errors }
  }
}

export const computeTopology = (spec: FabricSpec): DerivedTopology => {
  const [leafPorts, spinePorts] = [48, 32] // DS2000/DS3000 stub
  const downlinkPorts = leafPorts - spec.uplinksPerLeaf
  const leavesNeeded = computeLeavesNeeded(spec.endpointCount, downlinkPorts)
  const spinesNeeded = computeSpinesNeeded(leavesNeeded, spec.uplinksPerLeaf)
  const totalPorts = (leavesNeeded * leafPorts) + (spinesNeeded * spinePorts)
  const usedPorts = spec.endpointCount + (leavesNeeded * spec.uplinksPerLeaf * 2)
  const oversubscriptionRatio = computeOversubscription(leavesNeeded * spec.uplinksPerLeaf, spec.endpointCount)

  const validationErrors: string[] = []
  if (leavesNeeded === 0) validationErrors.push('No leaves computed')
  if (spinesNeeded === 0) validationErrors.push('No spines computed')
  if (spec.uplinksPerLeaf > leafPorts / 2) validationErrors.push('Too many uplinks per leaf')
  if (oversubscriptionRatio > 4.0) validationErrors.push(`Oversubscription too high: ${oversubscriptionRatio.toFixed(2)}:1`)

  return { leavesNeeded, spinesNeeded, totalPorts, usedPorts, oversubscriptionRatio, 
    isValid: validationErrors.length === 0, validationErrors }
}

export const generateWiringStub = (fabric: FabricSpec, topology: DerivedTopology): WiringDiagram => {
  const spines = Array.from({ length: topology.spinesNeeded }, (_, i) => ({ 
    id: `spine-${i + 1}`, model: fabric.spineModelId, ports: 32 }))
  const leaves = Array.from({ length: topology.leavesNeeded }, (_, i) => ({ 
    id: `leaf-${i + 1}`, model: fabric.leafModelId, ports: 48 }))
  const servers = Array.from({ length: fabric.endpointCount }, (_, i) => ({ 
    id: `server-${i + 1}`, type: fabric.endpointProfile.name, connections: fabric.endpointProfile.portsPerEndpoint }))

  const connections: WiringConnection[] = []
  leaves.forEach((leaf, leafIdx) => {
    for (let uplink = 0; uplink < fabric.uplinksPerLeaf; uplink++) {
      const spineIdx = (leafIdx * fabric.uplinksPerLeaf + uplink) % spines.length
      connections.push({ from: { device: leaf.id, port: `uplink-${uplink + 1}` },
        to: { device: spines[spineIdx]!.id, port: `downlink-${connections.length + 1}` }, type: 'uplink' })
    }
  })

  return { devices: { spines, leaves, servers }, connections,
    metadata: { generatedAt: new Date(), fabricName: fabric.name, totalDevices: spines.length + leaves.length + servers.length }
  }
}

