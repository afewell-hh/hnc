# HNC Behavioral Contracts (v0.1 - v0.4)

This document serves as the definitive source of truth for all HNC behavior. Any changes to the system must maintain compatibility with these contracts unless explicitly documented as breaking changes.

## Version History

### v0.4 (Current)
- **Multi-Class Leaves**: Support for heterogeneous leaf configurations
- **LAG Constraints**: ES-LAG and MC-LAG validation system
- **Guard System**: Comprehensive constraint violation detection
- **Enhanced UI**: Per-class allocation tables and guard panels
- **FKS Drift Detection**: Mock Kubernetes API integration

### v0.3
- Multi-fabric workspace with YAML persistence
- Drift detection and status tracking
- Feature flag system (Git integration)
- Enhanced Storybook coverage

### v0.2
- Workspace management and fabric listing
- Navigation between workspace and designer

### v0.1
- Single fabric design and computation
- Port allocation algorithms
- Basic UI components

# HNC v0.4 Multi-Class Leaves & LAG Constraints

## v0.4 Core Features

### Multi-Class Leaf Configuration
HNC v0.4 introduces support for heterogeneous leaf configurations where different leaf classes can have varying:
- Switch models (DS2000, DS3000, custom models)
- Port counts and allocation requirements
- Endpoint counts per class
- LAG configuration constraints

### LAG Constraint System
Enterprise-grade LAG validation ensures:
- **ES-LAG**: Equal Split LAG constraints across spines
- **MC-LAG**: Multi-Chassis LAG validation
- **Port Grouping**: Automatic LAG member port allocation

### Guard System
Comprehensive constraint violation detection with categorized guards:
- **Configuration Guards**: Input validation and math constraints
- **Allocation Guards**: Port capacity and distribution validation
- **LAG Guards**: LAG constraint compliance
- **FKS Guards**: Kubernetes drift detection

---

# v0.4 Multi-Class Schema Contracts

## LeafClass Interface

```typescript
interface LeafClass {
  classId: string;              // Unique identifier (e.g., 'compute', 'storage')
  leafModelId: string;          // Switch model reference
  leafCount: number;            // Number of leaves in this class
  endpointCount: number;        // Endpoints per leaf in this class
  uplinksPerLeaf: number;       // Must be even, divisible by spinesNeeded
  lagEnabled?: boolean;         // Enable LAG constraints (default: false)
  lagSize?: number;             // Ports per LAG group (default: 2)
}
```

## Multi-Class vs Legacy Mode

### Multi-Class Mode (v0.4+)
```typescript
interface FabricSpec {
  // ... existing fields ...
  leafClasses: LeafClass[];     // Array of leaf classes
  isMultiClass: true;           // Explicit mode flag
}
```

### Legacy Single-Class Mode (v0.1-v0.3)
```typescript
interface FabricSpec {
  // ... existing fields ...  
  leafModelId: string;          // Single leaf model
  endpointCount: number;        // Total endpoints
  uplinksPerLeaf: number;       // Uniform uplinks per leaf
  isMultiClass: false;          // Legacy mode
}
```

## Guard System Contracts

### FabricGuard Types
```typescript
interface FabricGuard {
  id: string;                   // Unique guard identifier
  type: GuardType;              // Category of constraint
  severity: GuardSeverity;      // Impact level
  message: string;              // Human-readable description
  context?: Record<string, any>; // Additional context data
  autofix?: string;             // Suggested resolution
}

type GuardType = 
  | 'config'                    // Configuration validation
  | 'allocation'                // Port allocation constraints  
  | 'lag'                       // LAG constraints
  | 'fks'                       // FKS/Kubernetes drift
  | 'capacity';                 // Resource capacity limits

type GuardSeverity = 
  | 'error'                     // Blocks save operation
  | 'warning'                   // Allows save with notice
  | 'info';                     // Informational only
```

### Guard Categories

#### Configuration Guards
- **even-uplinks**: `uplinksPerLeaf % 2 === 0`
- **divisible-uplinks**: `uplinksPerLeaf % spinesNeeded === 0`
- **positive-values**: All counts > 0
- **unique-class-ids**: No duplicate classId values
- **valid-models**: All leaf models exist in switch catalog

#### Allocation Guards  
- **spine-capacity**: Total uplinks ≤ spine fabricAssignable ports
- **leaf-capacity**: Endpoint allocation ≤ leaf endpointAssignable ports
- **port-distribution**: Even distribution across spines possible

#### LAG Guards
- **es-lag-compliance**: Equal split LAG requirements
- **mc-lag-validation**: Multi-chassis LAG constraints
- **lag-port-grouping**: Proper LAG member port allocation
- **lag-size-constraints**: LAG size matches uplink allocation

