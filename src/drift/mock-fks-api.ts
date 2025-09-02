/**
 * Mock Kubernetes Fabric Services API for HNC v0.4 drift detection
 * Returns fabric state data that simulates K8s cluster status responses
 */

import type { WiringDiagram } from '../app.types.js';

// K8s Fabric Services API response types
export interface FabricResourceStatus {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
  };
  status: {
    phase: 'Active' | 'Pending' | 'Failed';
    conditions: Array<{
      type: string;
      status: 'True' | 'False' | 'Unknown';
      lastTransitionTime: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export interface SwitchStatus extends FabricResourceStatus {
  kind: 'Switch';
  spec: {
    model: string;
    ports: {
      total: number;
      used: number;
      available: number;
    };
    uplinks: string[];
  };
  status: FabricResourceStatus['status'] & {
    portUtilization: number;
    health: 'Healthy' | 'Degraded' | 'Failed';
  };
}

export interface ServerStatus extends FabricResourceStatus {
  kind: 'Server';
  spec: {
    switchConnection: string;
    ports: number;
  };
  status: FabricResourceStatus['status'] & {
    connectivity: 'Connected' | 'Disconnected' | 'Partial';
  };
}

export interface ConnectionStatus extends FabricResourceStatus {
  kind: 'Connection';
  spec: {
    source: { device: string; port: string };
    target: { device: string; port: string };
  };
  status: FabricResourceStatus['status'] & {
    linkStatus: 'Up' | 'Down' | 'Flapping';
    errors: number;
  };
}

export interface FabricServicesApiResponse {
  apiVersion: 'fabric.k8s.io/v1';
  kind: 'FabricStatus';
  metadata: {
    name: string;
    namespace: string;
  };
  items: {
    switches: SwitchStatus[];
    servers: ServerStatus[];
    connections: ConnectionStatus[];
  };
}

// Mock data generators for different drift scenarios
export class MockFabricServicesApi {
  private fabricId: string;

  constructor(fabricId: string = 'default-fabric') {
    this.fabricId = fabricId;
  }

  /**
   * Generate mock K8s API response with no drift (matches FGD exactly)
   */
  generateNoDriftResponse(fgdDiagram: WiringDiagram): FabricServicesApiResponse {
    const allSwitches = [...fgdDiagram.devices.spines, ...fgdDiagram.devices.leaves];
    const switches: SwitchStatus[] = allSwitches.map((sw, idx) => ({
      kind: 'Switch',
      metadata: {
        name: `${sw.id.toLowerCase()}`,
        namespace: 'fabric-system',
        creationTimestamp: new Date(Date.now() - 86400000).toISOString(),
        labels: {
          'fabric.k8s.io/role': sw.id.toLowerCase().includes('spine') ? 'spine' : 'leaf',
          'fabric.k8s.io/model': sw.model
        }
      },
      spec: {
        model: sw.model,
        ports: {
          total: sw.ports,
          used: Math.floor(sw.ports * 0.6), // Mock usage
          available: Math.floor(sw.ports * 0.4)
        },
        uplinks: [] // Mock uplinks
      },
      status: {
        phase: 'Active',
        conditions: [{
          type: 'Ready',
          status: 'True',
          lastTransitionTime: new Date(Date.now() - 3600000).toISOString()
        }],
        portUtilization: 60, // Mock utilization
        health: 'Healthy'
      }
    }));

    const servers: ServerStatus[] = fgdDiagram.devices.servers.map(server => ({
      kind: 'Server',
      metadata: {
        name: server.id.toLowerCase(),
        namespace: 'fabric-system',
        creationTimestamp: new Date(Date.now() - 86400000).toISOString(),
        labels: {
          'fabric.k8s.io/type': 'endpoint'
        }
      },
      spec: {
        switchConnection: 'unknown', // Mock data
        ports: server.connections || 1
      },
      status: {
        phase: 'Active',
        conditions: [{
          type: 'Connected',
          status: 'True',
          lastTransitionTime: new Date(Date.now() - 3600000).toISOString()
        }],
        connectivity: 'Connected'
      }
    }));

    const connections: ConnectionStatus[] = fgdDiagram.connections.map(conn => ({
      kind: 'Connection',
      metadata: {
        name: `${conn.from.device.toLowerCase()}-to-${conn.to.device.toLowerCase()}`,
        namespace: 'fabric-system',
        creationTimestamp: new Date(Date.now() - 86400000).toISOString()
      },
      spec: {
        source: { device: conn.from.device, port: conn.from.port },
        target: { device: conn.to.device, port: conn.to.port }
      },
      status: {
        phase: 'Active',
        conditions: [{
          type: 'LinkUp',
          status: 'True',
          lastTransitionTime: new Date(Date.now() - 3600000).toISOString()
        }],
        linkStatus: 'Up',
        errors: 0
      }
    }));

    return {
      apiVersion: 'fabric.k8s.io/v1',
      kind: 'FabricStatus',
      metadata: {
        name: this.fabricId,
        namespace: 'fabric-system'
      },
      items: {
        switches,
        servers,
        connections
      }
    };
  }

  /**
   * Generate mock K8s API response with missing switches
   */
  generateMissingSwitchesResponse(fgdDiagram: WiringDiagram): FabricServicesApiResponse {
    const basResponse = this.generateNoDriftResponse(fgdDiagram);
    
    // Remove some switches to simulate drift
    basResponse.items.switches = basResponse.items.switches.slice(0, Math.max(1, basResponse.items.switches.length - 1));
    
    return basResponse;
  }

  /**
   * Generate mock K8s API response with port mismatches
   */
  generatePortMismatchResponse(fgdDiagram: WiringDiagram): FabricServicesApiResponse {
    const baseResponse = this.generateNoDriftResponse(fgdDiagram);
    
    // Modify port configurations to create drift
    baseResponse.items.switches.forEach(sw => {
      if (Math.random() > 0.5) {
        sw.spec.ports.used = Math.floor(sw.spec.ports.total * 0.8); // Different utilization
        sw.spec.ports.available = sw.spec.ports.total - sw.spec.ports.used;
        sw.status.portUtilization = (sw.spec.ports.used / sw.spec.ports.total) * 100;
        
        // Add a degraded condition
        sw.status.conditions.push({
          type: 'PortConfiguration',
          status: 'False',
          lastTransitionTime: new Date(Date.now() - 1800000).toISOString(),
          reason: 'PortMismatch',
          message: 'Port configuration differs from expected state'
        });
      }
    });

    return baseResponse;
  }

  /**
   * Generate mock K8s API response with configuration differences
   */
  generateConfigDifferenceResponse(fgdDiagram: WiringDiagram): FabricServicesApiResponse {
    const baseResponse = this.generateNoDriftResponse(fgdDiagram);
    
    // Modify various configurations
    baseResponse.items.switches.forEach(sw => {
      // Change switch model or add unexpected labels
      if (Math.random() > 0.7) {
        sw.metadata.labels!['fabric.k8s.io/config-drift'] = 'detected';
        sw.spec.model = sw.spec.model === 'DS2000' ? 'DS2000-V2' : sw.spec.model; // Version drift
        
        sw.status.conditions.push({
          type: 'ConfigurationSync',
          status: 'False',
          lastTransitionTime: new Date(Date.now() - 900000).toISOString(),
          reason: 'ConfigDrift',
          message: 'Switch configuration has drifted from desired state'
        });
      }
    });

    // Add extra connections not in FGD
    if (baseResponse.items.connections.length > 0) {
      const extraConnection: ConnectionStatus = {
        ...baseResponse.items.connections[0],
        metadata: {
          ...baseResponse.items.connections[0].metadata,
          name: 'unexpected-connection-drift',
          labels: { 'fabric.k8s.io/drift': 'unexpected-resource' }
        },
        spec: {
          source: { device: 'spine-1', port: 'Eth1/99' },
          target: { device: 'leaf-99', port: 'Eth1/1' }
        },
        status: {
          ...baseResponse.items.connections[0].status,
          conditions: [{
            type: 'UnexpectedResource',
            status: 'True',
            lastTransitionTime: new Date(Date.now() - 300000).toISOString(),
            reason: 'DriftDetected',
            message: 'Connection not found in desired configuration'
          }]
        }
      };
      baseResponse.items.connections.push(extraConnection);
    }

    return baseResponse;
  }

  /**
   * Simulate API call with configurable delay and failure scenarios
   */
  async fetchFabricStatus(scenario: 'no-drift' | 'missing-switches' | 'port-mismatches' | 'config-differences' = 'no-drift'): Promise<FabricServicesApiResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    // For demo purposes, return mock data based on a simple FGD structure
    // In a real implementation, this would fetch from the actual FGD data
    const mockFgdDiagram: WiringDiagram = {
      devices: {
        servers: [
          { id: 'Server-1', type: 'compute', connections: 2 },
          { id: 'Server-2', type: 'compute', connections: 1 },
          { id: 'Server-3', type: 'storage', connections: 1 }
        ],
        spines: [
          { id: 'Spine-1', model: 'DS3000', ports: 32 }
        ],
        leaves: [
          { id: 'Leaf-1', model: 'DS2000', ports: 48 },
          { id: 'Leaf-2', model: 'DS2000', ports: 48 }
        ]
      },
      connections: [
        { from: { device: 'Leaf-1', port: 'Eth1/49' }, to: { device: 'Spine-1', port: 'Eth1/1' }, type: 'uplink' },
        { from: { device: 'Leaf-2', port: 'Eth1/49' }, to: { device: 'Spine-1', port: 'Eth1/2' }, type: 'uplink' }
      ],
      metadata: {
        generatedAt: new Date(),
        fabricName: 'test-fabric',
        totalDevices: 4
      }
    };

    switch (scenario) {
      case 'missing-switches':
        return this.generateMissingSwitchesResponse(mockFgdDiagram);
      case 'port-mismatches':
        return this.generatePortMismatchResponse(mockFgdDiagram);
      case 'config-differences':
        return this.generateConfigDifferenceResponse(mockFgdDiagram);
      default:
        return this.generateNoDriftResponse(mockFgdDiagram);
    }
  }
}

// Singleton instance for consistent mock data
export const mockFabricServicesApi = new MockFabricServicesApi();