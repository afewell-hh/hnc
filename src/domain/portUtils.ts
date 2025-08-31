/**
 * Port Range Parsing Utilities - HNC v0.3
 * Handles various port range formats for fabric port allocation
 */

/**
 * Parses a port range string into an array of individual port names
 * 
 * Supported formats:
 * - Range: "E1/49-56" → ["E1/49", "E1/50", ..., "E1/56"]
 * - Discrete list: ["E1/1", "E1/3", "E1/5"] → ["E1/1", "E1/3", "E1/5"]
 * - Mixed formats handled gracefully
 * 
 * @param portRange - Port range string or array of port strings
 * @returns Array of individual port names in ascending order
 */
export function parsePortRange(portRange: string | string[]): string[] {
  if (Array.isArray(portRange)) {
    // Already a discrete list, return sorted
    return [...portRange].sort(comparePortNames);
  }
  
  if (typeof portRange !== 'string') {
    return [];
  }
  
  // Check if it's a range format like "E1/49-56"
  const rangeMatch = portRange.match(/^(\w+\/\d+)-(\d+)$/);
  if (rangeMatch) {
    const [, prefix, endNum] = rangeMatch;
    const startNum = parseInt(prefix.split('/')[1], 10);
    const endNumber = parseInt(endNum, 10);
    
    if (startNum > endNumber) {
      return [];
    }
    
    const ports: string[] = [];
    const basePrefix = prefix.split('/')[0];
    
    for (let i = startNum; i <= endNumber; i++) {
      ports.push(`${basePrefix}/${i}`);
    }
    
    return ports;
  }
  
  // Single port or unrecognized format
  return [portRange];
}

/**
 * Expands an array of port ranges/discrete ports into individual port names
 * 
 * @param portRanges - Array of port range strings or port names
 * @returns Flattened, sorted array of individual port names
 */
export function expandPortRanges(portRanges: string[]): string[] {
  const allPorts: string[] = [];
  
  for (const range of portRanges) {
    allPorts.push(...parsePortRange(range));
  }
  
  // Remove duplicates and sort
  return [...new Set(allPorts)].sort(comparePortNames);
}

/**
 * Compares two port names for sorting
 * Handles formats like "E1/49", "E1/1", etc.
 * 
 * @param a - First port name
 * @param b - Second port name
 * @returns Comparison result for sorting
 */
function comparePortNames(a: string, b: string): number {
  const parsePort = (port: string) => {
    const match = port.match(/^(\w+)\/(\d+)$/);
    if (match) {
      return {
        prefix: match[1],
        number: parseInt(match[2], 10)
      };
    }
    return { prefix: port, number: 0 };
  };
  
  const portA = parsePort(a);
  const portB = parsePort(b);
  
  // First compare prefixes
  if (portA.prefix !== portB.prefix) {
    return portA.prefix.localeCompare(portB.prefix);
  }
  
  // Then compare numbers
  return portA.number - portB.number;
}

/**
 * Validates that a port exists in the available port list
 * 
 * @param port - Port name to validate
 * @param availablePorts - Array of available port names
 * @returns True if port exists in available list
 */
export function isValidPort(port: string, availablePorts: string[]): boolean {
  return availablePorts.includes(port);
}

/**
 * Gets the next available port from a sorted port list
 * 
 * @param usedPorts - Set of already used port names
 * @param availablePorts - Sorted array of available port names
 * @returns Next available port name, or null if none available
 */
export function getNextAvailablePort(
  usedPorts: Set<string>, 
  availablePorts: string[]
): string | null {
  for (const port of availablePorts) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  return null;
}