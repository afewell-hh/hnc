/**
 * Import Conflict Resolver - WP-IMP2
 * 
 * Detects conflicts between imported FabricSpec and computed values,
 * surfaces them as Issues, and provides resolution actions.
 */

import type { FabricSpec, DerivedTopology, Issue, FieldProvenance } from '../app.types';
import type { RuleCode } from './rules';

// Extended rule codes for import-specific scenarios
export type ImportRuleCode = RuleCode 
  | 'IMPORT_VALUE_CONFLICT'
  | 'IMPORT_CAPACITY_MISMATCH'
  | 'IMPORT_CONSTRAINT_VIOLATION'
  | 'IMPORT_TOPOLOGY_INCONSISTENCY'
  | 'IMPORT_MODEL_INCOMPATIBLE';

// Import conflict extends Issue with additional metadata
export interface ImportConflict extends Issue {
  category: 'import-conflict';
  importMetadata: {
    importedValue: any;
    computedValue: any;
    fieldPath: string;
    conflictType: 'value' | 'capacity' | 'constraint' | 'topology' | 'model';
    provenance: {
      imported: FieldProvenance;
      computed: FieldProvenance;
    };
    confidence: 'high' | 'medium' | 'low'; // Confidence in the conflict detection
  };
  resolutionActions: ConflictResolutionAction[];
}

// Resolution action types
export interface ConflictResolutionAction {
  type: 'accept' | 'reject' | 'modify';
  label: string;
  description: string;
  newValue?: any;
  newProvenance: FieldProvenance;
  affectedFields: string[]; // Other fields that will be recomputed
}

// Conflict detection result
export interface ConflictDetectionResult {
  conflicts: ImportConflict[];
  summary: {
    totalConflicts: number;
    criticalConflicts: number;
    resolvableConflicts: number;
    affectedFields: string[];
  };
}

// Resolution result
export interface ConflictResolutionResult {
  resolvedConflict: ImportConflict;
  updatedSpec: Partial<FabricSpec>;
  recomputeRequired: boolean;
  affectedFields: string[];
}

/**
 * Main conflict resolver class
 */
export class ImportConflictResolver {
  /**
   * Detect conflicts between imported and computed FabricSpec values
   */
  detectConflicts(
    importedSpec: FabricSpec,
    computedTopology: DerivedTopology,
    currentSpec: Partial<FabricSpec>
  ): ConflictDetectionResult {
    const conflicts: ImportConflict[] = [];

    // Check for value conflicts in core fields
    conflicts.push(...this.detectValueConflicts(importedSpec, currentSpec));
    
    // Check for capacity mismatches
    conflicts.push(...this.detectCapacityConflicts(importedSpec, computedTopology));
    
    // Check for topology inconsistencies
    conflicts.push(...this.detectTopologyConflicts(importedSpec, computedTopology));
    
    // Check for model compatibility issues
    conflicts.push(...this.detectModelConflicts(importedSpec, currentSpec));
    
    // Check constraint violations
    conflicts.push(...this.detectConstraintConflicts(importedSpec, computedTopology));

    const summary = {
      totalConflicts: conflicts.length,
      criticalConflicts: conflicts.filter(c => c.severity === 'high').length,
      resolvableConflicts: conflicts.filter(c => c.overridable).length,
      affectedFields: Array.from(new Set(conflicts.map(c => c.importMetadata.fieldPath))),
    };

    return { conflicts, summary };
  }

  /**
   * Resolve a specific conflict by applying the chosen resolution action
   */
  resolveConflict(
    conflict: ImportConflict,
    actionType: 'accept' | 'reject' | 'modify',
    modifyValue?: any
  ): ConflictResolutionResult {
    const action = conflict.resolutionActions.find(a => a.type === actionType);
    if (!action) {
      throw new Error(`Resolution action '${actionType}' not available for conflict ${conflict.id}`);
    }

    const fieldPath = conflict.importMetadata.fieldPath;
    const updatedSpec: Partial<FabricSpec> = {};

    // Apply the resolution
    switch (actionType) {
      case 'accept':
        // Keep imported value, set provenance to import
        this.setNestedValue(updatedSpec, fieldPath, conflict.importMetadata.importedValue);
        break;
        
      case 'reject':
        // Keep computed/current value, set provenance to user
        this.setNestedValue(updatedSpec, fieldPath, conflict.importMetadata.computedValue);
        break;
        
      case 'modify':
        // Use provided value, set provenance to user
        if (modifyValue === undefined) {
          throw new Error('Modify action requires a new value');
        }
        this.setNestedValue(updatedSpec, fieldPath, modifyValue);
        break;
    }

    // Mark the conflict as resolved
    const resolvedConflict: ImportConflict = {
      ...conflict,
      overridden: true,
      message: `${conflict.message} [RESOLVED: ${actionType.toUpperCase()}]`,
    };

    return {
      resolvedConflict,
      updatedSpec,
      recomputeRequired: action.affectedFields.length > 0,
      affectedFields: action.affectedFields,
    };
  }

