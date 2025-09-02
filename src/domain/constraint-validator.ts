/**
 * WP-PIN1 Constraint Validator
 * Comprehensive validation for port assignment constraints
 */

import type {
  PortAssignment,
  ConstraintViolation,
  ConstraintValidation,
  AssignableRange,
  BreakoutConfig
} from '../types/port-assignment.types'

export interface ConstraintContext {
  switchModel: string
  assignableRanges: AssignableRange[]
  breakoutConfigs: Map<string, BreakoutConfig>
  existingAssignments: PortAssignment[]
}

export class ConstraintValidator {
  constructor(private context: ConstraintContext) {}

  /**
   * Validate all constraints for a set of port assignments
   */
  validateAll(assignments: PortAssignment[]): ConstraintValidation {
    const violations: ConstraintViolation[] = []
    
    // Run all validation categories
    violations.push(...this.validatePhysicalConstraints(assignments))
    violations.push(...this.validateLogicalConstraints(assignments))
    violations.push(...this.validateBreakoutConstraints(assignments))
    violations.push(...this.validateSpeedConstraints(assignments))
    violations.push(...this.validateRangeConstraints(assignments))
    violations.push(...this.validateCapacityConstraints(assignments))
    
    const errors = violations.filter(v => v.severity === 'error')
    const warnings = violations.filter(v => v.severity === 'warning')
    
    return {
      isValid: errors.length === 0,
      violations: errors,
      warnings
    }
  }

  /**
   * Validate physical port constraints
   */
  private validatePhysicalConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const portMap = new Map(assignments.map(a => [a.portId, a]))
    
    // Check for duplicate port assignments
    const assignedPorts = new Set<string>()
    for (const assignment of assignments) {
      if (assignedPorts.has(assignment.portId)) {
        violations.push({
          type: 'physical',
          severity: 'error',
          message: `Port ${assignment.portId} assigned multiple times`,
          affectedPorts: [assignment.portId],
          suggestion: 'Each port can only have one assignment'
        })
      }
      assignedPorts.add(assignment.portId)
    }
    
    // Validate port numbers exist on switch model
    for (const assignment of assignments) {
      if (!this.isValidPortForModel(assignment.portId)) {
        violations.push({
          type: 'physical',
          severity: 'error',
          message: `Port ${assignment.portId} does not exist on ${this.context.switchModel}`,
          affectedPorts: [assignment.portId],
          suggestion: `${this.context.switchModel} has ports ${this.getValidPortRange()}`
        })
      }
    }
    
