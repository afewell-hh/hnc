/**
 * Port-Accurate Wiring Domain - HNC v0.4
 * Converts allocation results into deterministic wiring diagrams with YAML output
 */

import { expandPortRanges } from './portUtils';
import type { 
  FabricSpec,
  EndpointProfile,
  AllocationResult,
  LeafAllocation,
  UplinkAssignment,
  SwitchProfile
} from '../app.types';
import type {
  MultiClassAllocationResult
} from './types';
import * as yaml from 'js-yaml';
import { saveFGD, type FGDSaveOptions, type FGDSaveResult } from '../io/fgd';
import type { WiringDiagram } from '../app.types';

// Core Wiring Types
export interface WiringDevice {
  id: string;
  type: 'spine' | 'leaf' | 'server';
  modelId: string;
  ports: number;
  classId?: string; // For multi-class fabrics
}

export interface WiringConnection {
  id: string;
  from: { device: string; port: string };
  to: { device: string; port: string };
  type: 'uplink' | 'downlink' | 'endpoint';
}

export interface Wiring {
  devices: {
    spines: WiringDevice[];
    leaves: WiringDevice[];
    servers: WiringDevice[];
  };
  connections: WiringConnection[];
  metadata: {
    fabricName: string;
    fabricId: string;
    generatedAt: Date;
    totalDevices: number;
    totalConnections: number;
  };
}

export interface WiringValidationResult {
  errors: string[];
  warnings: string[];
}

export interface WiringYamlResult {
  switchesYaml: string;
  serversYaml: string;
  connectionsYaml: string;
}

/**
 * Builds a deterministic wiring diagram from allocation results
 * 
 * @param spec - Fabric specification
 * @param profiles - Switch profiles map  
 * @param allocation - Allocation result (single or multi-class)
 * @returns Complete Wiring with devices and connections
 */
export function buildWiring(
  spec: FabricSpec,
  profiles: Map<string, SwitchProfile>,
  allocation: AllocationResult | MultiClassAllocationResult
): Wiring {
  const spineProfile = profiles.get(spec.spineModelId);
  if (!spineProfile) {
    throw new Error(`Spine profile not found: ${spec.spineModelId}`);
  }

  const fabricId = generateFabricId(spec.name);
  const spinePorts = expandPortRanges(spineProfile.ports.fabricAssignable);
  
  // Handle multi-class or single-class allocation
  const isMultiClass = 'classAllocations' in allocation;
  
  if (isMultiClass) {
    return buildMultiClassWiring(spec, profiles, allocation, fabricId, spinePorts);
  } else {
    return buildSingleClassWiring(spec, profiles, allocation, fabricId, spinePorts);
  }
}

/**
 * Builds wiring for single-class (legacy) allocation
 */
function buildSingleClassWiring(
  spec: FabricSpec,
  profiles: Map<string, SwitchProfile>,
  allocation: AllocationResult,
  fabricId: string,
  spinePorts: string[]
): Wiring {
  const leafProfile = profiles.get(spec.leafModelId);
  if (!leafProfile) {
    throw new Error(`Leaf profile not found: ${spec.leafModelId}`);
  }

  const devices = {
    spines: [] as WiringDevice[],
    leaves: [] as WiringDevice[],
    servers: [] as WiringDevice[]
  };
  const connections: WiringConnection[] = [];

  // Create spine devices (deterministic naming: spine-1, spine-2, ...)
  const spinesNeeded = allocation.spineUtilization.length;
  for (let i = 1; i <= spinesNeeded; i++) {
    devices.spines.push({
      id: `spine-${i}`,
      type: 'spine',
      modelId: spec.spineModelId,
      ports: spinePorts.length
    });
  }

  // Track spine port usage for deterministic allocation
  const spinePortUsage = allocation.spineUtilization.map(() => 0);

  // Create leaf devices and uplink connections
  const leafPorts = expandPortRanges(leafProfile.ports.fabricAssignable);
  for (const leafAlloc of allocation.leafMaps) {
    const leafId = `leaf-${leafAlloc.leafId + 1}`;
    devices.leaves.push({
      id: leafId,
      type: 'leaf',
      modelId: spec.leafModelId,
      ports: leafPorts.length
    });

    // Create uplink connections
    let linkSeq = 1;
    for (const uplink of leafAlloc.uplinks) {
      const spineId = `spine-${uplink.toSpine + 1}`;
      // Use deterministic spine port allocation based on current usage
      const spinePortIndex = spinePortUsage[uplink.toSpine];
      const spinePort = spinePorts[spinePortIndex % spinePorts.length];
      spinePortUsage[uplink.toSpine]++;
      
      connections.push({
        id: `link-${leafId}-${spineId}-${linkSeq}`,
        from: { device: leafId, port: uplink.port },
        to: { device: spineId, port: spinePort },
        type: 'uplink'
      });
      linkSeq++;
    }
  }

  // Create server devices and endpoint connections
  if (spec.endpointProfile && spec.endpointCount) {
    createServersAndConnections(
      devices,
      connections,
      spec.endpointProfile,
      spec.endpointCount,
      'default',
      leafProfile,
      spec.uplinksPerLeaf || 0
    );
  }

  return {
    devices,
    connections: connections.sort((a, b) => a.id.localeCompare(b.id)),
    metadata: {
      fabricName: spec.name,
      fabricId,
      generatedAt: new Date(),
      totalDevices: devices.spines.length + devices.leaves.length + devices.servers.length,
      totalConnections: connections.length
    }
  };
}

