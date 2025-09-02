/**
 * WP-PIN1 Assignment Diff Engine
 * Computes differences between automatic and manual port assignments
 */

import type {
  PortAssignment,
  AssignmentDiff,
  DiffSummary,
  ConstraintViolation
} from '../types/port-assignment.types'

export interface DiffAnalyzer {
  computeDiff(autoAssignments: PortAssignment[], manualAssignments: PortAssignment[]): AssignmentDiff
  analyzeSummary(autoAssignments: PortAssignment[], manualAssignments: PortAssignment[]): DiffSummary
  findConflicts(manualAssignments: PortAssignment[]): ConstraintViolation[]
}

export class DefaultDiffAnalyzer implements DiffAnalyzer {
  
  /**
   * Compute comprehensive diff between auto and manual assignments
   */
  computeDiff(autoAssignments: PortAssignment[], manualAssignments: PortAssignment[]): AssignmentDiff {
    const autoMap = new Map(autoAssignments.map(a => [a.portId, a]))
    const manualMap = new Map(manualAssignments.map(a => [a.portId, a]))
    
    const conflicts = this.findConflicts(manualAssignments)
    const impactSummary = this.analyzeSummary(autoAssignments, manualAssignments)
    
    return {
      autoAssignments: autoMap,
      manualOverrides: manualMap,
      conflicts,
      impactSummary
    }
  }

  /**
   * Analyze impact summary between assignments
   */
  analyzeSummary(autoAssignments: PortAssignment[], manualAssignments: PortAssignment[]): DiffSummary {
    const autoMap = new Map(autoAssignments.map(a => [a.portId, a]))
    const manualMap = new Map(manualAssignments.map(a => [a.portId, a]))
    
    let portsChanged = 0
    let portsFreed = 0
    const affectedServers = new Set<string>()
    const affectedUplinks = new Set<string>()
    
    // Analyze changes from auto to manual
    for (const [portId, autoAssignment] of autoMap) {
      const manualAssignment = manualMap.get(portId)
      
      if (!manualAssignment || manualAssignment.assignmentType === 'unused') {
        // Port was freed in manual assignment
        portsFreed++
        if (autoAssignment.assignedTo) {
          if (autoAssignment.assignmentType === 'server') {
            affectedServers.add(autoAssignment.assignedTo)
          } else if (autoAssignment.assignmentType === 'uplink') {
            affectedUplinks.add(autoAssignment.assignedTo)
          }
        }
      } else if (this.isAssignmentDifferent(autoAssignment, manualAssignment)) {
        // Port assignment changed
        portsChanged++
        
        // Track affected entities
        if (autoAssignment.assignedTo && autoAssignment.assignmentType === 'server') {
          affectedServers.add(autoAssignment.assignedTo)
        }
        if (manualAssignment.assignedTo && manualAssignment.assignmentType === 'server') {
          affectedServers.add(manualAssignment.assignedTo)
        }
        if (autoAssignment.assignedTo && autoAssignment.assignmentType === 'uplink') {
          affectedUplinks.add(autoAssignment.assignedTo)
        }
        if (manualAssignment.assignedTo && manualAssignment.assignmentType === 'uplink') {
          affectedUplinks.add(manualAssignment.assignedTo)
        }
      }
    }
    
    // Check for new assignments in manual that weren't in auto
    for (const [portId, manualAssignment] of manualMap) {
      if (!autoMap.has(portId) && manualAssignment.assignmentType !== 'unused') {
        portsChanged++
        if (manualAssignment.assignedTo) {
          if (manualAssignment.assignmentType === 'server') {
            affectedServers.add(manualAssignment.assignedTo)
          } else if (manualAssignment.assignmentType === 'uplink') {
            affectedUplinks.add(manualAssignment.assignedTo)
          }
        }
      }
    }
    
    // Calculate efficiency impact
    const autoUtilization = this.calculateUtilization(autoAssignments)
    const manualUtilization = this.calculateUtilization(manualAssignments)
    const efficiencyImpact = autoUtilization > 0 ? 
      ((manualUtilization - autoUtilization) / autoUtilization) * 100 : 0
    
    // Count new conflicts
    const newConflicts = this.findConflicts(manualAssignments)
      .filter(c => c.severity === 'error').length
    
    return {
      portsChanged,
      portsFreed,
      newConflicts,
      efficiencyImpact,
      affectedServers: Array.from(affectedServers),
      affectedUplinks: Array.from(affectedUplinks)
    }
  }

