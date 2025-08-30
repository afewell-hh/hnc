# HNC v0.1 Schema Architecture

## Overview

This directory contains the complete type system and validation schemas for the HNC (Hybrid Network Configurator) v0.1. The design focuses on type safety, validation, and clean separation of concerns.

## Core Components

### 1. FabricSpec Schema (`fabric-spec.schema.ts`)
- **Purpose**: Core input validation for fabric configurations
- **Key Features**:
  - Zod-based runtime validation
  - Cross-field validation rules
  - Support for partial updates
  - Extensible metadata system
- **Constraints**:
  - Single fabric focus with multi-fabric data model readiness
  - DS2000 leaf / DS3000 spine constraint
  - 1-4 uplinks per leaf validation
  - Maximum 10 endpoint profiles

### 2. DerivedTopology Types (`derived-topology.types.ts`)
- **Purpose**: Computed topology metrics and capacity calculations
- **Key Features**:
  - Read-only computed properties
  - Comprehensive capacity breakdown
  - Utilization and redundancy metrics
  - Validation flags and warnings
- **Calculations**:
  - `leavesNeeded`: Based on endpoint count and uplink configuration
  - `spinesNeeded`: Based on total uplinks required
  - `totalCapacity`: Aggregate fabric bandwidth
  - `oversubscriptionRatio`: Network oversubscription calculation

### 3. WiringDiagram Types (`wiring-diagram.types.ts`)
- **Purpose**: Physical infrastructure representation
- **Key Features**:
  - Complete rack and power layout
  - Cable management and routing
  - Installation bill of materials
  - Validation and constraint checking
- **Components**:
  - Physical layout (racks, switches, endpoints)
  - Power distribution and cooling
  - Cable management and bundles
  - Installation metadata

### 4. Topology Calculator (`topology-calculator.ts`)
- **Purpose**: Core computation algorithms
- **Key Features**:
  - Pure functions for calculations
  - Comprehensive validation
  - Performance tracking
  - Error handling and reporting
- **Functions**:
  - `computeTopology()`: Main computation entry point
  - `validateTopology()`: Constraint validation
  - Individual calculation functions for each metric

## Type System Design Principles

### 1. Immutability
All computed types use `readonly` modifiers to prevent accidental mutations and ensure data integrity.

### 2. Type Safety
- Strict TypeScript configuration
- Zod runtime validation
- Discriminated unions for type narrowing
- Comprehensive error types

### 3. Extensibility
- Metadata fields for future extensions
- Version tracking for schema evolution
- Plugin-ready validation system
- Multi-fabric preparation

### 4. Performance
- Lazy computation where possible
- Caching support in computation metadata
- Minimal object creation
- Efficient validation algorithms

## Validation Strategy

### Input Validation (Zod)
```typescript
// Runtime validation with detailed error messages
const result = validateFabricSpecSafe(input);
if (!result.success) {
  // Handle validation errors
  console.log(result.error.issues);
}
```

### Computed Validation
```typescript
// Post-computation constraint checking
const topology = computeTopology(fabricSpec);
if (!topology.derivedTopology.validation.isValid) {
  // Handle topology constraint violations
  console.log(topology.derivedTopology.validation.errors);
}
```

## Usage Examples

### Basic Fabric Configuration
```typescript
import { validateFabricSpec } from './fabric-spec.schema';

const fabric = validateFabricSpec({
  name: 'prod-fabric-01',
  spineModelId: 'DS3000',
  leafModelId: 'DS2000',
  uplinksPerLeaf: 2,
  endpointProfiles: [{
    name: 'web-servers',
    type: 'server',
    count: 48,
    bandwidth: 1000,
    redundancy: false
  }]
});
```

### Topology Computation
```typescript
import { computeTopology } from '../utils/topology-calculator';

const result = computeTopology(fabric);
console.log(`Requires ${result.derivedTopology.leavesNeeded} leaf switches`);
console.log(`Oversubscription ratio: ${result.derivedTopology.oversubscriptionRatio}:1`);
```

## File Organization

```
src/
├── schemas/
│   └── fabric-spec.schema.ts     # Input validation (140 LOC)
├── types/
│   ├── derived-topology.types.ts # Computed metrics (145 LOC)
│   ├── wiring-diagram.types.ts   # Physical layout (148 LOC)
│   └── index.ts                  # Central exports (120 LOC)
└── utils/
    └── topology-calculator.ts    # Computation logic (135 LOC)
```

## Design Constraints Met

- ✅ All files under 150 LOC
- ✅ Single fabric runtime with multi-fabric data model
- ✅ Type-safe with runtime validation
- ✅ Clean separation of concerns
- ✅ Extensible for future requirements
- ✅ Comprehensive error handling
- ✅ Performance-conscious design

## Integration Points

### State Machine Integration
The schema system is designed to work seamlessly with XState for state management:
- Input validation on transitions
- Computed properties as state context
- Validation errors as state events

### UI Integration
Type-safe props and validation for React components:
- Form validation with Zod
- Computed display values
- Error boundary integration

### Testing Integration
Comprehensive type support for test scenarios:
- Mock data generation
- Validation testing
- Computation verification