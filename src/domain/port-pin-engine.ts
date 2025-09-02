/**
 * WP-PIN1 Port Pin Engine
 * Core logic for manual port pinning and locking operations
 */

import type {
  PortAssignment,
  PortPinOverrides,
  PinResult,
  LockResult,
  ConstraintViolation,
  AlternativeAssignment,
  AssignmentDiff,
  DiffSummary
} from '../types/port-assignment.types'

export interface PinLockEngine {
  pinAssignment(portId: string, assignment: PortAssignment): PinResult
  lockPort(portId: string, locked: boolean): LockResult  
  validateConstraints(assignments: PortAssignment[]): ConstraintViolation[]
  generateDiff(autoAssignments: PortAssignment[], manualOverrides: PortAssignment[]): AssignmentDiff
  generateAlternatives(portId: string, failedAssignment: PortAssignment): AlternativeAssignment[]
}

export class DefaultPinLockEngine implements PinLockEngine {
  private currentAssignments: Map<string, PortAssignment> = new Map()
  private pinnedPorts: Set<string> = new Set()
  private lockedPorts: Set<string> = new Set()

  constructor(
    private switchModel: string = 'DS2000',
    private breakoutCapable: string[] = ['49', '50', '51', '52']
  ) {}

  /**
   * Pin a specific assignment to a port
   */
  pinAssignment(portId: string, assignment: PortAssignment): PinResult {
    // Validate the assignment against constraints
    const tempAssignments = Array.from(this.currentAssignments.values())
    tempAssignments.push(assignment)
    
    const violations = this.validateConstraints(tempAssignments)
    const relevantViolations = violations.filter(v => v.affectedPorts.includes(portId))
    
    if (relevantViolations.some(v => v.severity === 'error')) {
      const alternatives = this.generateAlternatives(portId, assignment)
      return {
        success: false,
        portId,
        conflicts: relevantViolations,
        suggestions: alternatives
      }
    }

    // Apply the pin
    const pinnedAssignment: PortAssignment = {
      ...assignment,
      pinned: true,
      metadata: {
        assignedBy: 'manual',
        timestamp: new Date(),
        reason: 'User pinned assignment'
      }
    }

    this.currentAssignments.set(portId, pinnedAssignment)
    this.pinnedPorts.add(portId)

    return {
      success: true,
      portId,
      assignment: pinnedAssignment,
      conflicts: relevantViolations.filter(v => v.severity === 'warning')
    }
  }

  /**
   * Lock/unlock a port against auto-reassignment
   */
  lockPort(portId: string, locked: boolean): LockResult {
    const currentAssignment = this.currentAssignments.get(portId)
    
    if (!currentAssignment && locked) {
      return {
        success: false,
        portId,
        locked: false,
        conflicts: [{
          type: 'logical',
          severity: 'error',
          message: 'Cannot lock unassigned port',
          affectedPorts: [portId],
          suggestion: 'Assign the port first, then lock it'
        }]
      }
    }

    if (locked) {
      this.lockedPorts.add(portId)
      if (currentAssignment) {
        const lockedAssignment: PortAssignment = {
          ...currentAssignment,
          locked: true,
          metadata: {
            ...currentAssignment.metadata,
            timestamp: new Date()
          }
        }
        this.currentAssignments.set(portId, lockedAssignment)
      }
    } else {
      this.lockedPorts.delete(portId)
      if (currentAssignment) {
        const unlockedAssignment: PortAssignment = {
          ...currentAssignment,
          locked: false,
          metadata: {
            ...currentAssignment.metadata,
            timestamp: new Date()
          }
        }
        this.currentAssignments.set(portId, unlockedAssignment)
      }
    }

    return {
      success: true,
      portId,
      locked
    }
  }

  /**
   * Validate all constraints against current assignments
   */
  validateConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const assignmentMap = new Map(assignments.map(a => [a.portId, a]))

    // Physical constraints - breakout validation
    violations.push(...this.validateBreakoutConstraints(assignmentMap))
    
    // Logical constraints - MC-LAG pairs, speed matching
    violations.push(...this.validateLogicalConstraints(assignmentMap))
    
    // Range constraints - port assignment ranges
    violations.push(...this.validateRangeConstraints(assignmentMap))
    
    // Speed constraints - NIC compatibility
    violations.push(...this.validateSpeedConstraints(assignmentMap))