/**
 * Builds wiring for multi-class allocation
 */
function buildMultiClassWiring(
  spec: FabricSpec,
  profiles: Map<string, SwitchProfile>,
  allocation: MultiClassAllocationResult,
  fabricId: string,
  spinePorts: string[]
): Wiring {
  const devices = {
    spines: [] as WiringDevice[],
    leaves: [] as WiringDevice[],
    servers: [] as WiringDevice[]
  };
  const connections: WiringConnection[] = [];

  // Create spine devices
  for (let i = 1; i <= allocation.spineUtilization.length; i++) {
    devices.spines.push({
      id: `spine-${i}`,
      type: 'spine',
      modelId: spec.spineModelId,
      ports: spinePorts.length
    });
  }

  // Process each leaf class
  const sortedClasses = [...(spec.leafClasses || [])].sort((a, b) => a.id.localeCompare(b.id));
  
  for (const leafClass of sortedClasses) {
    const classAllocation = allocation.classAllocations.find(ca => ca.classId === leafClass.id);
    if (!classAllocation) continue;

    const leafModelId = leafClass.leafModelId || spec.leafModelId;
    const leafProfile = profiles.get(leafModelId);
    if (!leafProfile) {
      throw new Error(`Leaf profile not found for class ${leafClass.id}: ${leafModelId}`);
    }

    const leafPorts = expandPortRanges(leafProfile.ports.fabricAssignable);

    // Create leaf devices for this class
    for (const leafAlloc of classAllocation.leafMaps) {
      const leafId = `leaf-${leafClass.id}-${leafAlloc.leafId - Math.min(...classAllocation.leafMaps.map(l => l.leafId)) + 1}`;
      devices.leaves.push({
        id: leafId,
        type: 'leaf',
        modelId: leafModelId,
        ports: leafPorts.length,
        classId: leafClass.id
      });

      // Create uplink connections for this leaf
      let linkSeq = 1;
      for (const uplink of leafAlloc.uplinks) {
        const spineId = `spine-${uplink.toSpine + 1}`;
        // Use a simple deterministic spine port index for now
        const spinePortIndex = uplink.toSpine; // Simplified for deterministic behavior
        const spinePort = spinePorts[spinePortIndex % spinePorts.length];
        
        connections.push({
          id: `link-${leafId}-${spineId}-${linkSeq}`,
          from: { device: leafId, port: uplink.port },
          to: { device: spineId, port: spinePort },
          type: 'uplink'
        });
        linkSeq++;
      }
    }

    // Create servers and endpoint connections for this class
    for (const endpointProfile of leafClass.endpointProfiles) {
      if (endpointProfile.count && endpointProfile.count > 0) {
        createServersAndConnections(
          devices,
          connections,
          endpointProfile,
          endpointProfile.count,
          leafClass.id,
          leafProfile,
          leafClass.uplinksPerLeaf
        );
      }
    }
  }

  return {
    devices,
    connections: connections.sort((a, b) => a.id.localeCompare(b.id)),
    metadata: {
      fabricName: spec.name,
      fabricId,
      generatedAt: new Date(),
      totalDevices: devices.spines.length + devices.leaves.length + devices.servers.length,
      totalConnections: connections.length
    }
  };
}