#### FKS Guards
- **drift-detection**: File vs Kubernetes state comparison
- **resource-existence**: Referenced K8s resources exist
- **configuration-sync**: Config alignment with K8s

## Multi-Class Computation Contract

### Enhanced computeDerived() Function
```typescript
function computeDerived(config: FabricSpec): DerivedTopology {
  if (config.isMultiClass) {
    return computeMultiClassDerived(config);
  } else {
    return computeLegacyDerived(config);  // v0.1-v0.3 compatibility
  }
}

interface DerivedTopology {
  // Legacy fields (preserved)
  leavesNeeded: number;
  spinesNeeded: number;
  oversubscriptionRatio: number;
  totalEndpoints: number;
  
  // v0.4 Multi-class fields
  classSummary?: LeafClassSummary[];    // Per-class topology metrics
  totalLeafCount?: number;              // Sum of all class leaf counts
  lagConstraints?: LAGConstraint[];     // Active LAG constraints
  guards: FabricGuard[];                // All constraint violations
}

interface LeafClassSummary {
  classId: string;
  leafCount: number;
  endpointsPerLeaf: number;
  totalEndpoints: number;
  uplinksPerLeaf: number;
  totalUplinks: number;
  lagGroups?: number;                   // Number of LAG groups per leaf
}
```

### LAG Constraint Processing
```typescript
interface LAGConstraint {
  classId: string;
  type: 'ES-LAG' | 'MC-LAG';
  lagSize: number;                      // Ports per LAG group
  groupsPerLeaf: number;                // LAG groups per leaf
  totalGroups: number;                  // Total LAG groups in class
  spineDistribution: number[];          // LAG groups per spine
}
```

## Multi-Class Port Allocation

### Enhanced allocateUplinks() Contract
```typescript
function allocateUplinks(
  spec: AllocationSpec | MultiClassAllocationSpec,
  leafProfile: SwitchProfile | SwitchProfile[],
  spineProfile: SwitchProfile
): AllocationResult | MultiClassAllocationResult
```

### MultiClassAllocationSpec
```typescript
interface MultiClassAllocationSpec {
  classes: {
    classId: string;
    leafModelId: string;
    leafCount: number;
    uplinksPerLeaf: number;
    endpointCount: number;
    lagEnabled: boolean;
    lagSize: number;
  }[];
  spinesNeeded: number;
  totalEndpoints: number;
}
```

### MultiClassAllocationResult  
```typescript
interface MultiClassAllocationResult {
  success: boolean;
  classMaps: ClassAllocationMap[];      // One per leaf class
  spineUtilization: number[];           // Ports used per spine
  guards: FabricGuard[];                // Constraint violations
  lagGroups?: LAGGroupAllocation[];     // LAG group assignments
}

interface ClassAllocationMap {
  classId: string;
  leafMaps: LeafAllocation[];           // One per leaf in class
  classGuards: FabricGuard[];           // Class-specific violations
}

interface LAGGroupAllocation {
  classId: string;
  leafId: number;
  lagGroupId: number;
  ports: string[];                      // Member ports in LAG
  targetSpines: number[];               // Connected spine IDs
}
```

## FKS Drift Detection Contracts

### Mock Kubernetes Integration
```typescript
interface FKSDriftService {
  enabled: boolean;
  
  // Compare fabric config with mock K8s state
  detectDrift(fabricSpec: FabricSpec): Promise<FKSDriftResult>;
  
  // Mock K8s API responses  
  getMockClusterState(): Promise<MockKubernetesState>;
  
  // Generate drift guards
  analyzeDrift(fabric: FabricSpec, k8sState: MockKubernetesState): FabricGuard[];
}

interface FKSDriftResult {
  hasDrift: boolean;
  guards: FabricGuard[];
  summary: {
    configurationDrift: number;         // Config mismatches
    resourceDrift: number;              // Missing/extra resources
    networkDrift: number;               // Network topology changes
  };
  recommendations: string[];            // Suggested fixes
}

interface MockKubernetesState {
  nodes: MockK8sNode[];
  networks: MockK8sNetwork[];
  configMaps: MockK8sConfigMap[];
  lastSync: string;                     // ISO timestamp
}
```

### FKS Guard Generation
```typescript
// Configuration drift detection
if (k8sNodes.length !== fabricSpec.totalLeafCount) {
  guards.push({
    id: 'fks-node-count-mismatch',
    type: 'fks',
    severity: 'warning', 
    message: `Node count mismatch: fabric has ${fabricSpec.totalLeafCount} leaves, K8s has ${k8sNodes.length} nodes`,
    context: { expected: fabricSpec.totalLeafCount, actual: k8sNodes.length },
    autofix: 'Sync node count with fabric configuration'
  });
}
```