    return violations
  }

  /**
   * Generate diff between auto allocation and manual overrides
   */
  generateDiff(autoAssignments: PortAssignment[], manualOverrides: PortAssignment[]): AssignmentDiff {
    const autoMap = new Map(autoAssignments.map(a => [a.portId, a]))
    const manualMap = new Map(manualOverrides.map(a => [a.portId, a]))
    
    const conflicts = this.validateConstraints(manualOverrides)
    
    let portsChanged = 0
    let portsFreed = 0
    let efficiencyImpact = 0
    const affectedServers: string[] = []
    const affectedUplinks: string[] = []

    // Count changes between auto and manual
    for (const [portId, autoAssignment] of autoMap) {
      const manualAssignment = manualMap.get(portId)
      
      if (!manualAssignment) {
        portsFreed++
        if (autoAssignment.assignedTo) {
          if (autoAssignment.assignmentType === 'server') {
            affectedServers.push(autoAssignment.assignedTo)
          } else if (autoAssignment.assignmentType === 'uplink') {
            affectedUplinks.push(autoAssignment.assignedTo)
          }
        }
      } else if (autoAssignment.assignedTo !== manualAssignment.assignedTo) {
        portsChanged++
        if (autoAssignment.assignedTo && autoAssignment.assignmentType === 'server') {
          affectedServers.push(autoAssignment.assignedTo)
        }
        if (manualAssignment.assignedTo && manualAssignment.assignmentType === 'server') {
          affectedServers.push(manualAssignment.assignedTo)
        }
      }
    }

    // Calculate efficiency impact (simplified)
    const autoUtilization = autoAssignments.filter(a => a.assignmentType !== 'unused').length
    const manualUtilization = manualOverrides.filter(a => a.assignmentType !== 'unused').length
    efficiencyImpact = autoUtilization > 0 ? 
      ((manualUtilization - autoUtilization) / autoUtilization) * 100 : 0

    const impactSummary: DiffSummary = {
      portsChanged,
      portsFreed,
      newConflicts: conflicts.filter(c => c.severity === 'error').length,
      efficiencyImpact,
      affectedServers: Array.from(new Set(affectedServers)),
      affectedUplinks: Array.from(new Set(affectedUplinks))
    }

    return {
      autoAssignments: autoMap,
      manualOverrides: manualMap,
      conflicts,
      impactSummary
    }
  }

  /**
   * Generate alternative assignments when a pin fails
   */
  generateAlternatives(portId: string, failedAssignment: PortAssignment): AlternativeAssignment[] {
    const alternatives: AlternativeAssignment[] = []
    
    // For server assignments, suggest nearby ports of same type
    if (failedAssignment.assignmentType === 'server') {
      const portNum = parseInt(portId)
      const nearbyPorts = [portNum - 1, portNum + 1, portNum - 2, portNum + 2]
        .filter(p => p >= 1 && p <= 48) // DS2000 access port range
        .map(p => p.toString())
        .filter(p => !this.currentAssignments.has(p))
      
      nearbyPorts.slice(0, 3).forEach((altPortId, index) => {
        alternatives.push({
          portId: altPortId,
          assignment: { ...failedAssignment, portId: altPortId },
          rationale: `Nearby available port ${altPortId}`,
          confidence: 0.9 - (index * 0.1)
        })
      })
    }

    // For breakout conflicts, suggest proper breakout configuration
    if (failedAssignment.assignmentType === 'uplink' && this.breakoutCapable.includes(portId)) {
      const breakoutConfig: PortAssignment = {
        ...failedAssignment,
        breakoutChildren: [`${portId}-1`, `${portId}-2`, `${portId}-3`, `${portId}-4`]
      }
      
      alternatives.push({
        portId,
        assignment: breakoutConfig,
        rationale: 'Configure as breakout port with 4x25G children',
        confidence: 0.85
      })
    }

    return alternatives.slice(0, 5) // Return top 5 alternatives
  }

  /**
   * Get current pin/lock overrides for integration with allocator
   */
  getOverrides(): PortPinOverrides {
    const pinnedAssignments = new Map<string, PortAssignment>()
    
    for (const [portId, assignment] of this.currentAssignments) {
      if (assignment.pinned) {
        pinnedAssignments.set(portId, assignment)
      }
    }

    return {
      pinnedAssignments,
      lockedPorts: new Set(this.lockedPorts),
      constraints: this.validateConstraints(Array.from(this.currentAssignments.values()))
    }
  }

  // Private constraint validation methods

  private validateBreakoutConstraints(assignments: Map<string, PortAssignment>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    for (const [portId, assignment] of assignments) {
      // Check if breakout child ports are assigned independently
      if (assignment.breakoutParent && !assignments.has(assignment.breakoutParent)) {
        violations.push({
          type: 'breakout',
          severity: 'error',
          message: `Breakout child port ${portId} cannot be assigned without parent ${assignment.breakoutParent}`,
          affectedPorts: [portId, assignment.breakoutParent],
          suggestion: `Assign parent port ${assignment.breakoutParent} first`
        })
      }

      // Check if breakout parent has all children assigned consistently
      if (assignment.breakoutChildren) {
        for (const childPort of assignment.breakoutChildren) {
          const childAssignment = assignments.get(childPort)
          if (!childAssignment || childAssignment.breakoutParent !== portId) {
            violations.push({
              type: 'breakout',
              severity: 'error',
              message: `Breakout parent ${portId} missing or inconsistent child assignment ${childPort}`,
              affectedPorts: [portId, childPort],
              suggestion: 'Ensure all breakout children are properly configured'
            })
          }
        }
      }
    }

    return violations
  }

  private validateLogicalConstraints(assignments: Map<string, PortAssignment>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    // MC-LAG pair validation (simplified - check adjacent server assignments)
    for (const [portId, assignment] of assignments) {
      if (assignment.assignmentType === 'server' && assignment.assignedTo?.includes('mclag')) {
        const portNum = parseInt(portId)
        const pairPort = (portNum % 2 === 1) ? (portNum + 1).toString() : (portNum - 1).toString()
        const pairAssignment = assignments.get(pairPort)
        
        if (!pairAssignment || pairAssignment.assignedTo !== assignment.assignedTo) {
          violations.push({
            type: 'logical',
            severity: 'error',
            message: `MC-LAG server ${assignment.assignedTo} requires both ports ${portId} and ${pairPort}`,
            affectedPorts: [portId, pairPort],
            suggestion: `Assign both ports to ${assignment.assignedTo}`
          })
        }
      }
    }

    return violations
  }

  private validateRangeConstraints(assignments: Map<string, PortAssignment>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    // DS2000 port range validation
    const accessPortRange = { start: 1, end: 48 }
    const uplinkPortRange = { start: 49, end: 52 }

    for (const [portId, assignment] of assignments) {
      const portNum = parseInt(portId)
      
      if (assignment.assignmentType === 'server' && 
          (portNum < accessPortRange.start || portNum > accessPortRange.end)) {
        violations.push({
          type: 'range',
          severity: 'error',
          message: `Server assignment on port ${portId} outside access port range (${accessPortRange.start}-${accessPortRange.end})`,
          affectedPorts: [portId],
          suggestion: `Use access ports ${accessPortRange.start}-${accessPortRange.end} for server connections`
        })
      }
      
      if (assignment.assignmentType === 'uplink' && 
          (portNum < uplinkPortRange.start || portNum > uplinkPortRange.end)) {
        violations.push({
          type: 'range',
          severity: 'warning',
          message: `Uplink assignment on port ${portId} outside typical uplink range (${uplinkPortRange.start}-${uplinkPortRange.end})`,
          affectedPorts: [portId],
          suggestion: `Consider using uplink ports ${uplinkPortRange.start}-${uplinkPortRange.end}`
        })
      }
    }

    return violations
  }

  private validateSpeedConstraints(assignments: Map<string, PortAssignment>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    // Speed compatibility validation (DS2000 supports 25G access, 100G uplink)
    for (const [portId, assignment] of assignments) {
      const portNum = parseInt(portId)
      
      if (portNum >= 1 && portNum <= 48 && assignment.speed && assignment.speed !== '25G') {
        violations.push({
          type: 'speed',
          severity: 'warning',
          message: `Access port ${portId} configured for ${assignment.speed}, DS2000 optimized for 25G`,
          affectedPorts: [portId],
          suggestion: 'Consider using 25G for access ports or verify transceiver compatibility'
        })
      }
      
      if (portNum >= 49 && portNum <= 52 && assignment.speed && assignment.speed !== '100G') {
        violations.push({
          type: 'speed',
          severity: 'warning',
          message: `Uplink port ${portId} configured for ${assignment.speed}, DS2000 optimized for 100G`,
          affectedPorts: [portId],
          suggestion: 'Consider using 100G for uplink ports or configure breakout for lower speeds'
        })
      }
    }

    return violations
  }
}