  /**
   * Find constraint violations in manual assignments
   */
  findConflicts(manualAssignments: PortAssignment[]): ConstraintViolation[] {
    const conflicts: ConstraintViolation[] = []
    const portMap = new Map(manualAssignments.map(a => [a.portId, a]))
    
    // Check for duplicate assignments
    const assignedTargets = new Map<string, string[]>()
    for (const assignment of manualAssignments) {
      if (assignment.assignedTo && assignment.assignmentType !== 'unused') {
        const key = `${assignment.assignmentType}:${assignment.assignedTo}`
        if (!assignedTargets.has(key)) {
          assignedTargets.set(key, [])
        }
        assignedTargets.get(key)!.push(assignment.portId)
      }
    }
    
    // Flag unusual duplicate assignments (except MC-LAG which is expected)
    for (const [key, ports] of assignedTargets) {
      const [type, target] = key.split(':')
      if (ports.length > 1 && !target.includes('mclag') && !target.includes('lag')) {
        conflicts.push({
          type: 'logical',
          severity: 'warning',
          message: `${target} assigned to multiple ports: ${ports.join(', ')}`,
          affectedPorts: ports,
          suggestion: 'Verify if multiple port assignment is intentional'
        })
      }
    }
    
    // Check breakout consistency
    conflicts.push(...this.validateBreakoutConsistency(manualAssignments))
    
    // Check port range violations
    conflicts.push(...this.validatePortRanges(manualAssignments))
    
    // Check speed mismatches
    conflicts.push(...this.validateSpeedConsistency(manualAssignments))
    
    return conflicts
  }

  /**
   * Check if two assignments are meaningfully different
   */
  private isAssignmentDifferent(auto: PortAssignment, manual: PortAssignment): boolean {
    return (
      auto.assignedTo !== manual.assignedTo ||
      auto.assignmentType !== manual.assignmentType ||
      auto.speed !== manual.speed
    )
  }

  /**
   * Calculate port utilization percentage
   */
  private calculateUtilization(assignments: PortAssignment[]): number {
    const totalPorts = assignments.length
    const usedPorts = assignments.filter(a => a.assignmentType !== 'unused').length
    
    return totalPorts > 0 ? (usedPorts / totalPorts) * 100 : 0
  }

  /**
   * Validate breakout port consistency
   */
  private validateBreakoutConsistency(assignments: PortAssignment[]): ConstraintViolation[] {
    const conflicts: ConstraintViolation[] = []
    const portMap = new Map(assignments.map(a => [a.portId, a]))
    
    for (const assignment of assignments) {
      // Check breakout parent has all children
      if (assignment.breakoutChildren) {
        for (const childPort of assignment.breakoutChildren) {
          const childAssignment = portMap.get(childPort)
          if (!childAssignment) {
            conflicts.push({
              type: 'breakout',
              severity: 'error',
              message: `Breakout parent ${assignment.portId} missing child ${childPort}`,
              affectedPorts: [assignment.portId, childPort],
              suggestion: `Add assignment for child port ${childPort}`
            })
          } else if (childAssignment.breakoutParent !== assignment.portId) {
            conflicts.push({
              type: 'breakout',
              severity: 'error',
              message: `Breakout child ${childPort} has wrong parent reference`,
              affectedPorts: [assignment.portId, childPort],
              suggestion: `Set breakoutParent to ${assignment.portId} for ${childPort}`
            })
          }
        }
      }
      
      // Check breakout child has valid parent
      if (assignment.breakoutParent) {
        const parentAssignment = portMap.get(assignment.breakoutParent)
        if (!parentAssignment) {
          conflicts.push({
            type: 'breakout',
            severity: 'error',
            message: `Breakout child ${assignment.portId} missing parent ${assignment.breakoutParent}`,
            affectedPorts: [assignment.portId, assignment.breakoutParent],
            suggestion: `Add assignment for parent port ${assignment.breakoutParent}`
          })
        } else if (!parentAssignment.breakoutChildren?.includes(assignment.portId)) {
          conflicts.push({
            type: 'breakout',
            severity: 'error',
            message: `Breakout parent ${assignment.breakoutParent} doesn't reference child ${assignment.portId}`,
            affectedPorts: [assignment.portId, assignment.breakoutParent],
            suggestion: `Add ${assignment.portId} to breakoutChildren of ${assignment.breakoutParent}`
          })
        }
      }
    }
    
    return conflicts
  }

