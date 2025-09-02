/**
 * ONF External Compiler - WP-EXT1
 * Compile external links to ONF-compliant VPC external specifications
 */

import type { ExternalLink } from '../domain/external-link'
import { calculateTotalBandwidth } from '../domain/external-link'

export interface ONFExternalSpec {
  // ONF VPC External structure
  external?: ONFExternalLink[]
  staticExternal?: ONFStaticExternalLink[]
}

export interface ONFExternalLink {
  name: string
  links: ONFLinkSpec[]
}

export interface ONFStaticExternalLink {
  name: string
  links: ONFLinkSpec[]
}

export interface ONFLinkSpec {
  speed: '10G' | '25G' | '100G' | '400G'
  count: number
}

export interface ONFCompilationOptions {
  includeDisabled?: boolean
  validateCompliance?: boolean
  stripInternalFields?: boolean
  generateK8sMetadata?: boolean
}

export interface ONFCompilationResult {
  spec: ONFExternalSpec
  warnings: string[]
  errors: string[]
  metadata: {
    totalExternalBandwidth: number
    totalStaticBandwidth: number
    totalLinks: number
    compiledAt: string
  }
}

/**
 * Compile external links to ONF VPC external specification
 */
export function compileExternalLinksToONF(
  externalLinks: ExternalLink[],
  options: ONFCompilationOptions = {}
): ONFCompilationResult {
  const opts: Required<ONFCompilationOptions> = {
    includeDisabled: false,
    validateCompliance: true,
    stripInternalFields: true,
    generateK8sMetadata: false,
    ...options
  }

  const result: ONFCompilationResult = {
    spec: {
      external: [],
      staticExternal: []
    },
    warnings: [],
    errors: [],
    metadata: {
      totalExternalBandwidth: 0,
      totalStaticBandwidth: 0,
      totalLinks: 0,
      compiledAt: new Date().toISOString()
    }
  }

  try {
    // Filter enabled links (unless includeDisabled is true)
    const linksToCompile = externalLinks.filter(link => 
      opts.includeDisabled || link.enabled !== false
    )

    // Group links by category
    const externalLinksGroup = linksToCompile.filter(link => 
      link.category === 'vpc.external'
    )
    const staticExternalLinksGroup = linksToCompile.filter(link => 
      link.category === 'vpc.staticExternal'
    )

    // Compile external links
    if (externalLinksGroup.length > 0) {
      const { compiled, warnings, errors } = compileExternalLinkGroup(externalLinksGroup, opts)
      result.spec.external = compiled
      result.warnings.push(...warnings)
      result.errors.push(...errors)
      
      // Calculate bandwidth for metadata
      result.metadata.totalExternalBandwidth = compiled.reduce((total, link) => {
        const linkBandwidth = link.links.reduce((sum, spec) => 
          sum + (parseSpeed(spec.speed) * spec.count), 0
        )
        return total + linkBandwidth
      }, 0)
    }

    // Compile static external links
    if (staticExternalLinksGroup.length > 0) {
      const { compiled, warnings, errors } = compileStaticExternalLinkGroup(staticExternalLinksGroup, opts)
      result.spec.staticExternal = compiled
      result.warnings.push(...warnings)
      result.errors.push(...errors)
      
      // Calculate bandwidth for metadata
      result.metadata.totalStaticBandwidth = compiled.reduce((total, link) => {
        const linkBandwidth = link.links.reduce((sum, spec) => 
          sum + (parseSpeed(spec.speed) * spec.count), 0
        )
        return total + linkBandwidth
      }, 0)
    }

    // Update total links count
    result.metadata.totalLinks = externalLinksGroup.length + staticExternalLinksGroup.length

    // Validate ONF compliance if requested
    if (opts.validateCompliance) {
      const complianceResult = validateONFCompliance(result.spec)
      result.warnings.push(...complianceResult.warnings)
      result.errors.push(...complianceResult.errors)
    }

  } catch (error) {
    result.errors.push(`Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

/**
 * Compile external link group (vpc.external category)
 */
function compileExternalLinkGroup(
  links: ExternalLink[],
  options: Required<ONFCompilationOptions>
): { compiled: ONFExternalLink[]; warnings: string[]; errors: string[] } {
  const compiled: ONFExternalLink[] = []
  const warnings: string[] = []
  const errors: string[] = []

  for (const link of links) {
    try {
      const onf = compileExternalLinkToONF(link, options)
      if (onf) {
        compiled.push(onf)
      } else {
        warnings.push(`Skipping external link "${link.name}": no valid configuration`)
      }
    } catch (error) {
      errors.push(`Failed to compile external link "${link.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { compiled, warnings, errors }
}

/**
 * Compile static external link group (vpc.staticExternal category)
 */
function compileStaticExternalLinkGroup(
  links: ExternalLink[],
  options: Required<ONFCompilationOptions>
): { compiled: ONFStaticExternalLink[]; warnings: string[]; errors: string[] } {
  const compiled: ONFStaticExternalLink[] = []
  const warnings: string[] = []
  const errors: string[] = []

  for (const link of links) {
    try {
      const onf = compileStaticExternalLinkToONF(link, options)
      if (onf) {
        compiled.push(onf)
      } else {
        warnings.push(`Skipping static external link "${link.name}": no valid configuration`)
      }
    } catch (error) {
      errors.push(`Failed to compile static external link "${link.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { compiled, warnings, errors }
}

/**
 * Compile single external link to ONF format
 */
function compileExternalLinkToONF(
  link: ExternalLink,
  options: Required<ONFCompilationOptions>
): ONFExternalLink | null {
  const linkSpecs = extractLinkSpecs(link)
  
  if (linkSpecs.length === 0) {
    return null
  }

  // Create ONF-compliant external link
  const onfLink: ONFExternalLink = {
    name: sanitizeONFName(link.name),
    links: linkSpecs
  }

  return onfLink
}

/**
 * Compile single static external link to ONF format
 */
function compileStaticExternalLinkToONF(
  link: ExternalLink,
  options: Required<ONFCompilationOptions>
): ONFStaticExternalLink | null {
  const linkSpecs = extractLinkSpecs(link)
  
  if (linkSpecs.length === 0) {
    return null
  }

  // Create ONF-compliant static external link
  const onfLink: ONFStaticExternalLink = {
    name: sanitizeONFName(link.name),
    links: linkSpecs
  }

  return onfLink
}

/**
 * Extract link specifications from external link configuration
 */
function extractLinkSpecs(link: ExternalLink): ONFLinkSpec[] {
  const specs: ONFLinkSpec[] = []

  if (link.mode === 'explicit-ports' && link.explicitPorts) {
    // Direct mapping from explicit ports
    for (const port of link.explicitPorts) {
      if (port.count > 0) {
        specs.push({
          speed: port.speed,
          count: port.count
        })
      }
    }
  } else if (link.mode === 'target-bandwidth' && link.targetGbps) {
    // Convert target bandwidth to explicit ports
    const preferredSpeed = link.preferredSpeed || '100G'
    const speedValue = parseSpeed(preferredSpeed)
    const portsNeeded = Math.ceil(link.targetGbps / speedValue)
    
    if (portsNeeded > 0) {
      specs.push({
        speed: preferredSpeed,
        count: portsNeeded
      })
    }
  }

  return specs
}

/**
 * Sanitize name for ONF compliance
 */
function sanitizeONFName(name: string): string {
  // ONF names should be kebab-case and DNS-safe
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63) // DNS label limit
}

/**
 * Parse speed string to numeric value
 */
function parseSpeed(speed: string): number {
  return parseInt(speed.replace('G', ''))
}

/**
 * Validate ONF compliance
 */
function validateONFCompliance(spec: ONFExternalSpec): { warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  // Validate external links
  if (spec.external) {
    for (const link of spec.external) {
      const linkValidation = validateONFLink(link, 'external')
      warnings.push(...linkValidation.warnings)
      errors.push(...linkValidation.errors)
    }
  }

  // Validate static external links
  if (spec.staticExternal) {
    for (const link of spec.staticExternal) {
      const linkValidation = validateONFLink(link, 'staticExternal')
      warnings.push(...linkValidation.warnings)
      errors.push(...linkValidation.errors)
    }
  }

  // Check for duplicate names across categories
  const allNames = [
    ...(spec.external || []).map(link => link.name),
    ...(spec.staticExternal || []).map(link => link.name)
  ]
  const duplicateNames = allNames.filter((name, index) => allNames.indexOf(name) !== index)
  if (duplicateNames.length > 0) {
    errors.push(`Duplicate external link names: ${[...new Set(duplicateNames)].join(', ')}`)
  }

  return { warnings, errors }
}

/**
 * Validate individual ONF link
 */
function validateONFLink(
  link: ONFExternalLink | ONFStaticExternalLink,
  category: 'external' | 'staticExternal'
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  // Validate name
  if (!link.name) {
    errors.push(`${category} link missing name`)
  } else if (!/^[a-z0-9-]+$/.test(link.name)) {
    errors.push(`${category} link "${link.name}" contains invalid characters (use lowercase letters, numbers, and hyphens only)`)
  } else if (link.name.length > 63) {
    errors.push(`${category} link "${link.name}" name too long (maximum 63 characters)`)
  }

  // Validate links array
  if (!link.links || link.links.length === 0) {
    errors.push(`${category} link "${link.name}" has no link specifications`)
  } else {
    for (const linkSpec of link.links) {
      const specValidation = validateONFLinkSpec(linkSpec, link.name)
      warnings.push(...specValidation.warnings)
      errors.push(...specValidation.errors)
    }
  }

  return { warnings, errors }
}

/**
 * Validate individual ONF link specification
 */
function validateONFLinkSpec(
  spec: ONFLinkSpec,
  linkName: string
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  // Validate speed
  const validSpeeds = ['10G', '25G', '100G', '400G']
  if (!validSpeeds.includes(spec.speed)) {
    errors.push(`Link "${linkName}" has invalid speed "${spec.speed}" (must be one of: ${validSpeeds.join(', ')})`)
  }

  // Validate count
  if (!Number.isInteger(spec.count) || spec.count < 1) {
    errors.push(`Link "${linkName}" has invalid count "${spec.count}" (must be positive integer)`)
  } else if (spec.count > 128) {
    warnings.push(`Link "${linkName}" has very high port count (${spec.count}) - verify this is intentional`)
  }

  return { warnings, errors }
}

/**
 * Generate ONF YAML from compilation result
 */
export function generateONFYAML(
  compilationResult: ONFCompilationResult,
  vpcName: string = 'default-vpc'
): string {
  const { spec } = compilationResult

  const vpcSpec: any = {}

  // Add external links if present
  if (spec.external && spec.external.length > 0) {
    vpcSpec.external = spec.external
  }

  // Add static external links if present
  if (spec.staticExternal && spec.staticExternal.length > 0) {
    vpcSpec.staticExternal = spec.staticExternal
  }

  // If no external connectivity, return empty spec
  if (Object.keys(vpcSpec).length === 0) {
    return '# No external connectivity configured\n'
  }

  // Build complete VPC resource with external connectivity
  const vpcResource = {
    apiVersion: 'vpc.githedgehog.com/v1alpha2',
    kind: 'VPC',
    metadata: {
      name: vpcName,
      labels: {
        'hnc.githedgehog.com/external-connectivity': 'true'
      },
      annotations: {
        'hnc.githedgehog.com/generated-at': compilationResult.metadata.compiledAt,
        'hnc.githedgehog.com/total-external-bandwidth': `${compilationResult.metadata.totalExternalBandwidth}G`,
        'hnc.githedgehog.com/total-static-bandwidth': `${compilationResult.metadata.totalStaticBandwidth}G`,
        'hnc.githedgehog.com/total-links': compilationResult.metadata.totalLinks.toString()
      }
    },
    spec: {
      ...vpcSpec,
      // Other VPC spec fields would be merged here in real implementation
    }
  }

  // Convert to YAML (simplified - would use js-yaml in real implementation)
  return generateYAMLString(vpcResource)
}

/**
 * Simple YAML generation (placeholder for js-yaml)
 */
function generateYAMLString(obj: any): string {
  // This is a simplified YAML generator for the example
  // In real implementation, would use js-yaml library
  const lines: string[] = []
  
  function addObject(obj: any, indent: string = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue
      }
      
      if (Array.isArray(value)) {
        lines.push(`${indent}${key}:`)
        for (const item of value) {
          lines.push(`${indent}- `)
          if (typeof item === 'object') {
            addObject(item, indent + '  ')
          } else {
            lines[lines.length - 1] += String(item)
          }
        }
      } else if (typeof value === 'object') {
        lines.push(`${indent}${key}:`)
        addObject(value, indent + '  ')
      } else {
        lines.push(`${indent}${key}: ${String(value)}`)
      }
    }
  }
  
  addObject(obj)
  return lines.join('\n') + '\n'
}

/**
 * Create default external link for common scenarios
 */
export function createDefaultInternetUplink(): ExternalLink {
  return {
    id: 'internet-uplink',
    name: 'Internet Uplink',
    mode: 'target-bandwidth',
    targetGbps: 100,
    preferredSpeed: '100G',
    category: 'vpc.external',
    description: 'Primary internet connectivity',
    enabled: true
  }
}

export function createDefaultDatacenterInterconnect(): ExternalLink {
  return {
    id: 'dc-interconnect',
    name: 'Datacenter Interconnect',
    mode: 'target-bandwidth',
    targetGbps: 400,
    preferredSpeed: '400G',
    category: 'vpc.staticExternal',
    description: 'High-bandwidth datacenter-to-datacenter connectivity',
    enabled: true
  }
}