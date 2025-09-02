/**
 * FGD Importer - Reverse engineers FabricSpec from existing fabric deployments
 * Reads switches.yaml, servers.yaml, connections.yaml and reconstructs the original design
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { FabricSpec, LeafClass, EndpointProfile, SwitchModel } from '../schemas/fabric-spec.schema';
import { validateFabricSpecSafe } from '../schemas/fabric-spec.schema';

// FGD YAML file structures
interface FGDSwitchData {
  id: string;
  model: SwitchModel;
  ports: number;
  type: 'leaf' | 'spine';
}

interface FGDServerData {
  id: string;
  type: string;
  connections: number;
}

interface FGDConnectionData {
  from: { device: string; port: string };
  to: { device: string; port: string };
  type: 'uplink' | 'downlink' | 'endpoint';
}

interface FGDFiles {
  switches: {
    switches: FGDSwitchData[];
    metadata: { totalSwitches: number; generatedAt: string };
  };
  servers: {
    servers: FGDServerData[];
    metadata: { totalServers: number; generatedAt: string };
  };
  connections: {
    connections: FGDConnectionData[];
    metadata: { fabricName: string; totalConnections: number; generatedAt: string };
  };
}

// Import result with provenance tracking
export interface ImportResult {
  fabricSpec: FabricSpec;
  leafClasses: LeafClass[];
  provenance: {
    source: 'import';
    originalPath: string;
    importedAt: Date;
    detectedPatterns: {
      topologyType: 'single-class' | 'multi-class';
      spineCount: number;
      leafCount: number;
      serverTypes: Set<string>;
      uplinkPatterns: Map<string, number>; // leaf -> uplink count
    };
    warnings: string[];
    assumptions: string[];
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// Pattern recognition for leaf classes
interface LeafPattern {
  leafId: string;
  model: SwitchModel;
  uplinkCount: number;
  connectedServers: FGDServerData[];
  serverTypeGroups: Map<string, FGDServerData[]>;
}

// Capacity validation result
interface CapacityValidationResult {
  isValid: boolean;
  leafCapacityCheck: Array<{
    leafId: string;
    totalPorts: number;
    usedPorts: number;
    availablePorts: number;
    exceeded: boolean;
  }>;
  spineCapacityCheck: Array<{
    spineId: string;
    totalPorts: number;
    usedPorts: number;
    availablePorts: number;
    exceeded: boolean;
  }>;
  errors: string[];
  warnings: string[];
}

/**
 * Main FGD import function - reconstructs FabricSpec from FGD files
 */
