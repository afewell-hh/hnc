/**
 * WP-L1 Part A: LeafClasses Schema and Types Example
 * Demonstrates the new multi-class fabric specification with backwards compatibility
 */

import type { FabricSpec, LeafClass, LAGConstraints } from '../schemas/fabric-spec.schema';
import { validateFabricSpec } from '../schemas/fabric-spec.schema';

// Example 1: Multi-class fabric with standard and border leafs
const multiClassFabric: FabricSpec = {
  name: 'production-fabric-v2',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000', // global default
  
  leafClasses: [
    {
      id: 'border-class',
      name: 'Border Leaf Class',
      role: 'border',
      // Uses global leafModelId (DS2000) since none specified
      uplinksPerLeaf: 4,
      endpointProfiles: [
        {
          name: 'fw-endpoints',
          portsPerEndpoint: 2,
          type: 'network',
          count: 8,
          redundancy: true
        },
        {
          name: 'lb-endpoints', 
          portsPerEndpoint: 1,
          type: 'network',
          count: 4,
          redundancy: false
        }
      ],
      count: 2,
      lag: {
        mcLag: {
          enabled: true,
          peerLinkCount: 2,
          systemPriority: 100
        }
      }
    },
    {
      id: 'compute-class',
      name: 'Compute Leaf Class',
      role: 'standard', 
      leafModelId: 'DS2000', // explicitly specified (same as global)
      uplinksPerLeaf: 2,
      endpointProfiles: [
        {
          name: 'server-dual',
          portsPerEndpoint: 2,
          type: 'server',
          count: 20,
          redundancy: true
        }
      ],
      count: 4,
      lag: {
        esLag: {
          enabled: true,
          minMembers: 2,
          maxMembers: 4,
          loadBalancing: 'hash-based'
        }
      }
    },
    {
      id: 'storage-class',
      name: 'Storage Leaf Class',
      role: 'standard',
      // Uses global leafModelId since none specified  
      uplinksPerLeaf: 2,
      endpointProfiles: [
        {
          name: 'storage-quad',
          portsPerEndpoint: 4,
          type: 'storage',
          count: 10,
          redundancy: false
        }
      ],
      count: 2
    }
  ]
};

// Example 2: Legacy single-class fabric (backwards compatibility)
const legacyFabric: FabricSpec = {
  name: 'legacy-fabric-v1',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  
  // Legacy fields (no leafClasses)
  uplinksPerLeaf: 2,
  endpointProfile: {
    name: 'server-single',
    portsPerEndpoint: 1,
    type: 'server',
    redundancy: false
  },
  endpointCount: 48
};

// Example 3: LAG constraints demonstration
const lagConstraints: LAGConstraints = {
  esLag: {
    enabled: true,
    minMembers: 2,
    maxMembers: 8,
    loadBalancing: 'round-robin'
  },
  mcLag: {
    enabled: true,
    peerLinkCount: 4,
    keepAliveInterval: 1000,
    systemPriority: 32768
  }
};

// Validation examples
try {
  // Multi-class fabric validation
  const validatedMultiClass = validateFabricSpec(multiClassFabric);
  console.log('Multi-class fabric validation:', validatedMultiClass.name);
  
  // Legacy fabric validation  
  const validatedLegacy = validateFabricSpec(legacyFabric);
  console.log('Legacy fabric validation:', validatedLegacy.name);
  
  // Demonstrate leafModelId defaults
  console.log('Border class model:', validatedMultiClass.leafClasses?.[0].leafModelId); // Should be DS2000
  console.log('Compute class model:', validatedMultiClass.leafClasses?.[1].leafModelId); // Should be DS2000
  console.log('Storage class model:', validatedMultiClass.leafClasses?.[2].leafModelId); // Should be DS2000
  
} catch (error) {
  console.error('Validation failed:', error);
}

// Type safety demonstration
function processLeafClass(leafClass: LeafClass): void {
  // TypeScript ensures all required fields are present
  console.log(`Processing ${leafClass.name} (${leafClass.role})`);
  console.log(`- Model: ${leafClass.leafModelId || 'default'}`);
  console.log(`- Uplinks: ${leafClass.uplinksPerLeaf}`);
  console.log(`- Profiles: ${leafClass.endpointProfiles.length}`);
  
  // LAG configuration access
  if (leafClass.lag?.esLag?.enabled) {
    console.log(`- ES-LAG: ${leafClass.lag.esLag.minMembers}-${leafClass.lag.esLag.maxMembers} members`);
  }
  if (leafClass.lag?.mcLag?.enabled) {
    console.log(`- MC-LAG: ${leafClass.lag.mcLag.peerLinkCount} peer links`);
  }
}

// Deterministic ordering verification  
function verifyOrdering(leafClasses: LeafClass[]): boolean {
  const ids = leafClasses.map(lc => lc.id);
  const sortedIds = [...ids].sort();
  return ids.every((id, index) => id === sortedIds[index]);
}

export {
  multiClassFabric,
  legacyFabric,
  lagConstraints,
  processLeafClass,
  verifyOrdering
};