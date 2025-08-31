# HNC State Machine Contracts v0.2

## Workspace Events (Root FSM)
- `CREATE_FABRIC` - Create new fabric in workspace
- `SELECT_FABRIC` - Navigate to fabric designer  
- `DELETE_FABRIC` - Remove fabric from workspace
- `BACK_TO_LIST` - Return to fabric list
- `UPDATE_FABRIC_STATUS` - Update fabric status (draft/computed/saved)

## Fabric Design Events (Child FSM)
- `UPDATE_CONFIG` - Update fabric configuration
- `COMPUTE_TOPOLOGY` - Compute derived topology from config  
- `SAVE_TO_FGD` - Save computed topology to YAML files
- `LOAD_FROM_FGD` - Load existing topology from YAML files

## Workspace States
- `listing` - Showing fabric list
- `creating` - Creating new fabric
- `selected` - Fabric designer active
- `error` - Workspace error state

## Fabric Design States  
- `configuring` - Initial state, gathering user input
- `computing` - Computing derived topology
- `computed` - Topology computed successfully  
- `invalid` - Configuration validation failed
- `saving` - Saving to YAML files
- `saved` - Successfully saved to FGD
- `loading` - Loading from YAML files
- `error` - Fabric error state

## Invariants
- Save only enabled after successful compute
- uplinksPerLeaf % 2 === 0 (even distribution)
- Capacity checks: leavesNeeded > 0, spinesNeeded > 0
- Max oversubscription ratio: 4:1
- DS2000 leaf (48 ports), DS3000 spine (32 ports) only
- Unique fabric names within workspace
- YAML files saved to ./fgd/<fabric-id>/

## Guards
- `isValidConfig` - Validates fabric spec via Zod schema
- `hasCapacity` - Checks switch capacity limits  
- `isEvenUplinks` - Ensures uplinks divisible by spine count
- `isValidFabricName` - Validates fabric name uniqueness
- `fabricExists` - Checks if fabric ID exists in workspace