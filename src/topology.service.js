import { CatalogService } from './catalog.service';
export class TopologyService {
    static computeTopology(config) {
        const errors = [];
        // Validate models exist
        const spineModel = CatalogService.getSwitchModel(config.spineModelId);
        const leafModel = CatalogService.getSwitchModel(config.leafModelId);
        if (!spineModel)
            errors.push(`Invalid spine model: ${config.spineModelId}`);
        if (!leafModel)
            errors.push(`Invalid leaf model: ${config.leafModelId}`);
        if (errors.length > 0) {
            return {
                leavesNeeded: 0,
                spinesNeeded: 0,
                totalCapacity: 0,
                oversubscriptionRatio: 0,
                isValid: false,
                errors
            };
        }
        // Calculate leaves needed based on endpoint requirements
        const endpointsPerLeaf = leafModel.ports - config.uplinksPerLeaf;
        const totalEndpoints = config.endpointProfile.endpointCount;
        const leavesNeeded = Math.ceil(totalEndpoints / endpointsPerLeaf);
        // Calculate spines needed based on uplink capacity
        const totalUplinks = leavesNeeded * config.uplinksPerLeaf;
        const spinesNeeded = Math.ceil(totalUplinks / spineModel.ports);
        // Calculate capacity and oversubscription
        const totalCapacity = leavesNeeded * endpointsPerLeaf;
        const uplinkCapacity = spinesNeeded * spineModel.ports;
        const oversubscriptionRatio = uplinkCapacity > 0 ? totalCapacity / uplinkCapacity : 0;
        // Validation checks
        if (config.uplinksPerLeaf < 1 || config.uplinksPerLeaf > 4) {
            errors.push('Uplinks per leaf must be between 1 and 4');
        }
        // Only check oversubscription if we have a valid configuration
        if (errors.length === 0 && oversubscriptionRatio > 4) {
            errors.push('Oversubscription ratio exceeds maximum (4:1)');
        }
        return {
            leavesNeeded,
            spinesNeeded,
            totalCapacity,
            oversubscriptionRatio: Math.round(oversubscriptionRatio * 100) / 100,
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    static generateWiringDiagramStub(topology, config) {
        if (!topology.isValid)
            return null;
        return {
            servers: Array.from({ length: config.endpointProfile.endpointCount }, (_, i) => ({
                id: `server-${i + 1}`,
                name: `Server ${i + 1}`,
                connections: []
            })),
            switches: {
                leaves: Array.from({ length: topology.leavesNeeded }, (_, i) => ({
                    id: `leaf-${i + 1}`,
                    name: `Leaf Switch ${i + 1}`,
                    model: config.leafModelId
                })),
                spines: Array.from({ length: topology.spinesNeeded }, (_, i) => ({
                    id: `spine-${i + 1}`,
                    name: `Spine Switch ${i + 1}`,
                    model: config.spineModelId
                }))
            },
            connections: {
                serverToLeaf: [],
                leafToSpine: []
            }
        };
    }
}
