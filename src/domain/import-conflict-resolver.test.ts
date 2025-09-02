/**
 * Unit tests for Import Conflict Resolver - WP-IMP2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImportConflictResolver } from './import-conflict-resolver';
import type { FabricSpec, DerivedTopology } from '../app.types';

describe('ImportConflictResolver', () => {
  let resolver: ImportConflictResolver;
  
  beforeEach(() => {
    resolver = new ImportConflictResolver();
  });

  describe('Value Conflicts Detection', () => {
    it('should detect spine model conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        name: 'Test Fabric',
        spineModelId: 'DS4000', // Different spine model
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      expect(result.conflicts.length).toBeGreaterThan(0);
      const spineModelConflict = result.conflicts.find(c => c.id === 'import-spine-model-conflict');
      expect(spineModelConflict).toBeDefined();
      expect(spineModelConflict?.id).toBe('import-spine-model-conflict');
      expect(spineModelConflict?.importMetadata.conflictType).toBe('model');
      expect(spineModelConflict?.importMetadata.importedValue).toBe('DS3000');
      expect(spineModelConflict?.importMetadata.computedValue).toBe('DS4000');
    });

    it('should detect leaf model conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS1000', // Different leaf model
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      expect(result.conflicts.length).toBeGreaterThan(0);
      const leafModelConflict = result.conflicts.find(c => c.id === 'import-leaf-model-conflict');
      expect(leafModelConflict).toBeDefined();
      expect(leafModelConflict?.importMetadata.conflictType).toBe('model');
    });

    it('should detect uplinks per leaf conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2 // Different uplinks count
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].id).toBe('import-value-conflict-uplinksPerLeaf');
      expect(result.conflicts[0].importMetadata.conflictType).toBe('value');
      expect(result.conflicts[0].importMetadata.importedValue).toBe(4);
      expect(result.conflicts[0].importMetadata.computedValue).toBe(2);
    });
  });

  describe('Capacity Conflicts Detection', () => {
    it('should detect capacity exceeded conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 2,
        endpointCount: 2000, // Very high endpoint count
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        endpointCount: 48 // Normal count
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      const capacityConflict = result.conflicts.find(c => c.id === 'import-capacity-exceeded');
      expect(capacityConflict).toBeDefined();
      expect(capacityConflict?.type).toBe('error');
      expect(capacityConflict?.severity).toBe('high');
    });
  });

  describe('Constraint Violations Detection', () => {
    it('should detect odd uplinks constraint violation', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 3, // Odd number - violates constraint
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      const constraintConflict = result.conflicts.find(c => c.id === 'import-odd-uplinks-constraint');
      expect(constraintConflict).toBeDefined();
      expect(constraintConflict?.type).toBe('error');
      expect(constraintConflict?.importMetadata.conflictType).toBe('constraint');
      expect(constraintConflict?.importMetadata.importedValue).toBe(3);
      expect(constraintConflict?.importMetadata.computedValue).toBe(4); // Suggested even number
    });
  });

  describe('Topology Conflicts Detection', () => {
    it('should detect oversubscription conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 1, // Very low uplinks
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 8.0, // High oversubscription
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      const topologyConflict = result.conflicts.find(c => c.id === 'import-oversubscription-conflict');
      expect(topologyConflict).toBeDefined();
      expect(topologyConflict?.type).toBe('warning');
      expect(topologyConflict?.importMetadata.conflictType).toBe('topology');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts with accept action', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const detectionResult = resolver.detectConflicts(importedSpec, topology, currentSpec);
      const conflict = detectionResult.conflicts.find(c => c.field === 'uplinksPerLeaf')!;
      
      const resolution = resolver.resolveConflict(conflict, 'accept');

      expect(resolution.updatedSpec.uplinksPerLeaf).toBe(4); // Imported value
      expect(resolution.resolvedConflict.overridden).toBe(true);
      expect(resolution.recomputeRequired).toBe(true);
      expect(resolution.affectedFields).toContain('spinesNeeded');
    });

    it('should resolve conflicts with reject action', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const detectionResult = resolver.detectConflicts(importedSpec, topology, currentSpec);
      const conflict = detectionResult.conflicts.find(c => c.field === 'uplinksPerLeaf')!;
      
      const resolution = resolver.resolveConflict(conflict, 'reject');

      expect(resolution.updatedSpec.uplinksPerLeaf).toBe(2); // Current value
      expect(resolution.resolvedConflict.overridden).toBe(true);
      expect(resolution.recomputeRequired).toBe(false);
    });

    it('should resolve conflicts with modify action', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const detectionResult = resolver.detectConflicts(importedSpec, topology, currentSpec);
      const conflict = detectionResult.conflicts.find(c => c.field === 'uplinksPerLeaf')!;
      
      const resolution = resolver.resolveConflict(conflict, 'modify', 6);

      expect(resolution.updatedSpec.uplinksPerLeaf).toBe(6); // Custom value
      expect(resolution.resolvedConflict.overridden).toBe(true);
      expect(resolution.recomputeRequired).toBe(true);
    });

    it('should throw error for invalid resolution action', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const detectionResult = resolver.detectConflicts(importedSpec, topology, {});
      
      // Create a mock conflict with no resolution actions for the specified type
      const mockConflict = {
        ...detectionResult.conflicts[0],
        resolutionActions: []
      };

      expect(() => {
        resolver.resolveConflict(mockConflict as any, 'accept');
      }).toThrow("Resolution action 'accept' not available");
    });

    it('should throw error for modify action without value', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 4,
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        uplinksPerLeaf: 2
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const detectionResult = resolver.detectConflicts(importedSpec, topology, currentSpec);
      const conflict = detectionResult.conflicts.find(c => c.field === 'uplinksPerLeaf')!;

      expect(() => {
        resolver.resolveConflict(conflict, 'modify'); // No modify value provided
      }).toThrow('Modify action requires a new value');
    });
  });

  describe('Summary Generation', () => {
    it('should generate correct conflict summary', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        uplinksPerLeaf: 3, // Odd - causes constraint conflict (high severity)
        endpointCount: 48,
        endpointProfile: { name: 'Server', portsPerEndpoint: 2 }
      };

      const currentSpec: Partial<FabricSpec> = {
        spineModelId: 'DS4000', // Causes model conflict (medium severity)
        uplinksPerLeaf: 2 // Causes value conflict (medium severity)
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      expect(result.summary.totalConflicts).toBeGreaterThanOrEqual(3); // At least constraint + model + value
      expect(result.summary.criticalConflicts).toBeGreaterThanOrEqual(1); // At least constraint is high severity
      expect(result.summary.resolvableConflicts).toBeGreaterThanOrEqual(3); // At least 3 should be resolvable
      expect(result.summary.affectedFields).toContain('uplinksPerLeaf');
      expect(result.summary.affectedFields).toContain('spineModelId');
    });
  });

  describe('Multi-class Fabric Support', () => {
    it('should detect leaf class count conflicts', () => {
      const importedSpec: FabricSpec = {
        name: 'Test Fabric',
        spineModelId: 'DS3000',
        leafModelId: 'DS2000',
        leafClasses: [
          {
            id: 'class1',
            name: 'Class 1',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'Server', portsPerEndpoint: 2, count: 24 }]
          },
          {
            id: 'class2',
            name: 'Class 2',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'Server', portsPerEndpoint: 2, count: 24 }]
          }
        ]
      };

      const currentSpec: Partial<FabricSpec> = {
        leafClasses: [
          {
            id: 'class1',
            name: 'Class 1',
            role: 'standard',
            uplinksPerLeaf: 2,
            endpointProfiles: [{ name: 'Server', portsPerEndpoint: 2, count: 24 }]
          }
        ]
      };

      const topology: DerivedTopology = {
        leavesNeeded: 24,
        spinesNeeded: 2,
        totalPorts: 1200,
        usedPorts: 800,
        oversubscriptionRatio: 2.0,
        isValid: true,
        validationErrors: [],
        guards: []
      };

      const result = resolver.detectConflicts(importedSpec, topology, currentSpec);

      const leafClassConflict = result.conflicts.find(c => c.id === 'import-leaf-class-count-conflict');
      expect(leafClassConflict).toBeDefined();
      expect(leafClassConflict?.importMetadata.importedValue).toBe(2);
      expect(leafClassConflict?.importMetadata.computedValue).toBe(1);
    });
  });
});