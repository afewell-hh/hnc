# HNC State Machine Contracts

## Events (FSM API)
- `UPDATE_CONFIG` - Update fabric configuration
- `COMPUTE_TOPOLOGY` - Compute derived topology from config  
- `SAVE_TO_FGD` - Save computed topology to FGD
- `LOAD_FROM_FGD` - Load existing topology from FGD

## State Names
- `configuring` - Initial state, gathering user input
- `computing` - Computing derived topology
- `computed` - Topology computed successfully  
- `invalid` - Configuration validation failed
- `saving` - Saving to FGD
- `saved` - Successfully saved to FGD
- `loading` - Loading from FGD
- `error` - Error state

## Invariants
- Save only enabled after successful compute
- uplinksPerLeaf % 2 === 0 (even distribution)
- Capacity checks: leavesNeeded > 0, spinesNeeded > 0
- Max oversubscription ratio: 4:1
- DS2000 leaf (48 ports), DS3000 spine (32 ports) only

## Guards
- `isValidConfig` - Validates fabric spec via Zod schema
- `hasCapacity` - Checks switch capacity limits
- `isEvenUplinks` - Ensures uplinks divisible by spine count