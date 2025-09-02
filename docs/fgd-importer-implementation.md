# FGD Importer Implementation

## Overview

The FGD Importer (`src/domain/fgd-importer.ts`) is a comprehensive tool that reverse-engineers FabricSpec configurations from existing fabric deployments stored as Fabric Generated Data (FGD) YAML files.

## Key Features

### 🔄 Reverse Engineering
- **Topology Analysis**: Automatically detects spine/leaf architecture from connection patterns
- **Pattern Recognition**: Identifies single-class vs multi-class fabric designs
- **Capacity Reconstruction**: Reverse-engineers original uplinks per leaf and endpoint profiles
- **Model Detection**: Identifies DS2000/DS3000 switch models and validates compatibility

### 📊 Multi-Class Support
- **Class Detection**: Groups leaves by uplink count and server type patterns
- **Profile Generation**: Creates endpoint profiles from server connection analysis
- **Backwards Compatibility**: Supports both multi-class and legacy single-class formats

### 🛡️ Validation & Error Handling
- **Capacity Validation**: Checks against physical switch port limits (DS2000: 48 ports, DS3000: 64 ports)
- **Topology Validation**: Ensures spine-leaf connectivity is feasible
- **Graceful Degradation**: Imports with warnings rather than failing on schema constraint violations

### 📋 Provenance Tracking
- **Source Tracking**: Records original FGD path and import timestamp
- **Pattern Analysis**: Documents detected topology patterns and assumptions
- **Warning System**: Captures inconsistencies and edge cases encountered during import

## Architecture

### Core Components

1. **`importFromFGD(fgdPath: string)`** - Main entry point
2. **`loadFGDFiles()`** - YAML file parsing and validation
3. **`analyzeTopologyPatterns()`** - High-level topology analysis
4. **`detectLeafPatterns()`** - Leaf switch connection pattern detection
5. **`reconstructEndpointProfiles()`** - Server profile reconstruction
6. **`buildLeafClasses()`** - Leaf class generation from patterns
7. **`validateCapacityConstraints()`** - Physical capacity validation

### Data Flow

```
FGD Files → Parse YAML → Analyze Topology → Detect Patterns → 
Reconstruct Profiles → Build Classes → Validate Capacity → 
Generate FabricSpec → Track Provenance
```

## Supported Scenarios

### ✅ Happy Path Cases
- **Single-class fabrics** with uniform server types and uplink patterns
- **Multi-class fabrics** with different leaf classes serving different workloads
- **Complex topologies** with multiple spines and heterogeneous server distributions

### ⚠️ Edge Cases Handled
- **Disconnected leaves** (leaves with no uplinks)
- **Varying connection counts** (servers with different NIC configurations)
- **Empty fabrics** (switches without connected servers)
- **Capacity violations** (exceeding physical port limits)
- **Mixed server types** on the same leaf switches

### 🚨 Error Conditions
- **Missing FGD files** (switches.yaml, servers.yaml, connections.yaml required)
- **Malformed YAML** syntax or structure
- **Unknown switch models** (only DS2000/DS3000 supported)
- **Impossible topologies** (no spines or leaves detected)

## Usage Examples

### Basic Import
```typescript
import { importFromFGD } from '../src/domain/fgd-importer';

const result = await importFromFGD('./fgd/my-fabric');

if (result.validation.isValid) {
  console.log('Fabric:', result.fabricSpec.name);
  console.log('Uplinks per leaf:', result.fabricSpec.uplinksPerLeaf);
  console.log('Total servers:', result.fabricSpec.endpointCount);
}
```

### Multi-Class Handling
```typescript
const result = await importFromFGD('./fgd/multi-class-fabric');

if (result.fabricSpec.leafClasses) {
  // Multi-class topology
  result.fabricSpec.leafClasses.forEach(leafClass => {
    console.log(`Class ${leafClass.id}: ${leafClass.uplinksPerLeaf} uplinks`);
    leafClass.endpointProfiles.forEach(profile => {
      console.log(`  - ${profile.name}: ${profile.count} servers`);
    });
  });
} else {
  // Single-class legacy format
  console.log(`Single class: ${result.fabricSpec.uplinksPerLeaf} uplinks`);
}
```

### Error Handling
```typescript
try {
  const result = await importFromFGD('./fgd/problematic-fabric');
  
  if (!result.validation.isValid) {
    console.log('Validation errors:', result.validation.errors);
    console.log('Warnings:', result.validation.warnings);
  }
  
} catch (error) {
  if (error instanceof ImportError) {
    console.error('Import failed:', error.message);
  }
}
```

## Test Coverage

### Unit Tests (`fgd-importer.test.ts`)
- **24 test cases** covering happy path, error conditions, and edge cases
- **Capacity validation** scenarios including port limit violations
- **Pattern recognition** for single-class and multi-class topologies
- **Deterministic behavior** ensuring consistent results

### Integration Tests (`fgd-integration.test.ts`)
- **14 test cases** using real FGD files from the repository
- **End-to-end validation** with existing fabric deployments
- **Provenance verification** ensuring metadata preservation
- **Performance consistency** across different fabric sizes

## Implementation Details

### Switch Capacity Constants
```typescript
const SWITCH_CAPACITY = {
  DS2000: { ports: 48, uplinks: 4 },    // Leaf switch
  DS3000: { ports: 64, downlinks: 32 }, // Spine switch
};
```

### Topology Detection Logic
- **Spine Detection**: Switches with `type: 'spine'` and incoming uplink connections
- **Leaf Detection**: Switches with `type: 'leaf'` and outgoing uplink connections
- **Multi-Class Detection**: Different uplink counts OR different server types

### Pattern Recognition Algorithm
1. Group leaves by uplink count and server type signature
2. Create leaf classes for each unique pattern
3. Generate endpoint profiles from server connection analysis
4. Validate class consistency and capacity constraints

## Performance Characteristics

- **Import Speed**: ~10-15ms for small fabrics, ~50-100ms for large fabrics
- **Memory Usage**: Minimal - processes files sequentially
- **Scalability**: Tested with fabrics up to 1000+ servers

## Future Enhancements

### Potential Improvements
- **LAG Detection**: Enhanced support for Link Aggregation Groups
- **Border Leaf Detection**: Automatic identification of border vs standard leaves
- **Rack Awareness**: Physical layout reconstruction from connection patterns
- **Performance Metrics**: Bandwidth utilization and oversubscription analysis

### Extensibility Points
- **Switch Model Support**: Framework for adding new switch models
- **Custom Validators**: Pluggable validation system for specific constraints
- **Export Formats**: Support for generating other configuration formats

## Dependencies

- **js-yaml**: YAML parsing and serialization
- **zod**: Schema validation and type safety
- **Node.js fs/promises**: File system operations
- **path**: File path manipulation

## Error Types

- **`ImportError`**: Custom error class for import-specific failures
- **Validation Errors**: Schema constraint violations (moved to warnings for imports)
- **Capacity Errors**: Physical switch port limit violations
- **Parse Errors**: YAML syntax or structure issues