/**
 * Creates server devices and endpoint connections
 */
function createServersAndConnections(
  devices: { spines: WiringDevice[]; leaves: WiringDevice[]; servers: WiringDevice[] },
  connections: WiringConnection[],
  endpointProfile: EndpointProfile,
  endpointCount: number,
  classId: string,
  leafProfile: SwitchProfile,
  uplinksPerLeaf: number
) {
  const endpointPorts = expandPortRanges(leafProfile.ports.endpointAssignable);
  const downlinksPerLeaf = endpointPorts.length - uplinksPerLeaf;
  
  let serverIndex = 1;
  let leafIndex = 0;
  let portIndex = 0;

  for (let i = 0; i < endpointCount; i++) {
    const profileId = endpointProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const serverId = `srv-${classId}-${profileId}-${serverIndex}`;
    
    devices.servers.push({
      id: serverId,
      type: 'server',
      modelId: endpointProfile.type || 'server',
      ports: endpointProfile.portsPerEndpoint,
      classId
    });

    // Connect to leaf
    const targetLeafId = classId === 'default' 
      ? `leaf-${leafIndex + 1}`
      : `leaf-${classId}-${leafIndex + 1}`;
    const leafPort = endpointPorts[portIndex % endpointPorts.length];
    
    connections.push({
      id: `link-${serverId}-${targetLeafId}-1`,
      from: { device: serverId, port: 'eth0' },
      to: { device: targetLeafId, port: leafPort },
      type: 'endpoint'
    });

    serverIndex++;
    portIndex++;
    
    // Move to next leaf when current is full
    if (portIndex >= downlinksPerLeaf) {
      leafIndex++;
      portIndex = 0;
    }
  }
}

/**
 * Validates a wiring configuration for correctness
 */
export function validateWiring(wiring: Wiring): WiringValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate device names
  const allDeviceIds = [
    ...wiring.devices.spines.map(d => d.id),
    ...wiring.devices.leaves.map(d => d.id),
    ...wiring.devices.servers.map(d => d.id)
  ];
  const duplicateDevices = findDuplicates(allDeviceIds);
  if (duplicateDevices.length > 0) {
    errors.push(`Duplicate device IDs: ${duplicateDevices.join(', ')}`);
  }

  // Check for duplicate connection IDs
  const connectionIds = wiring.connections.map(c => c.id);
  const duplicateConnections = findDuplicates(connectionIds);
  if (duplicateConnections.length > 0) {
    errors.push(`Duplicate connection IDs: ${duplicateConnections.join(', ')}`);
  }

  // Check that all uplinks are mapped
  const uplinks = wiring.connections.filter(c => c.type === 'uplink');
  const leafDevices = wiring.devices.leaves;
  
  for (const leaf of leafDevices) {
    const leafUplinks = uplinks.filter(u => u.from.device === leaf.id);
    if (leafUplinks.length === 0) {
      warnings.push(`Leaf ${leaf.id} has no uplink connections`);
    }
  }

  // Check for port overlaps on same device
  const portUsage = new Map<string, Set<string>>();
  
  for (const connection of wiring.connections) {
    // Check 'from' device port usage
    const fromKey = connection.from.device;
    if (!portUsage.has(fromKey)) {
      portUsage.set(fromKey, new Set());
    }
    const fromPorts = portUsage.get(fromKey)!;
    if (fromPorts.has(connection.from.port)) {
      errors.push(`Port overlap: ${fromKey} port ${connection.from.port} used multiple times`);
    }
    fromPorts.add(connection.from.port);

    // Check 'to' device port usage
    const toKey = connection.to.device;
    if (!portUsage.has(toKey)) {
      portUsage.set(toKey, new Set());
    }
    const toPorts = portUsage.get(toKey)!;
    if (toPorts.has(connection.to.port)) {
      errors.push(`Port overlap: ${toKey} port ${connection.to.port} used multiple times`);
    }
    toPorts.add(connection.to.port);
  }

  // Check even distribution across spines
  const spineUtilization = wiring.devices.spines.map(spine => {
    return uplinks.filter(u => u.to.device === spine.id).length;
  });
  
  const minUtil = Math.min(...spineUtilization);
  const maxUtil = Math.max(...spineUtilization);
  
  if (maxUtil - minUtil > 1) {
    warnings.push(`Uneven spine utilization: min=${minUtil}, max=${maxUtil}`);
  }

  return { errors, warnings };
}

