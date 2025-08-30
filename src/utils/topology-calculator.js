import { SWITCH_CAPACITY } from '../types/derived-topology.types';
/**
 * Core topology calculation utilities for HNC v0.1
 * Computes derived topology metrics from FabricSpec
 */
// Calculate number of leaf switches needed
export function calculateLeavesNeeded(fabricSpec) {
    const totalEndpoints = fabricSpec.endpointProfiles.reduce((sum, profile) => sum + profile.count, 0);
    // Account for redundant endpoints (need 2x ports)
    const redundantEndpoints = fabricSpec.endpointProfiles
        .filter(profile => profile.redundancy)
        .reduce((sum, profile) => sum + profile.count, 0);
    const totalPortsNeeded = totalEndpoints + redundantEndpoints;
    const availablePortsPerLeaf = SWITCH_CAPACITY.DS2000.ports - fabricSpec.uplinksPerLeaf;
    return Math.ceil(totalPortsNeeded / availablePortsPerLeaf);
}
// Calculate number of spine switches needed
export function calculateSpinesNeeded(fabricSpec, leavesNeeded) {
    const totalUplinks = leavesNeeded * fabricSpec.uplinksPerLeaf;
    const availableDownlinksPerSpine = SWITCH_CAPACITY.DS3000.downlinks;
    return Math.ceil(totalUplinks / availableDownlinksPerSpine);
}
// Calculate total fabric capacity
export function calculateTotalCapacity(leavesNeeded, uplinksPerLeaf) {
    const endpointCapacity = leavesNeeded * (SWITCH_CAPACITY.DS2000.ports - uplinksPerLeaf);
    return endpointCapacity * SWITCH_CAPACITY.DS2000.bandwidth;
}
// Calculate oversubscription ratio
export function calculateOversubscriptionRatio(fabricSpec, leavesNeeded) {
    const endpointBandwidth = leavesNeeded *
        (SWITCH_CAPACITY.DS2000.ports - fabricSpec.uplinksPerLeaf) *
        SWITCH_CAPACITY.DS2000.bandwidth;
    const uplinkBandwidth = leavesNeeded *
        fabricSpec.uplinksPerLeaf *
        SWITCH_CAPACITY.DS3000.bandwidth;
    return endpointBandwidth / uplinkBandwidth;
}
// Validate topology constraints
export function validateTopology(fabricSpec, topology) {
    const warnings = [];
    const errors = [];
    // Check port limits
    if (topology.leavesNeeded && topology.leavesNeeded > SWITCH_CAPACITY.DS3000.maxLeaves) {
        errors.push(`Topology requires ${topology.leavesNeeded} leaves, exceeding DS3000 maximum of ${SWITCH_CAPACITY.DS3000.maxLeaves}`);
    }
    // Check oversubscription ratio
    if (topology.oversubscriptionRatio && topology.oversubscriptionRatio > 3.0) {
        warnings.push(`High oversubscription ratio: ${topology.oversubscriptionRatio.toFixed(2)}:1`);
    }
    // Check redundancy requirements
    const hasRedundantProfiles = fabricSpec.endpointProfiles.some(p => p.redundancy);
    if (hasRedundantProfiles && fabricSpec.uplinksPerLeaf < 2) {
        warnings.push('Redundant endpoints require at least 2 uplinks per leaf for proper failover');
    }
    return {
        isValid: errors.length === 0,
        withinPortLimits: topology.leavesNeeded ? topology.leavesNeeded <= SWITCH_CAPACITY.DS3000.maxLeaves : true,
        withinBandwidthLimits: true, // Placeholder for future bandwidth validation
        meetsRedundancyRequirements: !hasRedundantProfiles || fabricSpec.uplinksPerLeaf >= 2,
        warnings,
        errors,
    };
}
// Main topology computation function
export function computeTopology(fabricSpec) {
    const startTime = Date.now();
    try {
        const leavesNeeded = calculateLeavesNeeded(fabricSpec);
        const spinesNeeded = calculateSpinesNeeded(fabricSpec, leavesNeeded);
        const totalCapacity = calculateTotalCapacity(leavesNeeded, fabricSpec.uplinksPerLeaf);
        const oversubscriptionRatio = calculateOversubscriptionRatio(fabricSpec, leavesNeeded);
        // Calculate detailed capacity breakdown
        const endpointPorts = leavesNeeded * (SWITCH_CAPACITY.DS2000.ports - fabricSpec.uplinksPerLeaf);
        const uplinkPorts = leavesNeeded * fabricSpec.uplinksPerLeaf;
        const totalEndpoints = fabricSpec.endpointProfiles.reduce((sum, p) => sum + p.count, 0);
        const redundantEndpoints = fabricSpec.endpointProfiles
            .filter(p => p.redundancy)
            .reduce((sum, p) => sum + p.count, 0);
        const availableEndpointPorts = endpointPorts - totalEndpoints - redundantEndpoints;
        const totalBandwidth = totalCapacity / 1000; // Convert to Gbps
        // Calculate utilization metrics
        const leafPortUtilization = ((totalEndpoints + redundantEndpoints) / endpointPorts) * 100;
        const spinePortUtilization = (uplinkPorts / (spinesNeeded * SWITCH_CAPACITY.DS3000.downlinks)) * 100;
        const bandwidthUtilization = 50; // Placeholder - would need traffic patterns
        // Determine redundancy level
        const hasRedundantSpines = spinesNeeded > 1;
        const hasRedundantUplinks = fabricSpec.uplinksPerLeaf > 1;
        const redundancyLevel = hasRedundantSpines && hasRedundantUplinks ? 'full' :
            hasRedundantSpines || hasRedundantUplinks ? 'partial' : 'none';
        const derivedTopology = {
            leavesNeeded,
            spinesNeeded,
            totalCapacity,
            oversubscriptionRatio,
            capacityBreakdown: {
                endpointPorts,
                uplinkPorts,
                availableEndpointPorts,
                totalBandwidth,
            },
            utilization: {
                leafPortUtilization,
                spinePortUtilization,
                bandwidthUtilization,
            },
            redundancy: {
                hasRedundantSpines,
                hasRedundantUplinks,
                redundancyLevel,
            },
            validation: validateTopology(fabricSpec, { leavesNeeded, spinesNeeded, totalCapacity, oversubscriptionRatio }),
            computedAt: new Date(),
        };
        const computationTimeMs = Date.now() - startTime;
        return {
            fabricSpec,
            derivedTopology,
            computationMeta: {
                algorithmVersion: '1.0.0',
                computationTimeMs,
                cacheHit: false,
                warnings: derivedTopology.validation.warnings,
                errors: derivedTopology.validation.errors,
            },
        };
    }
    catch (error) {
        const computationTimeMs = Date.now() - startTime;
        throw new Error(`Topology computation failed after ${computationTimeMs}ms: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Utility function for quick validation
export function validateFabricSpecQuick(fabricSpec) {
    const issues = [];
    const totalEndpoints = fabricSpec.endpointProfiles.reduce((sum, p) => sum + p.count, 0);
    if (totalEndpoints === 0) {
        issues.push('No endpoints specified');
    }
    if (totalEndpoints > 1000) {
        issues.push('Too many endpoints for single fabric');
    }
    if (fabricSpec.uplinksPerLeaf < 1 || fabricSpec.uplinksPerLeaf > 4) {
        issues.push('Invalid uplinks per leaf (must be 1-4)');
    }
    return {
        isValid: issues.length === 0,
        issues,
    };
}