## Enhanced UI Components

### GuardPanel Component
```typescript
interface GuardPanelProps {
  guards: FabricGuard[];
  onAutofixGuard?: (guardId: string) => void;
  onDismissGuard?: (guardId: string) => void;
  groupByType?: boolean;
  showSeverityIcons?: boolean;
}

// Usage in Designer
<GuardPanel 
  guards={computedTopology.guards}
  groupByType={true}
  onAutofixGuard={handleAutofix}
/>
```

### Multi-Class Allocation Tables
```typescript
interface AllocationTableProps {
  classMaps: ClassAllocationMap[];
  spineUtilization: number[];
  showLAGGroups?: boolean;
  onClassToggle?: (classId: string) => void;
}

// Per-class allocation display
{classMaps.map(classMap => (
  <ClassAllocationSection key={classMap.classId}>
    <ClassHeader classId={classMap.classId} />
    <LeafAllocationTable leafMaps={classMap.leafMaps} />
    {showLAGGroups && <LAGGroupTable lagGroups={classMap.lagGroups} />}
    <ClassGuards guards={classMap.classGuards} />
  </ClassAllocationSection>
))}
```

### LAG Visualization
```typescript
interface LAGVisualizationProps {
  lagGroups: LAGGroupAllocation[];
  spineCount: number;
  showPortDetails?: boolean;
}

// LAG group visual representation
<LAGVisualization 
  lagGroups={allocationResult.lagGroups}
  spineCount={computedTopology.spinesNeeded}
  showPortDetails={true}
/>
```

## v0.4 Configuration Examples

### Multi-Class Configuration
```typescript
const multiClassConfig: FabricSpec = {
  name: "HPC-Cluster",
  spineModelId: "celestica-ds3000",
  isMultiClass: true,
  leafClasses: [
    {
      classId: "compute",
      leafModelId: "celestica-ds2000", 
      leafCount: 4,
      endpointCount: 32,               // 32 compute nodes per leaf
      uplinksPerLeaf: 4,
      lagEnabled: true,
      lagSize: 2
    },
    {
      classId: "storage", 
      leafModelId: "celestica-ds3000",
      leafCount: 2,
      endpointCount: 16,               // 16 storage nodes per leaf  
      uplinksPerLeaf: 6,
      lagEnabled: true,
      lagSize: 3
    }
  ],
  endpointProfile: {
    name: "25GbE Server",
    portsPerEndpoint: 2,
    speedGbps: 25
  }
};
```

### LAG-Enabled Single Class
```typescript
const lagEnabledConfig: FabricSpec = {
  name: "Storage-Fabric",
  spineModelId: "celestica-ds3000",
  isMultiClass: true,
  leafClasses: [
    {
      classId: "storage-only",
      leafModelId: "celestica-ds2000",
      leafCount: 6,
      endpointCount: 24,
      uplinksPerLeaf: 8,               // 8 uplinks = 4 LAG groups of size 2
      lagEnabled: true,
      lagSize: 2                       // 2-port LAG groups
    }
  ],
  endpointProfile: {
    name: "50GbE Storage",
    portsPerEndpoint: 4,
    speedGbps: 50
  }
};
```

## v0.4 Backwards Compatibility

### Legacy Mode Support
All v0.1-v0.3 configurations continue to work:
```typescript
// v0.3 config automatically converted to v0.4 format
const legacyConfig: FabricSpec = {
  name: "Legacy-Fabric",
  leafModelId: "celestica-ds2000",     // Converted to leafClasses[0].leafModelId
  spineModelId: "celestica-ds3000", 
  endpointCount: 96,                   // Converted to leafClasses[0].endpointCount
  uplinksPerLeaf: 4,                   // Converted to leafClasses[0].uplinksPerLeaf
  isMultiClass: false,                 // Explicit legacy mode
  endpointProfile: { /* ... */ }
};

// Internal conversion:
// legacyConfig -> { leafClasses: [{ classId: 'default', ...legacyConfig }] }
```

### API Compatibility Matrix
| Function | v0.1-v0.3 | v0.4 Multi-Class | Breaking Changes |
|----------|-----------|------------------|------------------|
| `computeDerived()` | ✅ | ✅ | None - automatic mode detection |
| `allocateUplinks()` | ✅ | ✅ | None - overloaded signatures |
| `saveFGD()` | ✅ | ✅ | None - schema versioning |
| `loadFGD()` | ✅ | ✅ | None - backward compatible |

## v0.4 Quality Gates

### Additional Testing Requirements
- Multi-class topology computation accuracy
- LAG constraint validation completeness  
- Guard system coverage for all constraint types
- FKS drift detection with mock K8s scenarios
- Cross-class port allocation correctness