  /**
   * Validate assignments are within appropriate port ranges
   */
  private validatePortRanges(assignments: PortAssignment[]): ConstraintViolation[] {
    const conflicts: ConstraintViolation[] = []
    
    // DS2000 port range assumptions
    const accessRange = { start: 1, end: 48 }
    const uplinkRange = { start: 49, end: 52 }
    
    for (const assignment of assignments) {
      const portNum = parseInt(assignment.portId.split('-')[0] || assignment.portId)
      
      // Check server assignments in access range
      if (assignment.assignmentType === 'server') {
        if (portNum < accessRange.start || portNum > accessRange.end) {
          conflicts.push({
            type: 'range',
            severity: 'error',
            message: `Server on port ${assignment.portId} outside access range (${accessRange.start}-${accessRange.end})`,
            affectedPorts: [assignment.portId],
            suggestion: `Move server to access ports ${accessRange.start}-${accessRange.end}`
          })
        }
      }
      
      // Warn about uplinks outside typical range
      if (assignment.assignmentType === 'uplink') {
        if (portNum >= accessRange.start && portNum <= accessRange.end) {
          conflicts.push({
            type: 'range',
            severity: 'warning',
            message: `Uplink on access port ${assignment.portId} (typical uplink range ${uplinkRange.start}-${uplinkRange.end})`,
            affectedPorts: [assignment.portId],
            suggestion: `Consider using uplink ports ${uplinkRange.start}-${uplinkRange.end} for better performance`
          })
        }
      }
    }
    
    return conflicts
  }

  /**
   * Validate speed consistency across related assignments
   */
  private validateSpeedConsistency(assignments: PortAssignment[]): ConstraintViolation[] {
    const conflicts: ConstraintViolation[] = []
    
    // Group by assigned target to check speed consistency
    const targetGroups = new Map<string, PortAssignment[]>()
    
    for (const assignment of assignments) {
      if (assignment.assignedTo && assignment.assignmentType !== 'unused') {
        const key = assignment.assignedTo
        if (!targetGroups.has(key)) {
          targetGroups.set(key, [])
        }
        targetGroups.get(key)!.push(assignment)
      }
    }
    
    // Check speed consistency within groups
    for (const [target, assignments] of targetGroups) {
      if (assignments.length <= 1) continue
      
      const speeds = new Set(assignments.map(a => a.speed).filter(s => s))
      if (speeds.size > 1) {
        const affectedPorts = assignments.map(a => a.portId)
        
        // This is an error for LAG groups, warning for others
        const isLag = target.includes('lag') || target.includes('mclag')
        const severity = isLag ? 'error' : 'warning'
        
        conflicts.push({
          type: 'speed',
          severity,
          message: `${target} has inconsistent speeds: ${Array.from(speeds).join(', ')}`,
          affectedPorts,
          suggestion: isLag ? 'LAG members must have matching speeds' : 'Consider using consistent speeds for better performance'
        })
      }
    }
    
    // Check breakout speed relationships
    for (const assignment of assignments) {
      if (assignment.breakoutChildren) {
        for (const childPort of assignment.breakoutChildren) {
          const childAssignment = assignments.find(a => a.portId === childPort)
          if (childAssignment && childAssignment.speed) {
            // Validate breakout speed relationship (e.g., 100G -> 4x25G)
            const isValidBreakout = this.isValidBreakoutSpeed(assignment.speed, childAssignment.speed)
            if (!isValidBreakout) {
              conflicts.push({
                type: 'speed',
                severity: 'error',
                message: `Invalid breakout: ${assignment.portId}@${assignment.speed} -> ${childPort}@${childAssignment.speed}`,
                affectedPorts: [assignment.portId, childPort],
                suggestion: 'Verify breakout speed configuration (e.g., 100G -> 25G)'
              })
            }
          }
        }
      }
    }
    
    return conflicts
  }

  /**
   * Check if breakout speed relationship is valid
   */
  private isValidBreakoutSpeed(parentSpeed: string, childSpeed: string): boolean {
    // Common breakout patterns
    const validBreakouts = new Map([
      ['100G', ['25G', '10G']],
      ['40G', ['10G']],
      ['50G', ['25G', '10G']]
    ])
    
    const validChildSpeeds = validBreakouts.get(parentSpeed)
    return validChildSpeeds ? validChildSpeeds.includes(childSpeed) : false
  }
}