    return violations
  }

  /**
   * Validate logical constraints (MC-LAG, port pairing, etc.)
   */
  private validateLogicalConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    
    // MC-LAG validation
    const mclagServers = new Map<string, string[]>()
    
    for (const assignment of assignments) {
      if (assignment.assignmentType === 'server' && assignment.assignedTo?.includes('mclag')) {
        const serverId = assignment.assignedTo
        if (!mclagServers.has(serverId)) {
          mclagServers.set(serverId, [])
        }
        mclagServers.get(serverId)!.push(assignment.portId)
      }
    }
    
    // Check MC-LAG pairs
    for (const [serverId, ports] of mclagServers) {
      if (ports.length !== 2) {
        violations.push({
          type: 'logical',
          severity: 'error',
          message: `MC-LAG server ${serverId} requires exactly 2 ports, found ${ports.length}`,
          affectedPorts: ports,
          suggestion: 'MC-LAG requires a pair of ports for redundancy'
        })
        continue
      }
      
      // Check if MC-LAG ports are on different leaf switches (for multi-leaf scenario)
      const [port1, port2] = ports
      if (this.arePortsOnSameLeaf(port1, port2)) {
        violations.push({
          type: 'logical',
          severity: 'warning',
          message: `MC-LAG server ${serverId} ports ${port1}, ${port2} are on same leaf`,
          affectedPorts: ports,
          suggestion: 'MC-LAG works best with ports on different leaf switches'
        })
      }
    }
    
    // Link Aggregation Group (LAG) validation
    const lagGroups = new Map<string, PortAssignment[]>()
    for (const assignment of assignments) {
      if (assignment.assignedTo?.includes('lag-')) {
        const lagId = assignment.assignedTo
        if (!lagGroups.has(lagId)) {
          lagGroups.set(lagId, [])
        }
        lagGroups.get(lagId)!.push(assignment)
      }
    }
    
    for (const [lagId, members] of lagGroups) {
      // Check LAG member speeds match
      const speeds = new Set(members.map(m => m.speed))
      if (speeds.size > 1) {
        violations.push({
          type: 'logical',
          severity: 'error',
          message: `LAG ${lagId} has mismatched speeds: ${Array.from(speeds).join(', ')}`,
          affectedPorts: members.map(m => m.portId),
          suggestion: 'All LAG members must have the same speed'
        })
      }
      
      // Check reasonable LAG size (2-8 members typical)
      if (members.length < 2) {
        violations.push({
          type: 'logical',
          severity: 'warning',
          message: `LAG ${lagId} has only ${members.length} member (minimum 2 recommended)`,
          affectedPorts: members.map(m => m.portId),
          suggestion: 'LAGs typically require at least 2 members'
        })
      }
      
      if (members.length > 8) {
        violations.push({
          type: 'logical',
          severity: 'warning',
          message: `LAG ${lagId} has ${members.length} members (maximum 8 typical)`,
          affectedPorts: members.map(m => m.portId),
          suggestion: 'Large LAGs may have reduced effectiveness'
        })
      }
    }
    
    return violations
  }

  /**
   * Validate breakout port constraints
   */
  private validateBreakoutConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const portMap = new Map(assignments.map(a => [a.portId, a]))
    
    // Track breakout relationships
    const breakoutParents = new Set<string>()
    const breakoutChildren = new Set<string>()
    
    for (const assignment of assignments) {
      if (assignment.breakoutParent) {
        breakoutChildren.add(assignment.portId)
        breakoutParents.add(assignment.breakoutParent)
      }
      
      if (assignment.breakoutChildren) {
        breakoutParents.add(assignment.portId)
        assignment.breakoutChildren.forEach(child => breakoutChildren.add(child))
      }
    }
    
    // Validate breakout parent-child relationships
    for (const assignment of assignments) {
      if (assignment.breakoutChildren) {
        // Check all children exist and reference parent
        for (const childPort of assignment.breakoutChildren) {
          const childAssignment = portMap.get(childPort)
          
          if (!childAssignment) {
            violations.push({
              type: 'breakout',
              severity: 'error',
              message: `Breakout parent ${assignment.portId} references missing child ${childPort}`,
              affectedPorts: [assignment.portId, childPort],
              suggestion: `Create assignment for child port ${childPort}`
            })
          } else if (childAssignment.breakoutParent !== assignment.portId) {
            violations.push({
              type: 'breakout',
              severity: 'error',
              message: `Breakout child ${childPort} has incorrect parent reference`,
              affectedPorts: [assignment.portId, childPort],
              suggestion: `Set breakoutParent to ${assignment.portId} for port ${childPort}`
            })
          }
        }
        
        // Check breakout configuration is valid
        const config = this.context.breakoutConfigs.get(assignment.portId)
        if (config && assignment.breakoutChildren.length !== config.childCount) {
          violations.push({
            type: 'breakout',
            severity: 'error',
            message: `Breakout port ${assignment.portId} configured for ${config.childCount} children, found ${assignment.breakoutChildren.length}`,
            affectedPorts: [assignment.portId, ...assignment.breakoutChildren],
            suggestion: `Configure exactly ${config.childCount} child ports`
          })
        }
      }
      
      if (assignment.breakoutParent) {
        // Check parent exists and references this child
        const parentAssignment = portMap.get(assignment.breakoutParent)
        
        if (!parentAssignment) {
          violations.push({
            type: 'breakout',
            severity: 'error',
            message: `Breakout child ${assignment.portId} references missing parent ${assignment.breakoutParent}`,
            affectedPorts: [assignment.portId, assignment.breakoutParent],
            suggestion: `Create assignment for parent port ${assignment.breakoutParent}`
          })
        } else if (!parentAssignment.breakoutChildren?.includes(assignment.portId)) {
          violations.push({
            type: 'breakout',
            severity: 'error',
            message: `Breakout parent ${assignment.breakoutParent} does not reference child ${assignment.portId}`,
            affectedPorts: [assignment.portId, assignment.breakoutParent],
            suggestion: `Add ${assignment.portId} to breakoutChildren of ${assignment.breakoutParent}`
          })
        }
      }
    }
    
    // Check for orphaned breakout children (child without parent assignment)
    for (const assignment of assignments) {
      if (assignment.breakoutParent && !breakoutParents.has(assignment.breakoutParent)) {
        violations.push({
          type: 'breakout',
          severity: 'error',
          message: `Breakout child ${assignment.portId} has parent ${assignment.breakoutParent} that is not configured as breakout`,
          affectedPorts: [assignment.portId, assignment.breakoutParent],
          suggestion: `Configure ${assignment.breakoutParent} as breakout parent`
        })
      }
    }
    
    return violations
  }

  /**
   * Validate speed constraints
   */
  private validateSpeedConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    
    for (const assignment of assignments) {
      // Get supported speeds for this port
      const supportedSpeeds = this.getSupportedSpeedsForPort(assignment.portId)
      
      if (assignment.speed && !supportedSpeeds.includes(assignment.speed)) {
        violations.push({
          type: 'speed',
          severity: 'error',
          message: `Port ${assignment.portId} does not support speed ${assignment.speed}`,
          affectedPorts: [assignment.portId],
          suggestion: `Supported speeds: ${supportedSpeeds.join(', ')}`
        })
      }
      
      // Breakout speed validation
      if (assignment.breakoutChildren && assignment.breakoutChildren.length > 0) {
        const config = this.context.breakoutConfigs.get(assignment.portId)
        if (config) {
          if (assignment.speed !== config.parentSpeed) {
            violations.push({
              type: 'speed',
              severity: 'error',
              message: `Breakout parent ${assignment.portId} speed ${assignment.speed} doesn't match config ${config.parentSpeed}`,
              affectedPorts: [assignment.portId],
              suggestion: `Set speed to ${config.parentSpeed} for breakout configuration`
            })
          }
        }
      }
      
      if (assignment.breakoutParent) {
        const config = this.context.breakoutConfigs.get(assignment.breakoutParent)
        if (config && assignment.speed !== config.childSpeed) {
          violations.push({
            type: 'speed',
            severity: 'error',
            message: `Breakout child ${assignment.portId} speed ${assignment.speed} doesn't match config ${config.childSpeed}`,
            affectedPorts: [assignment.portId],
            suggestion: `Set speed to ${config.childSpeed} for breakout child`
          })
        }
      }
    }
    
    return violations
  }

  /**
   * Validate assignable range constraints
   */
  private validateRangeConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    
    // Track assignments per range
    const rangeUsage = new Map<AssignableRange, number>()
    
    for (const assignment of assignments) {
      if (assignment.assignmentType === 'unused') continue
      
      // Find applicable range
      const applicableRange = this.context.assignableRanges.find(range =>
        this.isPortInRange(assignment.portId, range) && 
        (range.type === assignment.assignmentType || range.type === 'external')
      )
      
      if (!applicableRange) {
        violations.push({
          type: 'range',
          severity: 'error',
          message: `Port ${assignment.portId} assignment type ${assignment.assignmentType} not allowed in any range`,
          affectedPorts: [assignment.portId],
          suggestion: 'Check assignable ranges for valid port assignment types'
        })
        continue
      }
      
      // Track usage
      const currentUsage = rangeUsage.get(applicableRange) || 0
      rangeUsage.set(applicableRange, currentUsage + 1)
      
      // Check capacity
      if (currentUsage >= applicableRange.maxAssignments) {
        violations.push({
          type: 'range',
          severity: 'error',
          message: `Range ${applicableRange.startPort}-${applicableRange.endPort} exceeded capacity ${applicableRange.maxAssignments}`,
          affectedPorts: [assignment.portId],
          suggestion: 'Use ports from a different range or increase range capacity'
        })
      }
    }
    
    return violations
  }

  /**
   * Validate capacity constraints
   */
  private validateCapacityConstraints(assignments: PortAssignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    
    // Count assignments by type
    const typeCounts = new Map<string, number>()
    for (const assignment of assignments) {
      if (assignment.assignmentType !== 'unused') {
        const current = typeCounts.get(assignment.assignmentType) || 0
        typeCounts.set(assignment.assignmentType, current + 1)
      }
    }
    
    // Check switch model capacity limits
    const limits = this.getSwitchCapacityLimits()
    
    for (const [type, count] of typeCounts) {
      const limit = limits.get(type)
      if (limit && count > limit) {
        violations.push({
          type: 'physical',
          severity: 'error',
          message: `Too many ${type} assignments (${count}), ${this.context.switchModel} limit is ${limit}`,
          affectedPorts: assignments.filter(a => a.assignmentType === type).map(a => a.portId),
          suggestion: `Reduce ${type} assignments to ${limit} or fewer`
        })
      }
    }
    
    return violations
  }

  // Helper methods

  private isValidPortForModel(portId: string): boolean {
    const portNum = parseInt(portId.split('-')[0] || portId) // Handle breakout ports
    
    switch (this.context.switchModel) {
      case 'DS2000':
        return portNum >= 1 && portNum <= 52 // 48 access + 4 uplink
      case 'DS3000':
        return portNum >= 1 && portNum <= 32 // 32 spine ports
      default:
        return true // Unknown model, allow all
    }
  }

  private getValidPortRange(): string {
    switch (this.context.switchModel) {
      case 'DS2000':
        return '1-52'
      case 'DS3000':
        return '1-32'
      default:
        return 'unknown'
    }
  }

  private getSupportedSpeedsForPort(portId: string): string[] {
    const portNum = parseInt(portId.split('-')[0] || portId)
    
    switch (this.context.switchModel) {
      case 'DS2000':
        if (portNum >= 1 && portNum <= 48) {
          return ['1G', '10G', '25G'] // Access ports
        }
        if (portNum >= 49 && portNum <= 52) {
          return ['40G', '100G'] // Uplink ports
        }
        return []
      case 'DS3000':
        return ['40G', '100G'] // All spine ports
      default:
        return ['1G', '10G', '25G', '40G', '100G'] // Unknown model, allow all
    }
  }

  private getSwitchCapacityLimits(): Map<string, number> {
    const limits = new Map<string, number>()
    
    switch (this.context.switchModel) {
      case 'DS2000':
        limits.set('server', 48) // Access ports for servers
        limits.set('uplink', 4)  // Uplink ports
        limits.set('external', 4) // External connections
        break
      case 'DS3000':
        limits.set('uplink', 32) // All ports can be uplinks
        limits.set('external', 8) // Some external connections
        break
    }
    
    return limits
  }

  private isPortInRange(portId: string, range: AssignableRange): boolean {
    const portNum = parseInt(portId.split('-')[0] || portId)
    const startNum = parseInt(range.startPort.split('-')[0] || range.startPort)
    const endNum = parseInt(range.endPort.split('-')[0] || range.endPort)
    
    return portNum >= startNum && portNum <= endNum
  }

  private arePortsOnSameLeaf(port1: string, port2: string): boolean {
    // Simplified: in single-leaf scenario, all ports are on same leaf
    // In multi-leaf, would need leaf topology information
    return true
  }
}