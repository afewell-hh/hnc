// Bulk Operations Utilities for WP-BULK1
// Core logic for pattern matching, diff generation, and capacity impact analysis

import { LeafClass, EndpointProfile, DerivedTopology, FabricSpec, FabricGuard } from '../app.types'
import { 
  RenamingPattern, 
  ChangeRecord, 
  BulkOperationDiff, 
  CapacitySnapshot,
  ClassReassignment,
  BulkOperationValidator,
  SelectionFilter
} from '../types/bulk-operations'
import { computeTopology } from '../topology.service'
// Use Web Crypto API for browser compatibility
const createHash = (algorithm: string) => ({
  update: (data: string) => ({
    digest: (encoding: string) => {
      // Simple hash function for deterministic diff IDs
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16)
    }
  })
})

/**
 * Applies renaming pattern to a string value
 */
export function applyRenamingPattern(
  value: string, 
  pattern: RenamingPattern
): string {
  switch (pattern.type) {
    case 'regex':
      const regex = new RegExp(pattern.pattern, 'g')
      return value.replace(regex, pattern.replacement)
    
    case 'template':
      // Simple template replacement: ${name} becomes the original name
      return pattern.replacement.replace(/\${name}/g, value)
    
    case 'prefix':
      return pattern.replacement + value
    
    case 'suffix':
      return value + pattern.replacement
    
    default:
      return value
  }
}

/**
 * Generates a deterministic diff for bulk operations
 */
export function generateBulkOperationDiff(
  originalSpec: FabricSpec,
  modifiedSpec: FabricSpec,
  operationId: string
): BulkOperationDiff {
  const changes: ChangeRecord[] = []
  
  // Compare leaf classes
  const originalClasses = originalSpec.leafClasses || []
  const modifiedClasses = modifiedSpec.leafClasses || []
  
  // Track renamed/modified classes
  for (const modifiedClass of modifiedClasses) {
    const originalClass = originalClasses.find(c => c.id === modifiedClass.id)
    
    if (!originalClass) {
      // New class added
      changes.push({
        id: `add-class-${modifiedClass.id}`,
        type: 'add',
        target: 'class',
        path: `leafClasses.${modifiedClass.id}`,
        before: null,
        after: modifiedClass,
        impact: 'high',
        warnings: [`New leaf class '${modifiedClass.name}' will be added`]
      })
    } else {
      // Check for modifications
      if (originalClass.name !== modifiedClass.name) {
        changes.push({
          id: `rename-class-${modifiedClass.id}`,
          type: 'rename',
          target: 'class',
          path: `leafClasses.${modifiedClass.id}.name`,
          before: originalClass.name,
          after: modifiedClass.name,
          impact: 'medium'
        })
      }
      
      // Check endpoint profile changes
      compareEndpointProfiles(originalClass, modifiedClass, changes)
    }
  }
  
  // Track removed classes
  for (const originalClass of originalClasses) {
    const modifiedClass = modifiedClasses.find(c => c.id === originalClass.id)
    if (!modifiedClass) {
      changes.push({
        id: `remove-class-${originalClass.id}`,
        type: 'remove',
        target: 'class', 
        path: `leafClasses.${originalClass.id}`,
        before: originalClass,
        after: null,
        impact: 'high',
        warnings: [`Leaf class '${originalClass.name}' will be removed`]
      })
    }
  }
  
  // Calculate capacity impact
  const beforeCapacity = calculateCapacitySnapshot(originalSpec)
  const afterCapacity = calculateCapacitySnapshot(modifiedSpec)
  
  // Compute validation
  const beforeTopology = computeTopology(originalSpec)
  const afterTopology = computeTopology(modifiedSpec)
  
  const validation = {
    isValid: afterTopology.isValid,
    errors: afterTopology.validationErrors,
    warnings: [],
    guards: afterTopology.guards || []
  }
  
  // Generate deterministic hash
  const hash = generateDiffHash(changes, beforeCapacity, afterCapacity)
  
  return {
    operationId,
    timestamp: new Date(),
    changes,
    summary: generateChangeSummary(changes),
    capacityImpact: {
      beforeCapacity,
      afterCapacity,
      changedClasses: getChangedClassIds(changes),
      warnings: generateCapacityWarnings(beforeCapacity, afterCapacity),
      errors: generateCapacityErrors(beforeCapacity, afterCapacity)
    },
    validation,
    hash
  }
}