### Performance Benchmarks (Updated)
- Multi-class computation < 200ms for 3 classes with 100 total endpoints
- Guard evaluation < 50ms for complex configurations
- FKS drift detection < 1000ms for medium cluster size
- LAG allocation < 150ms for 50 LAG groups

### New Storybook Coverage
- Multi-class configuration scenarios
- LAG constraint validation stories
- Guard panel interaction stories  
- FKS drift detection workflows
- Cross-class allocation visualization

## 1. FSM States and Events

### 1.1 Workspace Machine (`workspace.machine.ts`)

**State Chart:**
```
listing → error → listing
listing → selected → listing
selected → listing (via BACK_TO_LIST or DELETE_FABRIC)
```

**States:**
- `listing` - Default state, displays fabric list
- `selected` - Single fabric selected for design
- `error` - Validation errors occurred
- `creating` - Transitional state (unused in v0.3)

**Critical Events:**
```typescript
export type WorkspaceEvent =
  | { type: 'CREATE_FABRIC'; name: string }
  | { type: 'SELECT_FABRIC'; fabricId: string }
  | { type: 'DELETE_FABRIC'; fabricId: string }
  | { type: 'LIST_FABRICS' }
  | { type: 'UPDATE_FABRIC_STATUS'; fabricId: string; status: 'draft' | 'computed' | 'saved' }
  | { type: 'UPDATE_FABRIC_DRIFT'; fabricId: string; driftStatus: DriftStatus | null }
  | { type: 'UPDATE_FABRIC_GIT'; fabricId: string; gitStatus: GitStatus | null }
  | { type: 'CHECK_ALL_DRIFT' }
  | { type: 'CHECK_GIT_STATUS'; fabricId?: string }
  | { type: 'BACK_TO_LIST' }
```

**Invariants:**
- Fabric names must be unique within workspace
- Fabric names cannot be empty or whitespace-only
- selectedFabricId must be null when in 'listing' state
- selectedFabricId must match existing fabric ID when in 'selected' state
- errors array is cleared on successful state transitions

### 1.2 Fabric Design Machine (`app.machine.js`)

**State Chart:**
```
configuring → computed → saving → saved
configuring → invalid → configuring
configuring → loading → loaded → configuring
```

**States:**
- `configuring` - Input configuration parameters
- `computed` - Topology successfully computed with allocation
- `invalid` - Configuration validation failed
- `saving` - Async save operation in progress
- `saved` - Successfully saved to FGD
- `loading` - Async load operation in progress  
- `loaded` - Successfully loaded from FGD

**Critical Events:**
```typescript
export type FabricDesignEvent =
  | { type: 'UPDATE_CONFIG'; data: Partial<FabricSpec> }
  | { type: 'COMPUTE_TOPOLOGY' }
  | { type: 'SAVE_TO_FGD' }
  | { type: 'LOAD_FROM_FGD'; fabricId: string }
  | { type: 'RESET' }
```

**Computation Flow Contract:**
1. Guard `isValidConfig` validates even uplinks requirement
2. `computeDerived()` calculates topology metrics
3. `allocateUplinks()` performs port allocation
4. Switch profiles loaded from hardcoded DS2000/DS3000 data
5. All errors accumulated in context.errors array

## 2. Critical Invariants

### 2.1 Mathematical Constraints

**Oversubscription Ratio:**
- MUST be ≤ 4.0 for save operations
- Formula: `(endpointCount * endpointProfile.portsPerEndpoint) / (leavesNeeded * uplinksPerLeaf * uplinkSpeedGbps / endpointSpeedGbps)`

**Even Uplinks Constraint:**
- `uplinksPerLeaf % 2 === 0` (enforced in `isValidConfig` guard)
- Required for symmetric spine distribution

**Port Allocation Rules:**
- `uplinksPerLeaf % spinesNeeded === 0` (divisible distribution)
- Each leaf gets identical port allocations (port reuse across leaves)
- Round-robin distribution across spines

### 2.2 State Rules

**Fabric Status Progression:**
```
draft → computed → saved
```
- Cannot skip states
- `lastModified` timestamp updated on each status change
- Status changes trigger workspace machine events

**Context Validation:**
- `computedTopology.isValid` must be true for save operations
- `allocationResult.issues` array must be empty for successful allocation
- Switch profiles must exist for both leaf and spine models

## 3. Switch Profile Schema

### 3.1 SwitchProfile Interface
```typescript
interface SwitchProfile {
  modelId: string;
  roles: string[];  // ['leaf'] or ['spine']
  ports: {
    endpointAssignable: string[];  // Port range notation: ['E1/1-48']
    fabricAssignable: string[];    // Port range notation: ['E1/49-56']  
  };
  profiles: {
    endpoint: { portProfile: string | null; speedGbps: number };
    uplink: { portProfile: string | null; speedGbps: number };
  };
  meta: { source: string; version: string };
}
```

