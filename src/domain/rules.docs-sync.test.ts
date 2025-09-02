/**
 * Documentation Synchronization Tests - HNC v0.4.1
 * Ensures all rule codes defined in code also appear in /docs/contracts.md
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { RuleCode } from './rules'

// Extract all rule codes from the rules module
function getAllDefinedRuleCodes(): RuleCode[] {
  // These are the rule codes defined in the RuleCode type union
  return [
    'SPINE_CAPACITY_EXCEEDED',
    'LEAF_CAPACITY_EXCEEDED', 
    'UPLINKS_NOT_DIVISIBLE_BY_SPINES',
    'MC_LAG_ODD_LEAFS',
    'ES_LAG_SINGLE_NIC',
    'MODEL_PROFILE_MISMATCH'
  ]
}

// Read the contracts documentation
function readContractsDoc(): string {
  try {
    const contractsPath = resolve(__dirname, '../../docs/contracts.md')
    return readFileSync(contractsPath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read contracts.md: ${error}`)
  }
}

describe('Rules Documentation Synchronization', () => {
  it('should have all rule codes documented in contracts.md', () => {
    const definedRuleCodes = getAllDefinedRuleCodes()
    const contractsContent = readContractsDoc()
    
    const missingRuleCodes: string[] = []
    const foundRuleCodes: string[] = []
    
    for (const ruleCode of definedRuleCodes) {
      if (contractsContent.includes(ruleCode)) {
        foundRuleCodes.push(ruleCode)
      } else {
        missingRuleCodes.push(ruleCode)
      }
    }
    
    // Create detailed report
    const report = {
      totalRuleCodes: definedRuleCodes.length,
      foundInDocs: foundRuleCodes.length,
      missingFromDocs: missingRuleCodes.length,
      foundRuleCodes: foundRuleCodes.sort(),
      missingRuleCodes: missingRuleCodes.sort()
    }
    
    // Log report for debugging
    console.log('Rule Code Documentation Report:', report)
    
    // Assert all rule codes are documented
    expect(missingRuleCodes, 
      `The following rule codes are defined in code but missing from docs/contracts.md:\n` +
      `${missingRuleCodes.map(code => `- ${code}`).join('\n')}\n\n` +
      `Please add documentation for these rule codes to maintain sync between code and docs.`
    ).toHaveLength(0)
    
    // Verify we found all expected codes
    expect(foundRuleCodes).toHaveLength(definedRuleCodes.length)
    expect(foundRuleCodes.sort()).toEqual(definedRuleCodes.sort())
  })

  it('should document rule severity levels for each code', () => {
    const definedRuleCodes = getAllDefinedRuleCodes()
    const contractsContent = readContractsDoc()
    
    // Check if severity information is present for each rule
    const severityKeywords = ['error', 'warning', 'info', 'severity', 'high', 'medium', 'low']
    const ruleCodeSeverityMap: Record<string, boolean> = {}
    
    for (const ruleCode of definedRuleCodes) {
      // Look for the rule code and nearby severity information
      const ruleIndex = contractsContent.indexOf(ruleCode)
      if (ruleIndex !== -1) {
        // Check 500 characters around the rule code for severity info
        const contextStart = Math.max(0, ruleIndex - 250)
        const contextEnd = Math.min(contractsContent.length, ruleIndex + 250)
        const context = contractsContent.slice(contextStart, contextEnd).toLowerCase()
        
        const hasSeverityInfo = severityKeywords.some(keyword => context.includes(keyword))
        ruleCodeSeverityMap[ruleCode] = hasSeverityInfo
      } else {
        ruleCodeSeverityMap[ruleCode] = false
      }
    }
    
    const codesWithoutSeverity = Object.entries(ruleCodeSeverityMap)
      .filter(([code, hasSeverity]) => !hasSeverity)
      .map(([code]) => code)
    
    // Log for debugging
    console.log('Rule Code Severity Documentation:', ruleCodeSeverityMap)
    
    if (codesWithoutSeverity.length > 0) {
      console.warn(
        `The following rule codes may be missing severity documentation:\n` +
        `${codesWithoutSeverity.map(code => `- ${code}`).join('\n')}`
      )
    }
    
    // This is a soft check - we expect most rules to have severity info
    const severityDocumentationRatio = (Object.keys(ruleCodeSeverityMap).length - codesWithoutSeverity.length) / Object.keys(ruleCodeSeverityMap).length
    expect(severityDocumentationRatio).toBeGreaterThan(0.8) // At least 80% should have severity info
  })

  it('should provide examples or descriptions for each rule code', () => {
    const definedRuleCodes = getAllDefinedRuleCodes()
    const contractsContent = readContractsDoc()
    
    const exampleKeywords = ['example', 'scenario', 'when', 'if', 'check', 'validate', 'detect']
    const ruleCodeExampleMap: Record<string, boolean> = {}
    
    for (const ruleCode of definedRuleCodes) {
      const ruleIndex = contractsContent.indexOf(ruleCode)
      if (ruleIndex !== -1) {
        // Check 1000 characters around the rule code for examples/descriptions
        const contextStart = Math.max(0, ruleIndex - 500)
        const contextEnd = Math.min(contractsContent.length, ruleIndex + 500)
        const context = contractsContent.slice(contextStart, contextEnd).toLowerCase()
        
        const hasExampleInfo = exampleKeywords.some(keyword => context.includes(keyword))
        ruleCodeExampleMap[ruleCode] = hasExampleInfo
      } else {
        ruleCodeExampleMap[ruleCode] = false
      }
    }
    
    const codesWithoutExamples = Object.entries(ruleCodeExampleMap)
      .filter(([code, hasExample]) => !hasExample)
      .map(([code]) => code)
    
    // Log for debugging
    console.log('Rule Code Example Documentation:', ruleCodeExampleMap)
    
    if (codesWithoutExamples.length > 0) {
      console.warn(
        `The following rule codes may be missing example/description documentation:\n` +
        `${codesWithoutExamples.map(code => `- ${code}`).join('\n')}`
      )
    }
    
    // Soft check - expect most rules to have examples or descriptions
    const exampleDocumentationRatio = (Object.keys(ruleCodeExampleMap).length - codesWithoutExamples.length) / Object.keys(ruleCodeExampleMap).length
    expect(exampleDocumentationRatio).toBeGreaterThan(0.7) // At least 70% should have examples
  })

  it('should have consistent rule code naming convention', () => {
    const definedRuleCodes = getAllDefinedRuleCodes()
    
    // Rule codes should follow SCREAMING_SNAKE_CASE convention
    const invalidRuleCodes = definedRuleCodes.filter(code => {
      // Should be all uppercase letters, numbers, and underscores
      return !/^[A-Z0-9_]+$/.test(code)
    })
    
    expect(invalidRuleCodes, 
      `The following rule codes don't follow SCREAMING_SNAKE_CASE convention:\n` +
      `${invalidRuleCodes.join(', ')}`
    ).toHaveLength(0)
    
    // Rule codes should be descriptive (not too short)
    const tooShortRuleCodes = definedRuleCodes.filter(code => code.length < 8)
    expect(tooShortRuleCodes,
      `The following rule codes are too short (should be descriptive):\n` +
      `${tooShortRuleCodes.join(', ')}`
    ).toHaveLength(0)
    
    // Log all rule codes for review
    console.log('All defined rule codes:', definedRuleCodes.sort())
  })

  it('should validate contracts.md structure for rule documentation', () => {
    const contractsContent = readContractsDoc()
    
    // Check that contracts.md has proper structure
    const requiredSections = [
      'HNC Behavioral Contracts',
      'Guard System',
      'Rule',
      'validation',
      'constraint'
    ]
    
    const missingSections = requiredSections.filter(section => 
      !contractsContent.toLowerCase().includes(section.toLowerCase())
    )
    
    expect(missingSections, 
      `contracts.md is missing the following sections:\n` +
      `${missingSections.join(', ')}\n` +
      `Please ensure the documentation has proper structure for rule documentation.`
    ).toHaveLength(0)
    
    // Check document length (should be comprehensive)
    expect(contractsContent.length).toBeGreaterThan(1000) // Should be substantial documentation
    
    // Check that it mentions fabric validation
    expect(contractsContent.toLowerCase()).toContain('fabric')
    expect(contractsContent.toLowerCase()).toContain('validation')
    
    console.log(`contracts.md structure validation passed. Document length: ${contractsContent.length} characters`)
  })
})