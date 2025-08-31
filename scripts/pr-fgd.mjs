#!/usr/bin/env node

/**
 * CLI script for creating GitHub PRs with FGD changes
 * Usage: npm run pr:fgd -- <fabric-id>
 * 
 * Environment requirements:
 * - FEATURE_GH_PR=true
 * - GITHUB_TOKEN=<token>
 * - GIT_REMOTE=<owner/repo or https://github.com/owner/repo.git>
 */

import { createGitHubPRService, isGitHubPRAvailable } from '../src/features/github-pr.service.ts'
import { loadFGD } from '../src/io/fgd.ts'

function printUsage() {
  console.log(`
Usage: npm run pr:fgd -- <fabric-id>

Creates a GitHub Pull Request with FGD files for the specified fabric.

Arguments:
  fabric-id    ID of the fabric to create PR for

Environment Variables:
  FEATURE_GH_PR    Set to 'true' to enable GitHub PR mode
  GITHUB_TOKEN     GitHub personal access token
  GIT_REMOTE       Repository (owner/repo or full URL)
  GIT_BASE_BRANCH  Base branch for PR (default: main)

Examples:
  npm run pr:fgd -- test-fabric
  FEATURE_GH_PR=true npm run pr:fgd -- prod-fabric-01
`)
}

function exitWithError(message, code = 1) {
  console.error(`❌ Error: ${message}`)
  process.exit(code)
}

async function main() {
  const args = process.argv.slice(2)
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }
  
  // Validate arguments
  if (args.length !== 1) {
    console.error('❌ Error: Expected exactly one argument (fabric-id)')
    printUsage()
    process.exit(1)
  }
  
  const fabricId = args[0]
  
  if (!fabricId || fabricId.trim() === '') {
    exitWithError('Fabric ID cannot be empty')
  }
  
  // Validate environment
  if (!isGitHubPRAvailable()) {
    console.error('❌ GitHub PR mode not available. Check requirements:')
    console.error('   • FEATURE_GH_PR=true')
    console.error('   • GITHUB_TOKEN=<your-token>')
    console.error('   • GIT_REMOTE=<owner/repo>')
    console.error('')
    console.error('Current environment:')
    console.error(`   • FEATURE_GH_PR: ${process.env.FEATURE_GH_PR || 'not set'}`)
    console.error(`   • GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'set' : 'not set'}`)
    console.error(`   • GIT_REMOTE: ${process.env.GIT_REMOTE || 'not set'}`)
    process.exit(1)
  }
  
  console.log(`🚀 Creating GitHub PR for fabric: ${fabricId}`)
  
  try {
    // Load FGD from local storage
    console.log('📂 Loading FGD files...')
    const loadResult = await loadFGD({ fabricId })
    
    if (!loadResult.success || !loadResult.diagram) {
      exitWithError(`Failed to load FGD files for ${fabricId}: ${loadResult.error}`)
    }
    
    console.log(`✅ Loaded FGD files: ${loadResult.filesRead.length} files`)
    console.log(`   Files: ${loadResult.filesRead.map(f => f.split('/').pop()).join(', ')}`)
    
    // Create GitHub PR service
    console.log('🔧 Initializing GitHub PR service...')
    const prService = createGitHubPRService()
    
    if (!prService) {
      exitWithError('Failed to create GitHub PR service')
    }
    
    const initialized = await prService.initialize()
    if (!initialized) {
      exitWithError('Failed to initialize GitHub PR service')
    }
    
    // Create pull request
    console.log('📤 Creating pull request...')
    const prResult = await prService.createFGDPullRequest(fabricId, loadResult.diagram)
    
    if (!prResult.success) {
      exitWithError(`Failed to create pull request: ${prResult.error}`)
    }
    
    // Success! Print results
    console.log('')
    console.log('🎉 Pull request created successfully!')
    console.log('')
    console.log(`PR URL: ${prResult.prUrl}`)
    console.log(`PR #${prResult.prNumber}`)
    console.log(`Branch: ${prResult.branchName}`)
    console.log('')
    console.log(`📋 Summary:`)
    const diagram = loadResult.diagram
    const leafCount = diagram.devices.leaves.length
    const spineCount = diagram.devices.spines.length
    const serverCount = diagram.devices.servers.length
    const endpointCount = diagram.devices.servers.reduce((total, server) => total + (server.connections || 0), 0)
    
    console.log(`   • ${leafCount} leaves, ${spineCount} spines`)
    console.log(`   • ${serverCount} servers, ${endpointCount} endpoints`)
    console.log(`   • 3 YAML files committed`)
    console.log('')
    console.log('💡 Note: Manual approval required before merge')
    
  } catch (error) {
    exitWithError(error.message || 'Unknown error occurred')
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})

main().catch(error => {
  exitWithError(error.message || 'Unknown error in main()')
})