### 3.2 DS2000 Leaf Profile
```json
{
  "modelId": "celestica-ds2000",
  "roles": ["leaf"],
  "ports": {
    "endpointAssignable": ["E1/1-48"],
    "fabricAssignable": ["E1/49-56"]
  },
  "profiles": {
    "endpoint": { "portProfile": "SFP28-25G", "speedGbps": 25 },
    "uplink": { "portProfile": "QSFP28-100G", "speedGbps": 100 }
  },
  "meta": { "source": "switch_profile.go", "version": "v0.3.0" }
}
```

### 3.3 DS3000 Spine Profile  
```json
{
  "modelId": "celestica-ds3000",
  "roles": ["spine"],
  "ports": {
    "endpointAssignable": [],
    "fabricAssignable": ["E1/1-32"]
  },
  "profiles": {
    "endpoint": { "portProfile": null, "speedGbps": 0 },
    "uplink": { "portProfile": "QSFP28-100G", "speedGbps": 100 }
  },
  "meta": { "source": "switch_profile.go", "version": "v0.3.0" }
}
```

## 4. allocateUplinks() Function Contract

### 4.1 Function Signature
```typescript
function allocateUplinks(
  spec: AllocationSpec,
  leafProfile: SwitchProfile,
  spineProfile: SwitchProfile
): AllocationResult
```

### 4.2 Input Types
```typescript
interface AllocationSpec {
  uplinksPerLeaf: number;     // Must be > 0 and even
  leavesNeeded: number;       // Must be > 0
  spinesNeeded: number;       // Must be > 0, typically 2
  endpointCount: number;      // Must be > 0
}
```

### 4.3 Output Types
```typescript
interface AllocationResult {
  leafMaps: LeafAllocation[];    // One per leaf
  spineUtilization: number[];    // One per spine, shows ports used
  issues: string[];              // Empty on success, errors on failure
}

interface LeafAllocation {
  leafId: number;               // 0-based index
  uplinks: UplinkAssignment[];  // Count = spec.uplinksPerLeaf
}

interface UplinkAssignment {
  port: string;    // From leafProfile.ports.fabricAssignable
  toSpine: number; // 0-based spine index
}
```

### 4.4 Behavioral Contract

**Pre-conditions:**
- `spec.uplinksPerLeaf % spec.spinesNeeded === 0`
- All spec values > 0
- Profiles have non-empty fabricAssignable arrays

**Post-conditions (Success):**
- `result.issues.length === 0`
- `result.leafMaps.length === spec.leavesNeeded` 
- Each leaf gets exactly `spec.uplinksPerLeaf` uplinks
- Uplinks distributed evenly across spines (round-robin)
- Each leaf uses identical port names (port reuse pattern)
- `result.spineUtilization[i] === (spec.leavesNeeded * spec.uplinksPerLeaf) / spec.spinesNeeded`

**Failure Modes:**
- Port capacity exceeded → issues contains capacity error
- Invalid mathematical constraints → issues contains validation error
- Missing profiles → issues contains profile error

### 4.5 Port Allocation Examples

**Example 1: 2 Leaves, 2 Spines, 4 Uplinks per Leaf**
```typescript
// Input
spec = { uplinksPerLeaf: 4, leavesNeeded: 2, spinesNeeded: 2, endpointCount: 96 }

// Output  
result = {
  leafMaps: [
    { leafId: 0, uplinks: [
      { port: "E1/49", toSpine: 0 }, { port: "E1/50", toSpine: 0 },
      { port: "E1/51", toSpine: 1 }, { port: "E1/52", toSpine: 1 }
    ]},
    { leafId: 1, uplinks: [
      { port: "E1/49", toSpine: 0 }, { port: "E1/50", toSpine: 0 },
      { port: "E1/51", toSpine: 1 }, { port: "E1/52", toSpine: 1 }
    ]}
  ],
  spineUtilization: [4, 4],  // Each spine gets 4 connections
  issues: []
}
```

## 5. Storybook Scenarios as Binding Contracts

All 14+ Storybook stories MUST remain functional. These represent binding behavioral contracts:

### 5.1 App-Level Stories (App.stories.tsx)
1. **EmptyWorkspace** - Shows empty state with create prompt
2. **WithFabricsListing** - Lists multiple fabrics with proper status badges  
3. **FabricDesignSelected** - Single fabric designer mode
4. **CreateNewFabricFlow** - Complete creation workflow
5. **NavigationFlow** - Workspace ↔ designer navigation
6. **DriftDetectionWorkflow** - Drift UI integration
7. **ErrorStatesWorkspace** - Validation error handling
8. **LegacyComputedPreview** - v0.1 compatibility for compute
9. **LegacyInvalidUplinks** - v0.1 validation errors  
10. **LegacySaveAfterCompute** - v0.1 save workflow
11. **AllocatorHappyPath** - Port allocation success
12. **AllocatorSpineCapacityExceeded** - Allocation error handling
13. **AllocatorOddUplinks** - Validation error for odd uplinks
14. **AllocatorProfileMissing** - Missing profile error handling