  /**
   * Detect direct value conflicts between imported and current spec
   */
  private detectValueConflicts(
    importedSpec: FabricSpec,
    currentSpec: Partial<FabricSpec>
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];
    
    // Compare key fields
    const fieldsToCheck = [
      'name',
      'spineModelId', 
      'leafModelId',
      'uplinksPerLeaf',
      'endpointCount'
    ];

    fieldsToCheck.forEach(field => {
      const importedValue = (importedSpec as any)[field];
      const currentValue = (currentSpec as any)[field];

      if (importedValue !== undefined && currentValue !== undefined && importedValue !== currentValue) {
        conflicts.push(this.createValueConflict(field, importedValue, currentValue));
      }
    });

    // Check endpoint profile conflicts
    if (importedSpec.endpointProfile && currentSpec.endpointProfile) {
      const imported = importedSpec.endpointProfile;
      const current = currentSpec.endpointProfile;
      
      if (imported.portsPerEndpoint !== current.portsPerEndpoint) {
        conflicts.push(this.createValueConflict(
          'endpointProfile.portsPerEndpoint',
          imported.portsPerEndpoint,
          current.portsPerEndpoint
        ));
      }
    }

    // Check leaf class conflicts (if present)
    if (importedSpec.leafClasses && currentSpec.leafClasses) {
      conflicts.push(...this.detectLeafClassConflicts(importedSpec.leafClasses, currentSpec.leafClasses));
    }