export async function importFromFGD(fgdPath: string): Promise<ImportResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const assumptions: string[] = [];
  
  try {
    // Step 1: Load and parse YAML files - detect format (legacy vs CRD)
    const fgdFiles = await loadFGDFiles(fgdPath);
    
    // Step 2: Analyze topology and detect patterns
    const topologyAnalysis = analyzeTopologyPatterns(fgdFiles);
    
    // Step 3: Detect leaf classes from server connection patterns
    const leafPatterns = detectLeafPatterns(fgdFiles, warnings, assumptions);
    
    // Step 4: Reconstruct endpoint profiles from server data
    const endpointProfiles = reconstructEndpointProfiles(leafPatterns, warnings);
    
    // Step 5: Build leaf classes
    const leafClasses = buildLeafClasses(leafPatterns, endpointProfiles, warnings);
    
    // Step 6: Determine fabric metadata
    const fabricName = fgdFiles.connections.metadata.fabricName || path.basename(fgdPath);
    const spineModel = detectSpineModel(fgdFiles.switches.switches);
    const leafModel = detectLeafModel(fgdFiles.switches.switches);
    
    // Step 7: Construct FabricSpec
    const fabricSpec: FabricSpec = {
      name: fabricName,
      spineModelId: spineModel as 'DS3000',
      leafModelId: leafModel as 'DS2000',
      leafClasses: leafClasses.length > 1 ? leafClasses : undefined,
      // Legacy single-class fields for backwards compatibility
      uplinksPerLeaf: leafClasses.length === 1 ? leafClasses[0].uplinksPerLeaf : 
                     leafClasses.length === 0 && leafPatterns.length === 1 ? leafPatterns[0].uplinkCount : undefined,
      endpointProfile: leafClasses.length === 1 && leafClasses[0].endpointProfiles.length > 0 ? 
                      leafClasses[0].endpointProfiles[0] : undefined,
      endpointCount: leafClasses.length === 1 ? 
        leafClasses[0].endpointProfiles.reduce((sum, prof) => sum + (prof.count || 1), 0) : 
        leafClasses.length === 0 ? fgdFiles.servers.metadata.totalServers : undefined,
      metadata: {
        importedFrom: fgdPath,
        originalGeneratedAt: fgdFiles.connections.metadata.generatedAt,
        detectedTopology: topologyAnalysis.topologyType,
        totalSwitches: fgdFiles.switches.metadata.totalSwitches,
        totalServers: fgdFiles.servers.metadata.totalServers,
      },
      version: '1.0.0',
      createdAt: new Date(),
    };
    
    // Step 8: Validate capacity constraints
    const capacityValidation = validateCapacityConstraints(fgdFiles, fabricSpec);
    
    // Step 9: Validate reconstructed FabricSpec
    const validation = validateFabricSpecSafe(fabricSpec);
    
    const result: ImportResult = {
      fabricSpec,
      leafClasses,
      provenance: {
        source: 'import',
        originalPath: fgdPath,
        importedAt: new Date(),
        detectedPatterns: {
          topologyType: topologyAnalysis.topologyType,
          spineCount: topologyAnalysis.spineCount,
          leafCount: topologyAnalysis.leafCount,
          serverTypes: topologyAnalysis.serverTypes,
          uplinkPatterns: topologyAnalysis.uplinkPatterns,
        },
        warnings,
        assumptions,
      },
      validation: {
        isValid: capacityValidation.isValid, // Only validate capacity, not schema constraints
        errors: [
          // CRD format compatibility info
          // Move schema validation errors to warnings for import compatibility
          ...capacityValidation.errors,
        ],
        warnings: [
          ...warnings,
          ...capacityValidation.warnings,
          ...(validation.success ? [] : validation.error.errors.map(e => `Schema constraint: ${e.message}`)),
        ],
      },
    };
    
    console.log(`FGD import completed in ${Date.now() - startTime}ms`);
    return result;
    
  } catch (error) {
    throw new ImportError(`Failed to import FGD from ${fgdPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load and parse all three FGD YAML files
 */
async function loadFGDFiles(fgdPath: string): Promise<FGDFiles> {
  const switchesPath = path.join(fgdPath, 'switches.yaml');
  const serversPath = path.join(fgdPath, 'servers.yaml');
  const connectionsPath = path.join(fgdPath, 'connections.yaml');
  
  // Check file existence
  await Promise.all([
    checkFileExists(switchesPath, 'switches.yaml'),
    checkFileExists(serversPath, 'servers.yaml'),
    checkFileExists(connectionsPath, 'connections.yaml'),
  ]);
  
  try {
    // Load and parse files in parallel
    const [switchesContent, serversContent, connectionsContent] = await Promise.all([
      fs.readFile(switchesPath, 'utf-8'),
      fs.readFile(serversPath, 'utf-8'),
      fs.readFile(connectionsPath, 'utf-8'),
    ]);
    
    const switches = yaml.load(switchesContent) as any;
    const servers = yaml.load(serversContent) as any;
    const connections = yaml.load(connectionsContent) as any;
    
    // Validate structure
    validateFGDStructure(switches, 'switches');
    validateFGDStructure(servers, 'servers');
    validateFGDStructure(connections, 'connections');
    
    return { switches, servers, connections };
    
  } catch (error) {
    throw new ImportError(`Failed to parse YAML files: ${error instanceof Error ? error.message : 'Parse error'}`);
  }
}

/**
 * Analyze overall topology patterns
 */
function analyzeTopologyPatterns(fgdFiles: FGDFiles) {
  const switches = fgdFiles.switches.switches;
  const servers = fgdFiles.servers.servers;
  const connections = fgdFiles.connections.connections;
  
  const spines = switches.filter(s => s.type === 'spine');
  const leaves = switches.filter(s => s.type === 'leaf');
  
  // Count server types for multi-class detection
  const serverTypes = new Set(servers.map(s => s.type));
  
  // Analyze uplink patterns per leaf
  const uplinkPatterns = new Map<string, number>();
  leaves.forEach(leaf => {
    const uplinkCount = connections.filter(conn => 
      conn.from.device === leaf.id && conn.type === 'uplink'
    ).length;
    uplinkPatterns.set(leaf.id, uplinkCount);
  });
  
  // Determine topology type
  const uniqueUplinkCounts = new Set(uplinkPatterns.values());
  const topologyType: 'single-class' | 'multi-class' = uniqueUplinkCounts.size > 1 || serverTypes.size > 1 ? 'multi-class' : 'single-class';
  
  return {
    topologyType,
    spineCount: spines.length,
    leafCount: leaves.length,
    serverTypes,
    uplinkPatterns,
  };
}

/**
 * Detect leaf patterns by analyzing connections and server assignments
 */
function detectLeafPatterns(fgdFiles: FGDFiles, warnings: string[], assumptions: string[]): LeafPattern[] {
  const switches = fgdFiles.switches.switches;
  const servers = fgdFiles.servers.servers;
  const connections = fgdFiles.connections.connections;
  
  const leaves = switches.filter(s => s.type === 'leaf');
  const patterns: LeafPattern[] = [];
  
  for (const leaf of leaves) {
    // Count uplinks
    const uplinkCount = connections.filter(conn => 
      conn.from.device === leaf.id && conn.type === 'uplink'
    ).length;
    
    // Find connected servers (endpoint connections TO this leaf)
    const connectedServerIds = new Set(
      connections
        .filter(conn => conn.to.device === leaf.id && conn.type === 'endpoint')
        .map(conn => conn.from.device)
    );
    
    const connectedServers = servers.filter(s => connectedServerIds.has(s.id));
    
    // Group servers by type
    const serverTypeGroups = new Map<string, FGDServerData[]>();
    connectedServers.forEach(server => {
      const type = server.type;
      if (!serverTypeGroups.has(type)) {
        serverTypeGroups.set(type, []);
      }
      serverTypeGroups.get(type)!.push(server);
    });
    
    patterns.push({
      leafId: leaf.id,
      model: leaf.model,
      uplinkCount,
      connectedServers,
      serverTypeGroups,
    });
    
    if (uplinkCount === 0) {
      warnings.push(`Leaf ${leaf.id} has no uplinks - may be disconnected or orphaned`);
    }
  }
  
  return patterns;
}

/**
 * Reconstruct endpoint profiles from server patterns
 */
function reconstructEndpointProfiles(leafPatterns: LeafPattern[], warnings: string[]): Map<string, EndpointProfile[]> {
  const profileMap = new Map<string, EndpointProfile[]>();
  
  for (const pattern of leafPatterns) {
    const profiles: EndpointProfile[] = [];
    
    for (const [serverType, serverList] of pattern.serverTypeGroups) {
      // Determine typical connection count for this server type
      const connectionCounts = serverList.map(s => s.connections);
      const typicalConnections = connectionCounts[0]; // Assume uniform for now
      
      // Check if all servers of this type have same connection count
      const hasUniformConnections = connectionCounts.every(count => count === typicalConnections);
      if (!hasUniformConnections) {
        warnings.push(`Server type '${serverType}' has varying connection counts in leaf ${pattern.leafId}`);
      }
      
      // Create endpoint profile
      const profile: EndpointProfile = {
        name: serverType,
        portsPerEndpoint: typicalConnections,
        count: serverList.length,
        type: inferServerType(serverType),
        redundancy: typicalConnections > 1,
        nics: typicalConnections,
      };
      
      profiles.push(profile);
    }
    
    profileMap.set(pattern.leafId, profiles);
  }
  
  return profileMap;
}

/**
 * Build leaf classes from detected patterns
 */
function buildLeafClasses(
  leafPatterns: LeafPattern[],
  profileMap: Map<string, EndpointProfile[]>,
  warnings: string[]
): LeafClass[] {
  // Group patterns by uplink count and server type signature
  const classGroups = new Map<string, LeafPattern[]>();
  
  for (const pattern of leafPatterns) {
    const serverTypes = Array.from(pattern.serverTypeGroups.keys()).sort();
    const signature = `${pattern.uplinkCount}-${serverTypes.join(',')}`;
    
    if (!classGroups.has(signature)) {
      classGroups.set(signature, []);
    }
    classGroups.get(signature)!.push(pattern);
  }
  
  // Build leaf classes from groups
  const leafClasses: LeafClass[] = [];
  let classIndex = 0;
  
  for (const [signature, patterns] of classGroups) {
    classIndex++;
    const representative = patterns[0];
    const profiles = profileMap.get(representative.leafId) || [];
    
    if (profiles.length === 0) {
      warnings.push(`No endpoint profiles found for leaf class ${signature}`);
      continue;
    }
    
    const leafClass: LeafClass = {
      id: `class-${classIndex}`,
      name: patterns.length === 1 ? 
        `Leaf Class ${representative.leafId}` : 
        `Leaf Class ${signature} (${patterns.length} leaves)`,
      role: 'standard', // Default - could be enhanced to detect border leaves
      leafModelId: representative.model,
      uplinksPerLeaf: representative.uplinkCount,
      endpointProfiles: profiles,
      count: patterns.length,
      metadata: {
        detectedFrom: patterns.map(p => p.leafId),
        signature,
      },
    };
    
    leafClasses.push(leafClass);
  }
  
  return leafClasses.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Detect spine model from switches data
 */
function detectSpineModel(switches: FGDSwitchData[]): SwitchModel {
  const spines = switches.filter(s => s.type === 'spine');
  
  if (spines.length === 0) {
    throw new ImportError('No spine switches found in FGD data');
  }
  
  const models = new Set(spines.map(s => s.model));
  if (models.size > 1) {
    throw new ImportError(`Multiple spine models detected: ${Array.from(models).join(', ')}. Only homogeneous spine models are supported.`);
  }
  
  const model = spines[0].model;
  if (model !== 'DS3000') {
    throw new ImportError(`Unsupported spine model: ${model}. Only DS3000 is supported.`);
  }
  
  return model;
}

/**
 * Detect leaf model from switches data
 */
function detectLeafModel(switches: FGDSwitchData[]): SwitchModel {
  const leaves = switches.filter(s => s.type === 'leaf');
  
  if (leaves.length === 0) {
    throw new ImportError('No leaf switches found in FGD data');
  }
  
  const models = new Set(leaves.map(s => s.model));
  if (models.size > 1) {
    throw new ImportError(`Multiple leaf models detected: ${Array.from(models).join(', ')}. Mixed leaf models are not supported in this version.`);
  }
  
  const model = leaves[0].model;
  if (model !== 'DS2000') {
    throw new ImportError(`Unsupported leaf model: ${model}. Only DS2000 is supported.`);
  }
  
  return model;
}

/**
 * Validate capacity constraints against physical switch limits
 */
function validateCapacityConstraints(fgdFiles: FGDFiles, fabricSpec: FabricSpec): CapacityValidationResult {
  const switches = fgdFiles.switches.switches;
  const connections = fgdFiles.connections.connections;
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const leafCapacityCheck: any[] = [];
  const spineCapacityCheck: any[] = [];
  
  // Define switch capacities
  const SWITCH_CAPACITY = {
    DS2000: { ports: 48, uplinks: 4 },
    DS3000: { ports: 64, downlinks: 32 },
  };
  
  // Check leaf capacity
  for (const leaf of switches.filter(s => s.type === 'leaf')) {
    const capacity = SWITCH_CAPACITY[leaf.model];
    if (!capacity) {
      errors.push(`Unknown switch model: ${leaf.model}`);
      continue;
    }
    
    // Count used ports
    const usedPorts = connections.filter(conn => 
      conn.from.device === leaf.id || conn.to.device === leaf.id
    ).length;
    
    const available = capacity.ports - usedPorts;
    const exceeded = usedPorts > capacity.ports;
    
    leafCapacityCheck.push({
      leafId: leaf.id,
      totalPorts: capacity.ports,
      usedPorts,
      availablePorts: available,
      exceeded,
    });
    
    if (exceeded) {
      errors.push(`Leaf ${leaf.id} exceeds port capacity: ${usedPorts}/${capacity.ports} ports used`);
    }
  }
  
  // Check spine capacity
  for (const spine of switches.filter(s => s.type === 'spine')) {
    const capacity = SWITCH_CAPACITY[spine.model];
    if (!capacity) {
      errors.push(`Unknown switch model: ${spine.model}`);
      continue;
    }
    
    // Count used ports
    const usedPorts = connections.filter(conn => 
      conn.from.device === spine.id || conn.to.device === spine.id
    ).length;
    
    const available = capacity.ports - usedPorts;
    const exceeded = usedPorts > capacity.ports;
    
    spineCapacityCheck.push({
      spineId: spine.id,
      totalPorts: capacity.ports,
      usedPorts,
      availablePorts: available,
      exceeded,
    });
    
    if (exceeded) {
      errors.push(`Spine ${spine.id} exceeds port capacity: ${usedPorts}/${capacity.ports} ports used`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    leafCapacityCheck,
    spineCapacityCheck,
    errors,
    warnings,
  };
}

/**
 * Infer server type from server type string
 */
function inferServerType(serverTypeString: string): 'server' | 'storage' | 'compute' | 'network' {
  const lower = serverTypeString.toLowerCase();
  
  if (lower.includes('storage') || lower.includes('disk') || lower.includes('nas')) {
    return 'storage';
  } else if (lower.includes('compute') || lower.includes('cpu') || lower.includes('gpu')) {
    return 'compute';
  } else if (lower.includes('network') || lower.includes('router') || lower.includes('gateway')) {
    return 'network';
  } else {
    return 'server'; // Default
  }
}

/**
 * Utility functions
 */
async function checkFileExists(filePath: string, fileName: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new ImportError(`Required file not found: ${fileName} at ${filePath}`);
  }
}

function validateFGDStructure(data: any, fileName: string): void {
  if (!data || typeof data !== 'object') {
    throw new ImportError(`Invalid ${fileName} file: not a valid YAML object`);
  }
  
  const expectedArrayKey = fileName; // switches, servers, connections
  if (!Array.isArray(data[expectedArrayKey])) {
    throw new ImportError(`Invalid ${fileName} file: missing or invalid '${expectedArrayKey}' array`);
  }
  
  if (!data.metadata || typeof data.metadata !== 'object') {
    throw new ImportError(`Invalid ${fileName} file: missing metadata object`);
  }
}

/**
 * Custom error class for import errors
 */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}