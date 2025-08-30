/**
 * Pure computation domain for topology calculations
 * Extracted from app.machine.ts to enable clean unit testing
 */
export function computeDerived(spec) {
    const [leafPorts, spinePorts] = [48, 32]; // DS2000/DS3000 stub
    const downlinkPorts = leafPorts - spec.uplinksPerLeaf;
    const leavesNeeded = computeLeavesNeeded(spec.endpointCount, downlinkPorts);
    const spinesNeeded = computeSpinesNeeded(leavesNeeded, spec.uplinksPerLeaf);
    const totalPorts = (leavesNeeded * leafPorts) + (spinesNeeded * spinePorts);
    const usedPorts = spec.endpointCount + (leavesNeeded * spec.uplinksPerLeaf * 2);
    const oversubscriptionRatio = computeOversubscription(leavesNeeded * spec.uplinksPerLeaf, spec.endpointCount);
    const validationErrors = [];
    if (leavesNeeded === 0)
        validationErrors.push('No leaves computed');
    if (spinesNeeded === 0)
        validationErrors.push('No spines computed');
    if (spec.uplinksPerLeaf > leafPorts / 2)
        validationErrors.push('Too many uplinks per leaf');
    if (oversubscriptionRatio > 4.0)
        validationErrors.push(`Oversubscription too high: ${oversubscriptionRatio.toFixed(2)}:1`);
    return {
        leavesNeeded,
        spinesNeeded,
        totalPorts,
        usedPorts,
        oversubscriptionRatio,
        isValid: validationErrors.length === 0,
        validationErrors
    };
}
// Helper functions for computation
const computeLeavesNeeded = (endpointCount, portsPerLeaf) => (portsPerLeaf <= 0 || endpointCount <= 0) ? 0 : Math.ceil(endpointCount / portsPerLeaf);
const computeSpinesNeeded = (leaves, uplinksPerLeaf) => (leaves <= 0 || uplinksPerLeaf <= 0) ? 0 : Math.max(1, Math.ceil((leaves * uplinksPerLeaf) / 32));
const computeOversubscription = (uplinks, downlinks) => uplinks <= 0 ? 0 : downlinks / uplinks;