/**
 * Compares endpoint profiles between classes and adds change records
 */
function compareEndpointProfiles(
  originalClass: LeafClass,
  modifiedClass: LeafClass,
  changes: ChangeRecord[]
): void {
  const originalProfiles = originalClass.endpointProfiles || []
  const modifiedProfiles = modifiedClass.endpointProfiles || []
  
  // Check for profile changes
  for (const modifiedProfile of modifiedProfiles) {
    const originalProfile = originalProfiles.find(p => p.name === modifiedProfile.name)
    
    if (!originalProfile) {
      changes.push({
        id: `add-profile-${originalClass.id}-${modifiedProfile.name}`,
        type: 'add',
        target: 'profile',
        path: `leafClasses.${originalClass.id}.endpointProfiles.${modifiedProfile.name}`,
        before: null,
        after: modifiedProfile,
        impact: 'medium'
      })
    } else if (!profilesEqual(originalProfile, modifiedProfile)) {
      changes.push({
        id: `modify-profile-${originalClass.id}-${modifiedProfile.name}`,
        type: 'modify',
        target: 'profile',
        path: `leafClasses.${originalClass.id}.endpointProfiles.${modifiedProfile.name}`,
        before: originalProfile,
        after: modifiedProfile,
        impact: 'medium'
      })
    }
  }
  
  // Check for removed profiles
  for (const originalProfile of originalProfiles) {
    const modifiedProfile = modifiedProfiles.find(p => p.name === originalProfile.name)
    if (!modifiedProfile) {
      changes.push({
        id: `remove-profile-${originalClass.id}-${originalProfile.name}`,
        type: 'remove',
        target: 'profile',
        path: `leafClasses.${originalClass.id}.endpointProfiles.${originalProfile.name}`,
        before: originalProfile,
        after: null,
        impact: 'high',
        warnings: [`Endpoint profile '${originalProfile.name}' will be removed from class '${originalClass.name}'`]
      })
    }
  }
}

/**
 * Checks if two endpoint profiles are equal
 */
function profilesEqual(a: EndpointProfile, b: EndpointProfile): boolean {
  return a.name === b.name &&
         a.portsPerEndpoint === b.portsPerEndpoint &&
         a.type === b.type &&
         a.count === b.count &&
         a.bandwidth === b.bandwidth &&
         a.redundancy === b.redundancy &&
         a.esLag === b.esLag &&
         a.nics === b.nics
}

/**
 * Calculates capacity snapshot for a fabric spec
 */
export function calculateCapacitySnapshot(spec: FabricSpec): CapacitySnapshot {
  const leafClasses = spec.leafClasses || []
  let totalEndpoints = 0
  let totalCapacity = 0
  const byClass: CapacitySnapshot['byClass'] = {}
  
  for (const leafClass of leafClasses) {
    const leafCount = leafClass.count || 1
    const endpointCount = leafClass.endpointProfiles.reduce((sum, profile) => 
      sum + (profile.count || 0), 0
    )
    
    // Calculate capacity (simplified - assume 48 ports per leaf minus uplinks)
    const uplinkPorts = leafClass.uplinksPerLeaf
    const capacityPerLeaf = 48 - uplinkPorts
    const classCapacity = leafCount * capacityPerLeaf
    
    totalEndpoints += endpointCount
    totalCapacity += classCapacity
    
    byClass[leafClass.id] = {
      leafCount,
      endpointCount,
      capacity: classCapacity,
      utilization: classCapacity > 0 ? (endpointCount / classCapacity) * 100 : 0
    }
  }
  
  const utilizationPercent = totalCapacity > 0 ? (totalEndpoints / totalCapacity) * 100 : 0
  
  return {
    totalEndpoints,
    totalCapacity,
    utilizationPercent,
    byClass,
    oversubscriptionRatio: totalCapacity > 0 ? totalEndpoints / totalCapacity : 0
  }
}

/**
 * Generates change summary statistics
 */