### 5.2 FabricList Stories (FabricList.stories.tsx)
1. **Empty** - No fabrics state
2. **WithFabrics** - Multiple fabric display
3. **Creating** - Create form display
4. **CreateFormInteraction** - Form validation
5. **WithErrors** - Error message display
6. **FabricInteractions** - Select/delete actions
7. **StatusVariations** - All status badge types
8. **WithDriftIndicators** - Drift status display
9. **MultiFabricWorkspace** - Scalability demonstration
10. **FileSystemIntegration** - YAML file operations
11. **StatePreservationScenario** - Navigation state preservation
12. **AdvancedErrorScenarios** - Complex error handling
13. **ConcurrentOperations** - Async operation handling

### 5.3 Drift Stories (FabricDriftStatus.stories.tsx)  
1. **IndicatorNoDrift** - Clean status indicator
2. **IndicatorMinorDrift** - Minor drift indicator
3. **IndicatorMajorDrift** - Major drift indicator
4. **IndicatorChecking** - Loading state
5. **BadgeNoDrift** - Workspace drift badge (0 count)
6. **BadgeMultipleFabrics** - Workspace drift badge (multiple)
7. **SectionNoDrift** - Designer section clean state
8. **SectionMajorDrift** - Designer section with drift
9. **ListView** - Multi-fabric drift overview

### 5.4 FileSystem Integration Stories (FileSystemIntegration.stories.tsx)
1. **YAMLSaveLoadWorkflow** - Complete YAML persistence
2. **MultipleFileGeneration** - Multiple fabric file isolation
3. **FileBasedDriftDetection** - File vs memory comparison
4. **FileSystemErrorHandling** - YAML error scenarios
5. **FileStructureValidation** - YAML content validation  
6. **CrossSessionPersistence** - Save/reload functionality
7. **BulkFileOperations** - Multiple fabric operations

### 5.5 v0.4 Multi-Class Stories (MultiClass.stories.tsx)
1. **MultiClassConfiguration** - Different leaf classes configuration
2. **LAGConstraintValidation** - ES-LAG and MC-LAG constraint testing
3. **GuardPanelInteraction** - Guard system UI interactions  
4. **CrossClassAllocation** - Port allocation across multiple classes
5. **LAGGroupVisualization** - LAG group display and management
6. **FKSDriftDetection** - Mock Kubernetes drift scenarios
7. **AutofixGuardScenarios** - Automatic guard resolution
8. **MultiClassToLegacyMigration** - Backward compatibility testing
9. **ComplexTopologyDesign** - Advanced multi-class scenarios
10. **GuardSeverityHandling** - Error, warning, info guard types

### 5.6 Guard System Stories (GuardSystem.stories.tsx)
1. **ConfigurationGuards** - Even uplinks, divisible uplinks validation
2. **AllocationGuards** - Spine capacity, port distribution validation
3. **LAGGuards** - LAG constraint compliance testing
4. **FKSGuards** - Kubernetes drift detection scenarios
5. **GuardAutofix** - Automatic resolution functionality
6. **GuardGrouping** - Categorization by type and severity
7. **GuardDismissal** - User dismissal workflows
8. **GuardPersistence** - Guard state preservation

**Contract Requirements:**
- All stories must pass their `play()` assertions
- No breaking changes to story names or core behaviors
- UI element selectors must remain stable
- Async operations must complete within story timeouts
- v0.4 stories must demonstrate backward compatibility

## 6. Feature Flag Contracts

### 6.1 FEATURE_GIT Behavior

**When Enabled (`FEATURE_GIT=true`):**
- `gitService.isEnabled()` returns `true`
- Git operations attempt real isomorphic-git functionality
- YAML files persisted to git repository
- Git status integration in workspace UI
- Commit message generation for save operations
- Graceful fallback on Git operation failures

**When Disabled (`FEATURE_GIT=false`, default):**  
- `gitService.isEnabled()` returns `false`
- All git operations return no-op success (`true`/empty results)
- No isomorphic-git dependencies loaded
- UI git status elements hidden/disabled
- YAML files saved to file system only

**Detection Priority:**
1. Environment variable: `process.env.FEATURE_GIT`
2. URL parameter: `?FEATURE_GIT=true`  
3. localStorage: `localStorage.getItem('FEATURE_GIT')`
4. Default: `false`

