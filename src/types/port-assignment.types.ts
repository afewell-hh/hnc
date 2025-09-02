/**
 * WP-PIN1 Port Assignment Types
 * Type definitions for manual port pinning and locking system
 */

export interface PortAssignment {
  portId: string
  assignedTo?: string           // Server ID or uplink target
  assignmentType: 'server' | 'uplink' | 'external' | 'unused'
  speed: string
  pinned: boolean              // User explicitly pinned this assignment
  locked: boolean              // Locked against auto-reassignment
  breakoutParent?: string      // If this is a breakout child port
  breakoutChildren?: string[]  // If this is broken out
  metadata?: {
    assignedBy?: 'auto' | 'manual'
    timestamp?: Date
    reason?: string
  }
}

export interface PortGroup {
  name: string
  portIds: string[]
  type: 'access' | 'uplink' | 'breakout'
  startIndex: number
  endIndex: number
}

export interface BreakoutGroup extends PortGroup {
  parentPort: string
  childPorts: string[]
  breakoutCapable: boolean
  currentConfig?: BreakoutConfig
}

export interface BreakoutConfig {
  parentSpeed: string
  childSpeed: string
  childCount: number
  enabled: boolean
}

export interface AssignableRange {
  startPort: string
  endPort: string
  type: 'server' | 'uplink' | 'external'
  maxAssignments: number
  currentAssignments: number
}

export interface PortMapLayout {
  accessPorts: PortGroup[]      // Grouped access ports
  uplinkPorts: PortGroup[]      // Uplink/spine ports  
  breakoutPorts: BreakoutGroup[] // Breakout-capable ports
  totalPorts: number
}

// Constraint validation types
export interface ConstraintViolation {
  type: 'physical' | 'logical' | 'breakout' | 'speed' | 'range'
  severity: 'error' | 'warning'
  message: string
  affectedPorts: string[]
  suggestion?: string
}

export interface ConstraintValidation {
  isValid: boolean
  violations: ConstraintViolation[]
  warnings: ConstraintViolation[]
}

// Pin/Lock operation results
export interface PinResult {
  success: boolean
  portId: string
  assignment?: PortAssignment
  conflicts?: ConstraintViolation[]
  suggestions?: AlternativeAssignment[]
}

export interface LockResult {
  success: boolean
  portId: string
  locked: boolean
  conflicts?: ConstraintViolation[]
}

export interface AlternativeAssignment {
  portId: string
  assignment: PortAssignment
  rationale: string
  confidence: number  // 0-1
}

// Diff view types
export interface AssignmentDiff {
  autoAssignments: Map<string, PortAssignment>     // What allocator would do
  manualOverrides: Map<string, PortAssignment>     // User pin/lock overrides
  conflicts: ConstraintViolation[]                 // Issues with overrides
  impactSummary: DiffSummary                       // Ports changed, freed, etc.
}

export interface DiffSummary {
  portsChanged: number
  portsFreed: number
  newConflicts: number
  efficiencyImpact: number  // % change in port utilization
  affectedServers: string[]
  affectedUplinks: string[]
}

// History and undo/redo types
export interface PortOperation {
  id: string
  type: 'pin' | 'unpin' | 'lock' | 'unlock' | 'assign' | 'unassign'
  portId: string
  before: PortAssignment
  after: PortAssignment
  timestamp: Date
  user?: string
  reason?: string
}

export interface PortHistory {
  operations: PortOperation[]
  currentIndex: number
  canUndo: boolean
  canRedo: boolean
}

// Switch model integration
export interface SwitchModelPorts {
  accessPorts: number        // Number of access ports (e.g., 48 for DS2000)
  uplinkPorts: number        // Number of uplink ports (e.g., 4 for DS2000)
  breakoutCapable: string[]  // Ports that support breakout
  speedCapabilities: Map<string, string[]> // Port to supported speeds
}

// Visual styling types
export const PORT_STYLES = {
  unused: 'bg-gray-100 border-gray-300',           
  assigned: 'bg-blue-100 border-blue-400',        
  pinned: 'bg-green-100 border-green-500 ring-2', 
  locked: 'bg-yellow-100 border-yellow-500',      
  conflict: 'bg-red-100 border-red-500',          
  breakout: 'bg-purple-100 border-purple-400'     
} as const

export type PortStyle = keyof typeof PORT_STYLES

// Integration with existing allocator
export interface PortPinOverrides {
  pinnedAssignments: Map<string, PortAssignment>
  lockedPorts: Set<string>
  constraints: ConstraintViolation[]
}