    return conflicts;
  }

  /**
   * Detect capacity-related conflicts
   */
  private detectCapacityConflicts(
    importedSpec: FabricSpec,
    computedTopology: DerivedTopology
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Check if imported spec would exceed computed capacity
    const importedEndpointCount = this.getTotalEndpointCount(importedSpec);
    const computedCapacity = computedTopology.totalPorts - (computedTopology.leavesNeeded * 4); // Assume 4 uplinks per leaf

    if (importedEndpointCount > computedCapacity) {
      conflicts.push({
        id: 'import-capacity-exceeded',
        type: 'error',
        severity: 'high',
        title: 'Import Exceeds Computed Capacity',
        message: `Imported specification requires ${importedEndpointCount} endpoints but computed topology only supports ${computedCapacity}`,
        category: 'import-conflict',
        field: 'endpointCount',
        overridable: true,
        overridden: false,
        importMetadata: {
          importedValue: importedEndpointCount,
          computedValue: computedCapacity,
          fieldPath: 'endpointCount',
          conflictType: 'capacity',
          provenance: {
            imported: 'import',
            computed: 'auto'
          },
          confidence: 'high'
        },
        resolutionActions: [
          {
            type: 'accept',
            label: 'Accept Import (Scale Up)',
            description: 'Accept imported endpoint count and scale topology accordingly',
            newProvenance: 'import',
            affectedFields: ['leavesNeeded', 'spinesNeeded', 'totalPorts']
          },
          {
            type: 'reject',
            label: 'Keep Computed',
            description: 'Keep current computed capacity limits',
            newProvenance: 'user',
            affectedFields: []
          },
          {
            type: 'modify',
            label: 'Custom Value',
            description: 'Set a custom endpoint count',
            newProvenance: 'user',
            affectedFields: ['leavesNeeded', 'spinesNeeded', 'totalPorts']
          }
        ]
      });
    }

    return conflicts;
  }

  /**
   * Detect topology inconsistencies
   */
  private detectTopologyConflicts(
    importedSpec: FabricSpec,
    computedTopology: DerivedTopology
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Check oversubscription ratio conflicts
    if (computedTopology.oversubscriptionRatio > 4.0) {
      const importedUplinks = importedSpec.uplinksPerLeaf || 2;
      const computedUplinks = Math.ceil(computedTopology.oversubscriptionRatio);

      if (importedUplinks < computedUplinks) {
        conflicts.push({
          id: 'import-oversubscription-conflict',
          type: 'warning',
          severity: 'medium',
          title: 'Import May Cause High Oversubscription',
          message: `Imported uplinks (${importedUplinks}) may result in oversubscription ratio of ${computedTopology.oversubscriptionRatio.toFixed(2)}:1`,
          category: 'import-conflict',
          field: 'uplinksPerLeaf',
          overridable: true,
          overridden: false,
          importMetadata: {
            importedValue: importedUplinks,
            computedValue: computedUplinks,
            fieldPath: 'uplinksPerLeaf',
            conflictType: 'topology',
            provenance: {
              imported: 'import',
              computed: 'auto'
            },
            confidence: 'medium'
          },
          resolutionActions: [
            {
              type: 'accept',
              label: 'Accept Import',
              description: 'Use imported uplinks (may cause high oversubscription)',
              newProvenance: 'import',
              affectedFields: ['oversubscriptionRatio']
            },
            {
              type: 'reject',
              label: 'Use Computed',
              description: 'Use computed optimal uplinks count',
              newProvenance: 'auto',
              affectedFields: []
            }
          ]
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect model compatibility conflicts
   */
  private detectModelConflicts(
    importedSpec: FabricSpec,
    currentSpec: Partial<FabricSpec>
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Check spine model compatibility
    if (importedSpec.spineModelId !== currentSpec.spineModelId) {
      conflicts.push({
        id: 'import-spine-model-conflict',
        type: 'warning',
        severity: 'medium',
        title: 'Spine Model Mismatch',
        message: `Imported spine model '${importedSpec.spineModelId}' differs from current '${currentSpec.spineModelId}'`,
        category: 'import-conflict',
        field: 'spineModelId',
        overridable: true,
        overridden: false,
        importMetadata: {
          importedValue: importedSpec.spineModelId,
          computedValue: currentSpec.spineModelId,
          fieldPath: 'spineModelId',
          conflictType: 'model',
          provenance: {
            imported: 'import',
            computed: 'user'
          },
          confidence: 'high'
        },
        resolutionActions: [
          {
            type: 'accept',
            label: 'Use Imported Model',
            description: 'Switch to imported spine model',
            newProvenance: 'import',
            affectedFields: ['spinesNeeded', 'totalPorts']
          },
          {
            type: 'reject',
            label: 'Keep Current Model',
            description: 'Keep currently configured spine model',
            newProvenance: 'user',
            affectedFields: []
          }
        ]
      });
    }

    // Check leaf model compatibility
    if (importedSpec.leafModelId !== currentSpec.leafModelId) {
      conflicts.push({
        id: 'import-leaf-model-conflict',
        type: 'warning',
        severity: 'medium',
        title: 'Leaf Model Mismatch',
        message: `Imported leaf model '${importedSpec.leafModelId}' differs from current '${currentSpec.leafModelId}'`,
        category: 'import-conflict',
        field: 'leafModelId',
        overridable: true,
        overridden: false,
        importMetadata: {
          importedValue: importedSpec.leafModelId,
          computedValue: currentSpec.leafModelId,
          fieldPath: 'leafModelId',
          conflictType: 'model',
          provenance: {
            imported: 'import',
            computed: 'user'
          },
          confidence: 'high'
        },
        resolutionActions: [
          {
            type: 'accept',
            label: 'Use Imported Model',
            description: 'Switch to imported leaf model',
            newProvenance: 'import',
            affectedFields: ['leavesNeeded', 'totalPorts']
          },
          {
            type: 'reject',
            label: 'Keep Current Model',
            description: 'Keep currently configured leaf model',
            newProvenance: 'user',
            affectedFields: []
          }
        ]
      });
    }

    return conflicts;
  }

  /**
   * Detect constraint violations from import
   */
  private detectConstraintConflicts(
    importedSpec: FabricSpec,
    computedTopology: DerivedTopology
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Check for odd uplinks constraint violation
    if (importedSpec.uplinksPerLeaf && importedSpec.uplinksPerLeaf % 2 !== 0) {
      conflicts.push({
        id: 'import-odd-uplinks-constraint',
        type: 'error',
        severity: 'high',
        title: 'Import Violates Uplinks Constraint',
        message: `Imported uplinks per leaf (${importedSpec.uplinksPerLeaf}) is odd, violating even distribution requirement`,
        category: 'import-conflict',
        field: 'uplinksPerLeaf',
        overridable: true,
        overridden: false,
        importMetadata: {
          importedValue: importedSpec.uplinksPerLeaf,
          computedValue: importedSpec.uplinksPerLeaf + 1, // Suggest next even number
          fieldPath: 'uplinksPerLeaf',
          conflictType: 'constraint',
          provenance: {
            imported: 'import',
            computed: 'auto'
          },
          confidence: 'high'
        },
        resolutionActions: [
          {
            type: 'accept',
            label: 'Accept Import (Override Constraint)',
            description: 'Use imported value despite constraint violation',
            newProvenance: 'import',
            affectedFields: ['spinesNeeded', 'oversubscriptionRatio']
          },
          {
            type: 'modify',
            label: 'Round Up to Even',
            description: `Increase to ${importedSpec.uplinksPerLeaf + 1} to satisfy constraint`,
            newValue: importedSpec.uplinksPerLeaf + 1,
            newProvenance: 'user',
            affectedFields: ['spinesNeeded', 'oversubscriptionRatio']
          }
        ]
      });
    }

    return conflicts;
  }

  /**
   * Detect conflicts in leaf classes
   */
  private detectLeafClassConflicts(
    importedClasses: any[],
    currentClasses: any[]
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Simple comparison - could be enhanced for more sophisticated diff
    if (importedClasses.length !== currentClasses.length) {
      conflicts.push({
        id: 'import-leaf-class-count-conflict',
        type: 'warning',
        severity: 'medium',
        title: 'Leaf Class Count Mismatch',
        message: `Imported spec has ${importedClasses.length} leaf classes, current has ${currentClasses.length}`,
        category: 'import-conflict',
        field: 'leafClasses',
        overridable: true,
        overridden: false,
        importMetadata: {
          importedValue: importedClasses.length,
          computedValue: currentClasses.length,
          fieldPath: 'leafClasses',
          conflictType: 'value',
          provenance: {
            imported: 'import',
            computed: 'user'
          },
          confidence: 'medium'
        },
        resolutionActions: [
          {
            type: 'accept',
            label: 'Use Imported Classes',
            description: 'Replace current leaf classes with imported ones',
            newProvenance: 'import',
            affectedFields: ['leavesNeeded', 'totalPorts', 'oversubscriptionRatio']
          },
          {
            type: 'reject',
            label: 'Keep Current Classes',
            description: 'Keep current leaf class configuration',
            newProvenance: 'user',
            affectedFields: []
          }
        ]
      });
    }

    return conflicts;
  }

  /**
   * Create a value conflict issue
   */
  private createValueConflict(fieldPath: string, importedValue: any, currentValue: any): ImportConflict {
    return {
      id: `import-value-conflict-${fieldPath}`,
      type: 'warning',
      severity: 'medium',
      title: `Value Conflict: ${fieldPath}`,
      message: `Imported value '${importedValue}' differs from current value '${currentValue}'`,
      category: 'import-conflict',
      field: fieldPath,
      overridable: true,
      overridden: false,
      importMetadata: {
        importedValue,
        computedValue: currentValue,
        fieldPath,
        conflictType: 'value',
        provenance: {
          imported: 'import',
          computed: 'user'
        },
        confidence: 'high'
      },
      resolutionActions: [
        {
          type: 'accept',
          label: 'Use Imported Value',
          description: `Set ${fieldPath} to imported value '${importedValue}'`,
          newProvenance: 'import',
          affectedFields: this.getAffectedFields(fieldPath)
        },
        {
          type: 'reject',
          label: 'Keep Current Value',
          description: `Keep current ${fieldPath} value '${currentValue}'`,
          newProvenance: 'user',
          affectedFields: []
        },
        {
          type: 'modify',
          label: 'Custom Value',
          description: `Set a custom value for ${fieldPath}`,
          newProvenance: 'user',
          affectedFields: this.getAffectedFields(fieldPath)
        }
      ]
    };
  }

  /**
   * Get fields that would be affected by changing a particular field
   */
  private getAffectedFields(fieldPath: string): string[] {
    const dependencies: Record<string, string[]> = {
      'uplinksPerLeaf': ['spinesNeeded', 'oversubscriptionRatio'],
      'endpointCount': ['leavesNeeded', 'totalPorts'],
      'spineModelId': ['spinesNeeded', 'totalPorts'],
      'leafModelId': ['leavesNeeded', 'totalPorts'],
      'endpointProfile.portsPerEndpoint': ['leavesNeeded', 'totalPorts'],
    };

    return dependencies[fieldPath] || [];
  }

  /**
   * Calculate total endpoint count from FabricSpec
   */
  private getTotalEndpointCount(spec: FabricSpec): number {
    if (spec.leafClasses) {
      return spec.leafClasses.reduce((total, leafClass) => {
        return total + leafClass.endpointProfiles.reduce((classTotal, profile) => {
          return classTotal + (profile.count || 1);
        }, 0);
      }, 0);
    }
    return spec.endpointCount || 0;
  }

  /**
   * Set a nested value in an object using dot notation path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}