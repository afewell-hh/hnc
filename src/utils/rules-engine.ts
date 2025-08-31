import type { Issue, FabricSpec, DerivedTopology, FabricGuard, FieldOverride } from '../app.types';

/**
 * Rules Engine for HNC fabric design validation
 * Generates issues based on configuration, topology, and constraints
 */

export interface RulesEngineOptions {
  enableOptimizationSuggestions: boolean;
  enableConfigurationWarnings: boolean;
  enableConstraintValidation: boolean;
}

const defaultOptions: RulesEngineOptions = {
  enableOptimizationSuggestions: true,
  enableConfigurationWarnings: true,
  enableConstraintValidation: true,
};

export class RulesEngine {
  private options: RulesEngineOptions;
  
  constructor(options: Partial<RulesEngineOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Analyze fabric configuration and generate issues
   */
  analyzeConfiguration(
    config: Partial<FabricSpec>,
    topology?: DerivedTopology | null,
    fieldOverrides: FieldOverride[] = []
  ): Issue[] {
    const issues: Issue[] = [];
    const overriddenFields = new Set(fieldOverrides.map(o => o.fieldPath));

    // Configuration validation issues
    if (this.options.enableConfigurationWarnings) {
      issues.push(...this.validateConfiguration(config, overriddenFields));
    }

    // Topology-based issues
    if (topology) {
      if (this.options.enableConstraintValidation) {
        issues.push(...this.analyzeTopology(topology, overriddenFields));
      }
      
      if (this.options.enableOptimizationSuggestions) {
        issues.push(...this.generateOptimizationSuggestions(config, topology, overriddenFields));
      }
    }

    // Mark overridden issues
    return issues.map(issue => ({
      ...issue,
      overridden: issue.field ? overriddenFields.has(issue.field) : false
    }));
  }

  private validateConfiguration(config: Partial<FabricSpec>, overriddenFields: Set<string>): Issue[] {
    const issues: Issue[] = [];

    // Fabric name validation
    if (!config.name || config.name.trim().length === 0) {
      issues.push({
        id: 'config-no-name',
        type: 'error',
        severity: 'high',
        title: 'Fabric Name Required',
        message: 'Fabric must have a name for identification and deployment.',
        field: 'name',
        category: 'validation',
        overridable: false
      });
    } else if (config.name.length < 3) {
      issues.push({
        id: 'config-short-name',
        type: 'warning',
        severity: 'medium',
        title: 'Short Fabric Name',
        message: 'Fabric names should be at least 3 characters for clarity.',
        field: 'name',
        category: 'configuration',
        overridable: true
      });
    }

    // Model validation
    if (!config.spineModelId) {
      issues.push({
        id: 'config-no-spine-model',
        type: 'error',
        severity: 'high',
        title: 'Spine Model Required',
        message: 'Must select a spine switch model for topology computation.',
        field: 'spineModelId',
        category: 'validation',
        overridable: false
      });
    }

    if (!config.leafModelId) {
      issues.push({
        id: 'config-no-leaf-model',
        type: 'error',
        severity: 'high',
        title: 'Leaf Model Required',
        message: 'Must select a leaf switch model for topology computation.',
        field: 'leafModelId',
        category: 'validation',
        overridable: false
      });
    }

    // Multi-class vs legacy mode validation
    if (config.leafClasses && config.leafClasses.length > 0) {
      // Multi-class mode validation
      issues.push(...this.validateMultiClassConfiguration(config, overriddenFields));
    } else {
      // Legacy mode validation
      issues.push(...this.validateLegacyConfiguration(config, overriddenFields));
    }

    return issues;
  }

  private validateMultiClassConfiguration(config: Partial<FabricSpec>, overriddenFields: Set<string>): Issue[] {
    const issues: Issue[] = [];
    
    if (!config.leafClasses || config.leafClasses.length === 0) {
      issues.push({
        id: 'multiclass-no-classes',
        type: 'error',
        severity: 'high',
        title: 'No Leaf Classes Defined',
        message: 'Multi-class fabric must have at least one leaf class defined.',
        field: 'leafClasses',
        category: 'validation',
        overridable: false
      });
      return issues;
    }

    config.leafClasses.forEach((leafClass, index) => {
      const fieldPrefix = `leafClasses.${index}`;

      // Class ID validation
      if (!leafClass.id || leafClass.id.trim().length === 0) {
        issues.push({
          id: `multiclass-no-id-${index}`,
          type: 'error',
          severity: 'high',
          title: 'Leaf Class ID Required',
          message: `Leaf class at index ${index} must have a unique identifier.`,
          field: `${fieldPrefix}.id`,
          category: 'validation',
          overridable: false
        });
      }

      // Uplinks validation
      if (leafClass.uplinksPerLeaf <= 0) {
        issues.push({
          id: `multiclass-invalid-uplinks-${index}`,
          type: 'error',
          severity: 'high',
          title: 'Invalid Uplinks Configuration',
          message: `Leaf class '${leafClass.id}' must have at least 1 uplink per leaf.`,
          field: `${fieldPrefix}.uplinksPerLeaf`,
          category: 'validation',
          overridable: false
        });
      } else if (leafClass.uplinksPerLeaf % 2 !== 0) {
        issues.push({
          id: `multiclass-odd-uplinks-${index}`,
          type: 'error',
          severity: 'high',
          title: 'Odd Uplinks Per Leaf',
          message: `Leaf class '${leafClass.id}' has ${leafClass.uplinksPerLeaf} uplinks per leaf. Even numbers are required for proper distribution.`,
          field: `${fieldPrefix}.uplinksPerLeaf`,
          category: 'constraint',
          overridable: true
        });
      }

      // Endpoint profiles validation
      if (!leafClass.endpointProfiles || leafClass.endpointProfiles.length === 0) {
        issues.push({
          id: `multiclass-no-endpoints-${index}`,
          type: 'warning',
          severity: 'medium',
          title: 'No Endpoint Profiles',
          message: `Leaf class '${leafClass.id}' has no endpoint profiles defined.`,
          field: `${fieldPrefix}.endpointProfiles`,
          category: 'configuration',
          overridable: true
        });
      } else {
        leafClass.endpointProfiles.forEach((profile, profileIndex) => {
          if (!profile.name || profile.name.trim().length === 0) {
            issues.push({
              id: `multiclass-profile-no-name-${index}-${profileIndex}`,
              type: 'error',
              severity: 'medium',
              title: 'Endpoint Profile Name Required',
              message: `Profile at index ${profileIndex} in class '${leafClass.id}' needs a name.`,
              field: `${fieldPrefix}.endpointProfiles.${profileIndex}.name`,
              category: 'validation',
              overridable: false
            });
          }

          if (profile.portsPerEndpoint <= 0) {
            issues.push({
              id: `multiclass-profile-invalid-ports-${index}-${profileIndex}`,
              type: 'error',
              severity: 'high',
              title: 'Invalid Ports Per Endpoint',
              message: `Profile '${profile.name}' in class '${leafClass.id}' must have at least 1 port per endpoint.`,
              field: `${fieldPrefix}.endpointProfiles.${profileIndex}.portsPerEndpoint`,
              category: 'validation',
              overridable: false
            });
          }
        });
      }
    });

    return issues;
  }

  private validateLegacyConfiguration(config: Partial<FabricSpec>, overriddenFields: Set<string>): Issue[] {
    const issues: Issue[] = [];

    // Uplinks validation
    if (!config.uplinksPerLeaf || config.uplinksPerLeaf <= 0) {
      issues.push({
        id: 'legacy-no-uplinks',
        type: 'error',
        severity: 'high',
        title: 'Uplinks Per Leaf Required',
        message: 'Must specify the number of uplinks per leaf switch.',
        field: 'uplinksPerLeaf',
        category: 'validation',
        overridable: false
      });
    } else if (config.uplinksPerLeaf % 2 !== 0) {
      issues.push({
        id: 'legacy-odd-uplinks',
        type: 'error',
        severity: 'high',
        title: 'Odd Uplinks Per Leaf',
        message: `${config.uplinksPerLeaf} uplinks per leaf detected. Even numbers are required for proper distribution across spines.`,
        field: 'uplinksPerLeaf',
        category: 'constraint',
        overridable: true
      });
    }

    // Endpoint count validation
    if (!config.endpointCount || config.endpointCount <= 0) {
      issues.push({
        id: 'legacy-no-endpoints',
        type: 'error',
        severity: 'high',
        title: 'Endpoint Count Required',
        message: 'Must specify the number of endpoints to connect to the fabric.',
        field: 'endpointCount',
        category: 'validation',
        overridable: false
      });
    }

    // Endpoint profile validation
    if (!config.endpointProfile) {
      issues.push({
        id: 'legacy-no-profile',
        type: 'error',
        severity: 'high',
        title: 'Endpoint Profile Required',
        message: 'Must select an endpoint profile to determine port requirements.',
        field: 'endpointProfile',
        category: 'validation',
        overridable: false
      });
    } else if (config.endpointProfile.portsPerEndpoint <= 0) {
      issues.push({
        id: 'legacy-invalid-profile-ports',
        type: 'error',
        severity: 'high',
        title: 'Invalid Profile Configuration',
        message: 'Endpoint profile must specify at least 1 port per endpoint.',
        field: 'endpointProfile.portsPerEndpoint',
        category: 'validation',
        overridable: false
      });
    }

    return issues;
  }

  private analyzeTopology(topology: DerivedTopology, overriddenFields: Set<string>): Issue[] {
    const issues: Issue[] = [];

    // Convert validation errors to issues
    topology.validationErrors.forEach((error, index) => {
      issues.push({
        id: `topology-validation-${index}`,
        type: 'error',
        severity: 'high',
        title: 'Topology Validation Error',
        message: error,
        category: 'constraint',
        overridable: false
      });
    });

    // Convert guards to issues
    topology.guards.forEach((guard, index) => {
      issues.push(this.guardToIssue(guard, index));
    });

    // Oversubscription warnings
    if (topology.oversubscriptionRatio > 4) {
      issues.push({
        id: 'topology-high-oversubscription',
        type: topology.oversubscriptionRatio > 8 ? 'error' : 'warning',
        severity: topology.oversubscriptionRatio > 8 ? 'high' : 'medium',
        title: 'High Oversubscription Ratio',
        message: `Oversubscription ratio is ${topology.oversubscriptionRatio.toFixed(2)}:1. This may impact performance under high load.`,
        category: 'optimization',
        overridable: true
      });
    }

    // Port utilization warnings
    const portUtilization = (topology.usedPorts / topology.totalPorts) * 100;
    if (portUtilization > 90) {
      issues.push({
        id: 'topology-high-port-utilization',
        type: 'warning',
        severity: 'medium',
        title: 'High Port Utilization',
        message: `Port utilization is ${portUtilization.toFixed(1)}%. Consider adding more switches for future expansion.`,
        category: 'optimization',
        overridable: true
      });
    }

    return issues;
  }

  private generateOptimizationSuggestions(
    config: Partial<FabricSpec>, 
    topology: DerivedTopology, 
    overriddenFields: Set<string>
  ): Issue[] {
    const issues: Issue[] = [];

    // Suggest spine count optimization
    if (topology.spinesNeeded === 1 && topology.leavesNeeded > 4) {
      issues.push({
        id: 'optimization-single-spine',
        type: 'info',
        severity: 'low',
        title: 'Consider Multiple Spines',
        message: `With ${topology.leavesNeeded} leaves, consider using 2 spines for redundancy and load distribution.`,
        category: 'optimization',
        overridable: true
      });
    }

    // Suggest leaf count optimization
    const leafUtilization = topology.usedPorts / (topology.leavesNeeded * 48); // Assuming 48-port leaves
    if (leafUtilization < 0.5) {
      issues.push({
        id: 'optimization-low-leaf-utilization',
        type: 'info',
        severity: 'low',
        title: 'Low Leaf Utilization',
        message: `Leaf switches are only ${(leafUtilization * 100).toFixed(1)}% utilized. Consider consolidating endpoints or reducing leaf count.`,
        category: 'optimization',
        overridable: true
      });
    }

    // ES-LAG optimization suggestions
    if (config.leafClasses) {
      config.leafClasses.forEach((leafClass, classIndex) => {
        leafClass.endpointProfiles?.forEach((profile, profileIndex) => {
          if (profile.esLag && (!profile.nics || profile.nics < 4)) {
            issues.push({
              id: `optimization-eslag-nics-${classIndex}-${profileIndex}`,
              type: 'info',
              severity: 'low',
              title: 'ES-LAG NIC Optimization',
              message: `Profile '${profile.name}' uses ES-LAG with ${profile.nics || 1} NIC(s). Consider 4+ NICs for better performance and redundancy.`,
              field: `leafClasses.${classIndex}.endpointProfiles.${profileIndex}.nics`,
              category: 'optimization',
              overridable: true
            });
          }
        });
      });
    }

    return issues;
  }

  private guardToIssue(guard: FabricGuard, index: number): Issue {
    switch (guard.guardType) {
      case 'ES_LAG_INVALID':
        return {
          id: `guard-eslag-${index}`,
          type: 'error',
          severity: 'high',
          title: 'ES-LAG Constraint Violation',
          message: guard.message,
          field: `leafClasses.${guard.details.leafClassId}.endpointProfiles.${guard.details.profileName}.nics`,
          category: 'constraint',
          overridable: true
        };
      
      case 'MC_LAG_ODD_LEAF_COUNT':
        return {
          id: `guard-mclag-${index}`,
          type: 'error',
          severity: 'high',
          title: 'MC-LAG Constraint Violation', 
          message: guard.message,
          field: `leafClasses.${guard.details.classId}.count`,
          category: 'constraint',
          overridable: true
        };
      
      default:
        return {
          id: `guard-unknown-${index}`,
          type: 'error',
          severity: 'medium',
          title: 'Unknown Constraint Violation',
          message: (guard as any).message || 'Unknown constraint violation detected',
          category: 'constraint',
          overridable: false
        };
    }
  }

  /**
   * Check if configuration can be saved based on issues
   */
  canSave(issues: Issue[]): boolean {
    // Cannot save if there are unresolved high-severity errors
    const blockingErrors = issues.filter(issue => 
      issue.type === 'error' && 
      issue.severity === 'high' && 
      !issue.overridden &&
      !issue.overridable
    );
    
    return blockingErrors.length === 0;
  }

  /**
   * Get save readiness status
   */
  getSaveReadiness(issues: Issue[]): {
    canSave: boolean;
    blockers: Issue[];
    warnings: Issue[];
    overrideRequired: Issue[];
  } {
    const blockers = issues.filter(issue => 
      issue.type === 'error' && 
      !issue.overridden && 
      !issue.overridable
    );

    const overrideRequired = issues.filter(issue =>
      issue.type === 'error' &&
      !issue.overridden &&
      issue.overridable
    );

    const warnings = issues.filter(issue =>
      issue.type === 'warning' && 
      !issue.overridden
    );

    return {
      canSave: blockers.length === 0 && overrideRequired.length === 0,
      blockers,
      warnings,
      overrideRequired
    };
  }
}