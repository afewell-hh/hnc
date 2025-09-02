/**
 * Provenance Utilities - WP-VPC1
 * Helper functions for tracking field provenance across VPC components
 */

import type { FieldProvenance } from '../types/leaf-class-builder.types'

/**
 * Create field provenance with timestamp
 */
export function createFieldProvenance(
  source: 'user' | 'auto' | 'import' | 'derived',
  context?: string
): FieldProvenance {
  return {
    source,
    timestamp: new Date().toISOString(),
    context: context || 'field-update'
  }
}

/**
 * Update provenance for nested field changes
 */
export function updateFieldProvenance(
  existing: FieldProvenance,
  newSource: 'user' | 'auto' | 'import' | 'derived',
  context?: string
): FieldProvenance {
  return {
    ...existing,
    source: newSource,
    timestamp: new Date().toISOString(),
    context: context || existing.context,
    previousSource: existing.source
  }
}

/**
 * Merge provenance when combining configurations
 */
export function mergeProvenance(
  base: FieldProvenance,
  incoming: FieldProvenance
): FieldProvenance {
  return {
    source: incoming.source,
    timestamp: incoming.timestamp,
    context: `merged: ${base.context} + ${incoming.context}`,
    previousSource: base.source
  }
}

/**
 * Check if field was modified by user
 */
export function isUserModified(provenance: FieldProvenance): boolean {
  return provenance.source === 'user'
}

/**
 * Check if field was imported
 */
export function isImported(provenance: FieldProvenance): boolean {
  return provenance.source === 'import'
}

/**
 * Get human-readable provenance description
 */
export function getProvenanceDescription(provenance: FieldProvenance): string {
  switch (provenance.source) {
    case 'user':
      return 'Modified by user'
    case 'auto':
      return 'Auto-generated'
    case 'import':
      return `Imported from ${provenance.context || 'external source'}`
    case 'derived':
      return 'Calculated from other values'
    default:
      return 'Unknown source'
  }
}