### 6.2 Feature Flag API Contract
```typescript
interface FeatureFlags {
  git: boolean;
}

// Immutable after initialization
export const featureFlags: FeatureFlags

// Runtime checks
export const isGitEnabled = (): boolean => featureFlags.git

// Development overrides (localStorage only)  
export function overrideFeatureFlag(key: keyof FeatureFlags, value: boolean): void

// Status inspection
export function getFeatureFlagStatus(): Record<string, boolean>
```

## 7. Quality Gates and Release Criteria

### 7.1 Testing Requirements
- All unit tests pass: `npm test`
- All E2E tests pass: `npx playwright test`
- All Storybook stories pass: `npm run test-storybook`
- TypeScript compilation: `npm run typecheck`
- Linting passes: `npm run lint`

### 7.2 Coverage Requirements
- Unit test coverage ≥ 80% for core functions:
  - `allocateUplinks()` and port utilities
  - State machine transitions and guards
  - Schema validation functions
  - Drift detection algorithms

### 7.3 Performance Benchmarks
- Fabric computation < 100ms for typical scenarios (48 endpoints, 2 uplinks)
- Workspace listing < 50ms for up to 10 fabrics
- YAML save/load operations < 200ms per fabric
- Drift detection < 500ms for medium fabric complexity

### 7.4 Browser Compatibility
- Chrome ≥ 90
- Firefox ≥ 88  
- Safari ≥ 14
- Edge ≥ 90

### 7.5 Bundle Size Limits
- Main bundle < 500KB compressed
- Storybook bundle < 2MB compressed
- No unused dependencies in production build

## 8. Error Handling Contracts

### 8.1 Validation Errors
```typescript
// Schema validation (Zod-based)
interface ValidationError {
  path: string[];        // JSON path to invalid field
  message: string;       // Human-readable error
  code: string;         // Error code for programmatic handling
}

// FSM validation errors
interface FSMError {
  type: 'validation' | 'constraint' | 'system';
  message: string;
  context?: Record<string, any>;
}
```

### 8.2 Error Response Format
**Successful Operations:**
```typescript
{ success: true, data: T, errors: [] }
```

**Failed Operations:**  
```typescript
{ success: false, data: null, errors: string[] }
```

### 8.3 Error Propagation Rules
1. **Validation errors** → Machine transitions to 'invalid' state
2. **Computation errors** → Accumulated in context.errors array  
3. **I/O errors** → Graceful fallbacks with console warnings
4. **System errors** → User-friendly messages, technical details in console

### 8.4 Required Error Messages
- `"Fabric name cannot be empty"`
- `"Fabric name must be unique"`  
- `"Uplinks per leaf must be even for proper distribution"`
- `"Uplinks per leaf (N) must be divisible by number of spines (M)"`
- `"Spine capacity exceeded: need N ports, spine has M fabricAssignable"`
- `"Leaf profile not found: MODEL_ID"`
- `"Port allocation failed: ERROR_MESSAGE"`

## 9. API Surface Contracts

### 9.1 Core Functions
```typescript
// Must remain stable
export function computeDerived(config: FabricSpec): DerivedTopology
export function allocateUplinks(spec: AllocationSpec, leaf: SwitchProfile, spine: SwitchProfile): AllocationResult  
export function saveFGD(diagram: WiringDiagram, options: SaveOptions): Promise<SaveResult>
export function loadFGD(options: LoadOptions): Promise<LoadResult>

// State machines
export const workspaceMachine: StateMachine
export const fabricDesignMachine: StateMachine

// v0.4 Multi-class functions
export function computeMultiClassDerived(config: FabricSpec): DerivedTopology
export function allocateMultiClassUplinks(spec: MultiClassAllocationSpec, profiles: SwitchProfile[], spine: SwitchProfile): MultiClassAllocationResult
export function validateLeafClasses(leafClasses: LeafClass[]): FabricGuard[]
export function generateLAGConstraints(leafClass: LeafClass, spineCount: number): LAGConstraint[]

// Guard system
export function evaluateGuards(config: FabricSpec, topology?: DerivedTopology): FabricGuard[]
export function autofixGuard(guardId: string, context: any): boolean
export function filterGuardsBySeverity(guards: FabricGuard[], severity: GuardSeverity): FabricGuard[]

// FKS drift detection
export function detectFKSDrift(fabricSpec: FabricSpec): Promise<FKSDriftResult>
export function getMockKubernetesState(): Promise<MockKubernetesState>
export function analyzeDrift(fabric: FabricSpec, k8sState: MockKubernetesState): FabricGuard[]
```