function generateChangeSummary(changes: ChangeRecord[]) {
  const summary = {
    totalChanges: changes.length,
    byType: {} as Record<ChangeRecord['type'], number>,
    byTarget: {} as Record<ChangeRecord['target'], number>,
    byImpact: {} as Record<ChangeRecord['impact'], number>
  }
  
  for (const change of changes) {
    summary.byType[change.type] = (summary.byType[change.type] || 0) + 1
    summary.byTarget[change.target] = (summary.byTarget[change.target] || 0) + 1
    summary.byImpact[change.impact] = (summary.byImpact[change.impact] || 0) + 1
  }
  
  return summary
}

/**
 * Gets list of changed class IDs from change records
 */
function getChangedClassIds(changes: ChangeRecord[]): string[] {
  const classIds = new Set<string>()
  
  for (const change of changes) {
    if (change.target === 'class' || change.path.startsWith('leafClasses.')) {
      const match = change.path.match(/leafClasses\.([^.]+)/)
      if (match) {
        classIds.add(match[1])
      }
    }
  }
  
  return Array.from(classIds)
}

/**
 * Generates capacity impact warnings
 */
function generateCapacityWarnings(before: CapacitySnapshot, after: CapacitySnapshot): string[] {
  const warnings: string[] = []
  
  // Check for significant utilization changes
  const utilizationChange = Math.abs(after.utilizationPercent - before.utilizationPercent)
  if (utilizationChange > 10) {
    warnings.push(`Utilization will change by ${utilizationChange.toFixed(1)}% (${before.utilizationPercent.toFixed(1)}% → ${after.utilizationPercent.toFixed(1)}%)`)
  }
  
  // Check for oversubscription changes
  if (after.oversubscriptionRatio > 2 && before.oversubscriptionRatio <= 2) {
    warnings.push('Operation will introduce oversubscription (ratio > 2:1)')
  }
  
  return warnings
}

/**
 * Generates capacity impact errors
 */
function generateCapacityErrors(before: CapacitySnapshot, after: CapacitySnapshot): string[] {
  const errors: string[] = []
  
  // Check for capacity violations
  if (after.utilizationPercent > 100) {
    errors.push(`Capacity exceeded: ${after.utilizationPercent.toFixed(1)}% utilization`)
  }
  
  // Check for extreme oversubscription
  if (after.oversubscriptionRatio > 8) {
    errors.push(`Extreme oversubscription: ${after.oversubscriptionRatio.toFixed(2)}:1 ratio`)
  }
  
  return errors
}

/**
 * Generates deterministic hash for diff comparison
 */
function generateDiffHash(
  changes: ChangeRecord[], 
  beforeCapacity: CapacitySnapshot, 
  afterCapacity: CapacitySnapshot
): string {
  const hashInput = {
    changes: changes.map(c => ({
      type: c.type,
      target: c.target,
      path: c.path,
      before: c.before,
      after: c.after
    })),
    capacityChange: {
      beforeUtil: beforeCapacity.utilizationPercent,
      afterUtil: afterCapacity.utilizationPercent,
      beforeRatio: beforeCapacity.oversubscriptionRatio,
      afterRatio: afterCapacity.oversubscriptionRatio
    }
  }
  
  return createHash('sha256')
    .update(JSON.stringify(hashInput, null, 0))
    .digest('hex')
    .substring(0, 16) // First 16 chars for readability
}

/**
 * Applies class reassignments to fabric spec
 */