/**
 * Emits YAML files with deterministic ordering
 */
export function emitYaml(wiring: Wiring): WiringYamlResult {
  // Sort all arrays for deterministic output
  const sortedSpines = [...wiring.devices.spines].sort((a, b) => a.id.localeCompare(b.id));
  const sortedLeaves = [...wiring.devices.leaves].sort((a, b) => a.id.localeCompare(b.id));
  const sortedServers = [...wiring.devices.servers].sort((a, b) => a.id.localeCompare(b.id));
  const sortedConnections = [...wiring.connections].sort((a, b) => a.id.localeCompare(b.id));

  // Switches YAML (spines and leaves together)
  const switchesData = {
    switches: [
      ...sortedSpines.map(s => ({ ...s, role: 'spine' })),
      ...sortedLeaves.map(l => ({ ...l, role: 'leaf' }))
    ],
    metadata: {
      totalSwitches: sortedSpines.length + sortedLeaves.length,
      fabricName: wiring.metadata.fabricName,
      generatedAt: wiring.metadata.generatedAt.toISOString()
    }
  };

  // Servers YAML  
  const serversData = {
    servers: sortedServers,
    metadata: {
      totalServers: sortedServers.length,
      fabricName: wiring.metadata.fabricName,
      generatedAt: wiring.metadata.generatedAt.toISOString()
    }
  };

  // Connections YAML
  const connectionsData = {
    connections: sortedConnections,
    metadata: {
      totalConnections: sortedConnections.length,
      fabricName: wiring.metadata.fabricName,
      generatedAt: wiring.metadata.generatedAt.toISOString()
    }
  };

  // Generate YAML with consistent formatting
  const yamlOptions = {
    sortKeys: true,
    indent: 2,
    lineWidth: 120,
    quotingType: '"' as const
  };

  return {
    switchesYaml: yaml.dump(switchesData, yamlOptions),
    serversYaml: yaml.dump(serversData, yamlOptions),
    connectionsYaml: yaml.dump(connectionsData, yamlOptions)
  };
}

// Helper functions

/**
 * Generates a deterministic fabric ID from fabric name
 */
function generateFabricId(fabricName: string): string {
  return fabricName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'fabric';
}

/**
 * Finds duplicate values in an array
 */
function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  }
  
  return Array.from(duplicates);
}

/**
 * Gets the allocated spine port index for round-robin distribution
 */
function getAllocatedSpinePortIndex(spineId: number, spineUtilization: number[]): number {
  // This is a simplified implementation - in practice, you'd track actual port assignments
  return spineUtilization[spineId];
}

/**
 * Converts Wiring to WiringDiagram format for FGD compatibility
 */
export function wiringToWiringDiagram(wiring: Wiring): WiringDiagram {
  return {
    devices: {
      spines: wiring.devices.spines.map(s => ({
        id: s.id,
        model: s.modelId,
        ports: s.ports
      })),
      leaves: wiring.devices.leaves.map(l => ({
        id: l.id,
        model: l.modelId,
        ports: l.ports
      })),
      servers: wiring.devices.servers.map(s => ({
        id: s.id,
        type: s.modelId,
        connections: s.ports
      }))
    },
    connections: wiring.connections.map(c => ({
      from: { device: c.from.device, port: c.from.port },
      to: { device: c.to.device, port: c.to.port },
      type: c.type as 'uplink' | 'downlink' | 'endpoint'
    })),
    metadata: {
      generatedAt: wiring.metadata.generatedAt,
      fabricName: wiring.metadata.fabricName,
      totalDevices: wiring.metadata.totalDevices
    }
  };
}

/**
 * Writes wiring YAML files to FGD directory structure: ./fgd/<fabric-id>/
 * Creates: switches.yaml, servers.yaml, connections.yaml
 */
export async function writeWiringToFGD(
  wiring: Wiring,
  options: Omit<FGDSaveOptions, 'metadata' | 'version'>
): Promise<FGDSaveResult> {
  // Convert wiring to WiringDiagram format for FGD compatibility  
  const diagram = wiringToWiringDiagram(wiring);
  
  // Save using existing FGD infrastructure
  return saveFGD(diagram, {
    ...options,
    metadata: wiring.metadata,
    version: '0.4.0'
  });
}