### 9.2 Type Exports
```typescript
// Public API types - breaking changes require major version
export type {
  FabricSpec, DerivedTopology, WiringDiagram,
  AllocationSpec, AllocationResult, SwitchProfile,
  WorkspaceEvent, FabricDesignEvent,
  DriftStatus, GitStatus, FeatureFlags,
  
  // v0.4 Multi-class types
  LeafClass, LeafClassSummary, LAGConstraint,
  MultiClassAllocationSpec, MultiClassAllocationResult,
  ClassAllocationMap, LAGGroupAllocation,
  
  // Guard system types
  FabricGuard, GuardType, GuardSeverity,
  
  // FKS drift types
  FKSDriftService, FKSDriftResult, MockKubernetesState,
  MockK8sNode, MockK8sNetwork, MockK8sConfigMap
}
```

### 9.3 Schema Exports
```typescript
// Validation schemas
export { 
  FabricSpecSchema, ValidatedFabricSpecSchema,
  EndpointProfileSchema, SwitchModelSchema,
  
  // v0.4 Multi-class schemas
  LeafClassSchema, MultiClassFabricSpecSchema,
  LAGConstraintSchema, FabricGuardSchema,
  
  // FKS schemas
  MockKubernetesStateSchema, FKSDriftResultSchema
}
```

## 10. Migration and Backwards Compatibility

### 10.1 v0.1 Legacy Support
- All v0.1 Storybook scenarios must continue to work
- Existing compute → save workflow preserved
- Switch model IDs ('DS2000', 'DS3000') unchanged
- Port allocation algorithm maintains same mathematical behavior

### 10.2 v0.2 Multi-Fabric Compatibility  
- Workspace state machine maintains fabric list
- Navigation between workspace and designer preserved
- Fabric metadata (id, name, status, timestamps) schema stable

### 10.3 v0.3 Feature Flag Compatibility
- Feature flag system (FEATURE_GIT) continues to work
- Drift detection APIs maintained
- YAML persistence format stable

### 10.4 v0.4 Multi-Class Migration
- **Automatic Legacy Conversion**: v0.1-v0.3 configs automatically converted to single-class format
- **Dual Mode Support**: Both legacy and multi-class modes supported simultaneously  
- **Schema Versioning**: YAML files include schema version for proper migration
- **API Overloading**: Functions detect input type and route appropriately

#### v0.4 Migration Examples
```typescript
// Legacy config (v0.1-v0.3) automatically becomes:
const legacyConfig = {
  leafModelId: 'DS2000',
  endpointCount: 48,
  uplinksPerLeaf: 4,
  isMultiClass: false
};

// Converts internally to:
const convertedConfig = {
  leafClasses: [{
    classId: 'default',
    leafModelId: 'DS2000', 
    leafCount: 2,           // Computed from math
    endpointCount: 48,
    uplinksPerLeaf: 4,
    lagEnabled: false
  }],
  isMultiClass: true        // Internal flag, transparent to user
};
```

### 10.5 Breaking Change Policy
- Major version required for state machine changes
- Major version required for core algorithm changes  
- Minor version allowed for new optional features (like v0.4 multi-class)
- Patch version for bug fixes maintaining contracts
- **v0.4 Exception**: Multi-class features added as minor version due to full backward compatibility

---

## Contract Verification

This document represents the complete behavioral specification for HNC v0.1 through v0.4. All implementation changes must:

1. ✅ Pass all existing tests (legacy and new)
2. ✅ Maintain Storybook story functionality 
3. ✅ Preserve API surface compatibility
4. ✅ Respect mathematical and validation constraints
5. ✅ Handle feature flags appropriately
6. ✅ Follow error handling patterns
7. 🆕 Support multi-class leaf configurations
8. 🆕 Validate LAG constraints properly
9. 🆕 Implement guard system comprehensively
10. 🆕 Integrate FKS drift detection

### v0.4 Verification Checklist
- [ ] Multi-class topology computation accuracy
- [ ] LAG constraint validation (ES-LAG, MC-LAG)
- [ ] Guard system coverage for all constraint types
- [ ] FKS drift detection with mock Kubernetes scenarios
- [ ] Backward compatibility with v0.1-v0.3 configurations
- [ ] Enhanced UI components (GuardPanel, allocation tables)
- [ ] Cross-class port allocation correctness
- [ ] Performance benchmarks within specified limits

### Breaking Change Review
Any deviation from these contracts must be explicitly documented and requires architecture review. v0.4 adds significant functionality while maintaining full backward compatibility through:
- Automatic legacy config conversion
- Dual-mode API support (overloaded functions)
- Schema versioning in persisted data
- Transparent feature detection

**Last Updated:** August 31, 2024  
**Version:** HNC v0.4.0  
**Status:** 🚀 Multi-Class Specification Complete