export function applyClassReassignments(
  spec: FabricSpec, 
  reassignments: ClassReassignment[]
): FabricSpec {
  const modifiedSpec = JSON.parse(JSON.stringify(spec)) // deep clone
  
  for (const reassignment of reassignments) {
    const sourceClass = modifiedSpec.leafClasses?.find(c => c.id === reassignment.sourceClassId)
    const targetClass = modifiedSpec.leafClasses?.find(c => c.id === reassignment.targetClassId)
    
    if (!sourceClass || !targetClass) continue
    
    // Move specified endpoints between classes
    if (reassignment.moveEndpoints) {
      for (const move of reassignment.moveEndpoints) {
        const sourceProfile = sourceClass.endpointProfiles.find(p => p.name === move.profileName)
        if (sourceProfile && sourceProfile.count && sourceProfile.count >= move.count) {
          // Reduce count in source
          sourceProfile.count -= move.count
          
          // Add or increase count in target
          let targetProfile = targetClass.endpointProfiles.find(p => p.name === move.profileName)
          if (targetProfile) {
            targetProfile.count = (targetProfile.count || 0) + move.count
          } else {
            targetProfile = { ...sourceProfile, count: move.count }
            targetClass.endpointProfiles.push(targetProfile)
          }
          
          // Remove profile from source if count becomes 0
          if (sourceProfile.count === 0) {
            sourceClass.endpointProfiles = sourceClass.endpointProfiles.filter(p => p.name !== move.profileName)
          }
        }
      }
    }
  }
  
  return modifiedSpec
}

/**
 * Validates naming patterns for conflicts and syntax
 */
export const createBulkOperationValidator = (): BulkOperationValidator => ({
  validatePattern: (pattern: RenamingPattern) => {
    const errors: string[] = []
    
    if (pattern.type === 'regex') {
      try {
        new RegExp(pattern.pattern)
      } catch (e) {
        errors.push(`Invalid regex pattern: ${e.message}`)
      }
    }
    
    if (!pattern.replacement.trim()) {
      errors.push('Replacement value cannot be empty')
    }
    
    return { isValid: errors.length === 0, errors }
  },
  
  validateReassignment: (reassignment: ClassReassignment, leafClasses: LeafClass[]) => {
    const errors: string[] = []
    
    const sourceClass = leafClasses.find(c => c.id === reassignment.sourceClassId)
    const targetClass = leafClasses.find(c => c.id === reassignment.targetClassId)
    
    if (!sourceClass) {
      errors.push(`Source class '${reassignment.sourceClassId}' not found`)
    }
    if (!targetClass) {
      errors.push(`Target class '${reassignment.targetClassId}' not found`)
    }
    
    return { isValid: errors.length === 0, errors }
  },
  
  validateCapacityImpact: (before: CapacitySnapshot, after: CapacitySnapshot) => {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (after.utilizationPercent > 100) {
      errors.push('Operation would exceed total capacity')
    }
    
    if (after.utilizationPercent > 80 && before.utilizationPercent <= 80) {
      warnings.push('Operation will increase utilization above 80%')
    }
    
    return { isValid: errors.length === 0, errors, warnings }
  },
  
  validateNamingConflicts: (changes: ChangeRecord[]) => {
    const nameMap = new Map<string, string[]>()
    const conflicts: Array<{ path: string; conflictsWith: string[] }> = []
    
    // Collect all names after changes
    for (const change of changes) {
      if (change.type === 'rename' || change.type === 'add') {
        const newName = typeof change.after === 'string' ? change.after : change.after?.name
        if (newName) {
          if (!nameMap.has(newName)) {
            nameMap.set(newName, [])
          }
          nameMap.get(newName)!.push(change.path)
        }
      }
    }
    
    // Find conflicts
    for (const [name, paths] of nameMap) {
      if (paths.length > 1) {
        for (const path of paths) {
          conflicts.push({ path, conflictsWith: paths.filter(p => p !== path) })
        }
      }
    }
    
    return { hasConflicts: conflicts.length > 0, conflicts }
  }
})

/**
 * Filters leaf classes based on selection criteria
 */
export function filterLeafClasses(
  leafClasses: LeafClass[], 
  filter: SelectionFilter
): LeafClass[] {
  return leafClasses.filter(leafClass => {
    // Filter by class IDs
    if (filter.classIds && !filter.classIds.includes(leafClass.id)) {
      return false
    }
    
    // Filter by profile names
    if (filter.profileNames) {
      const hasMatchingProfile = leafClass.endpointProfiles.some(profile =>
        filter.profileNames!.includes(profile.name)
      )
      if (!hasMatchingProfile) return false
    }
    
    // Filter by name patterns
    if (filter.namePatterns) {
      const matchesPattern = filter.namePatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i')
        return regex.test(leafClass.name) || regex.test(leafClass.id)
      })
      if (!matchesPattern) return false
    }
    
    return true
  })
}