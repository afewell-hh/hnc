// Switch capacity constants based on model specifications
export const SWITCH_CAPACITY = {
    DS2000: {
        ports: 48,
        uplinks: 4,
        bandwidth: 1000, // Gbps per port
        maxEndpoints: 48,
    },
    DS3000: {
        ports: 64,
        downlinks: 32, // Maximum downlinks to leaf switches
        bandwidth: 10000, // Gbps per port
        maxLeaves: 32,
    },
};
