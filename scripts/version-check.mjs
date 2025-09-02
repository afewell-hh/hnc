#!/usr/bin/env node

/**
 * Version Check Script - Track B CI Preset Pinning
 * 
 * Validates that all toolchain versions match the pinned versions
 * and displays version information for CI build logs.
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')

// Expected pinned versions from package.json
const EXPECTED_VERSIONS = {
  node: {
    '18': '18.18.0',
    '20': '20.11.1'
  },
  typescript: '5.2.2',
  vite: '5.3.4',
  vitest: '2.0.5',
  playwright: '1.46.0',
  storybook: '8.6.14'
}

class VersionChecker {
  constructor() {
    this.packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    this.errors = []
    this.warnings = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const prefix = {
      info: '📍',
      success: '✅', 
      warning: '⚠️',
      error: '❌'
    }[type] || '📍'
    
    console.log(`${prefix} [${timestamp}] ${message}`)
  }

  execCommand(command) {
    try {
      return execSync(command, { encoding: 'utf8' }).trim()
    } catch (error) {
      return null
    }
  }

  checkNodeVersion() {
    const nodeVersion = this.execCommand('node --version')
    this.log(`Node.js: ${nodeVersion}`)
    
    if (!nodeVersion) {
      this.errors.push('Node.js version could not be determined')
      return
    }
    
    const majorVersion = nodeVersion.match(/v(\d+)\./)?.[1]
    const expectedVersion = EXPECTED_VERSIONS.node[majorVersion]
    
    if (expectedVersion && !nodeVersion.includes(expectedVersion)) {
      this.warnings.push(`Node.js version mismatch: expected v${expectedVersion}, got ${nodeVersion}`)
    }
  }

  checkNpmVersion() {
    const npmVersion = this.execCommand('npm --version')
    this.log(`NPM: ${npmVersion}`)
  }

  checkTypeScriptVersion() {
    const tsVersion = this.execCommand('npx tsc --version')
    this.log(`TypeScript: ${tsVersion}`)
    
    const packageVersion = this.packageJson.devDependencies?.typescript
    if (packageVersion && tsVersion && !tsVersion.includes(packageVersion)) {
      this.warnings.push(`TypeScript version mismatch: package.json=${packageVersion}, installed=${tsVersion}`)
    }
  }

  checkViteVersion() {
    const viteVersion = this.execCommand('npx vite --version')
    this.log(`Vite: ${viteVersion}`)
    
    const packageVersion = this.packageJson.devDependencies?.vite
    if (packageVersion && viteVersion) {
      const installedVersion = viteVersion.match(/vite\/(\d+\.\d+\.\d+)/)?.[1]
      if (installedVersion && packageVersion !== installedVersion) {
        this.warnings.push(`Vite version mismatch: package.json=${packageVersion}, installed=${installedVersion}`)
      }
    }
  }

  checkVitestVersion() {
    const vitestVersion = this.execCommand('npx vitest --version')
    this.log(`Vitest: ${vitestVersion}`)
    
    const packageVersion = this.packageJson.devDependencies?.vitest
    if (packageVersion && vitestVersion && !vitestVersion.includes(packageVersion)) {
      this.warnings.push(`Vitest version mismatch: package.json=${packageVersion}, installed=${vitestVersion}`)
    }
  }

  checkPlaywrightVersion() {
    const playwrightVersion = this.execCommand('npx playwright --version')
    this.log(`Playwright: ${playwrightVersion}`)
    
    const packageVersion = this.packageJson.devDependencies?.['@playwright/test']
    if (packageVersion && playwrightVersion) {
      const installedVersion = playwrightVersion.match(/Version (\d+\.\d+\.\d+)/)?.[1]
      if (installedVersion && packageVersion !== installedVersion) {
        this.warnings.push(`Playwright version mismatch: package.json=${packageVersion}, installed=${installedVersion}`)
      }
    }
  }

  checkStorybookVersion() {
    const storybookVersion = this.execCommand('npx storybook --version')
    this.log(`Storybook: ${storybookVersion}`)
    
    const packageVersion = this.packageJson.devDependencies?.['@storybook/react']
    if (packageVersion && storybookVersion && !storybookVersion.includes(packageVersion)) {
      this.warnings.push(`Storybook version mismatch: package.json=${packageVersion}, installed=${storybookVersion}`)
    }
  }

  checkPinnedVersions() {
    this.log('Checking pinned versions in package.json...', 'info')
    
    const devDeps = this.packageJson.devDependencies || {}
    const pinnedCount = Object.values(devDeps).filter(version => !version.startsWith('^') && !version.startsWith('~')).length
    const totalCount = Object.keys(devDeps).length
    
    this.log(`Pinned dependencies: ${pinnedCount}/${totalCount}`)
    
    if (pinnedCount < totalCount) {
      this.warnings.push(`Not all dependencies are pinned: ${pinnedCount}/${totalCount}`)
    }
  }

  validateContractCompliance() {
    this.log('Validating Track B CI contract compliance...', 'info')
    
    // Check that core test toolchain versions are pinned
    const criticalTools = [
      'typescript',
      'vite', 
      'vitest',
      '@playwright/test',
      '@storybook/react'
    ]
    
    for (const tool of criticalTools) {
      const version = this.packageJson.devDependencies?.[tool]
      if (!version) {
        this.errors.push(`Critical tool ${tool} not found in devDependencies`)
      } else if (version.startsWith('^') || version.startsWith('~')) {
        this.errors.push(`Critical tool ${tool} is not pinned (version: ${version})`)
      }
    }
  }

  displaySummary() {
    this.log('='.repeat(50), 'info')
    this.log('VERSION CHECK SUMMARY', 'info')
    this.log('='.repeat(50), 'info')
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('All version checks passed!', 'success')
    } else {
      if (this.warnings.length > 0) {
        this.log(`Warnings: ${this.warnings.length}`, 'warning')
        this.warnings.forEach(warning => this.log(warning, 'warning'))
      }
      
      if (this.errors.length > 0) {
        this.log(`Errors: ${this.errors.length}`, 'error')
        this.errors.forEach(error => this.log(error, 'error'))
      }
    }
    
    this.log('='.repeat(50), 'info')
    
    return this.errors.length === 0
  }

  run() {
    this.log('Starting toolchain version validation...', 'info')
    this.log('Track B Objective: CI Preset Pinning', 'info')
    this.log('='.repeat(50), 'info')
    
    this.checkNodeVersion()
    this.checkNpmVersion()
    this.checkTypeScriptVersion()
    this.checkViteVersion()
    this.checkVitestVersion()
    this.checkPlaywrightVersion()
    this.checkStorybookVersion()
    this.checkPinnedVersions()
    this.validateContractCompliance()
    
    const success = this.displaySummary()
    
    if (!success) {
      process.exit(1)
    }
  }
}

// Run the version checker
const checker = new VersionChecker()
checker.run()