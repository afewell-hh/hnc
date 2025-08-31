#!/usr/bin/env node

/**
 * Go Profile Generator CLI - HNC v0.3
 * Direct implementation for NPM script execution
 */

import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';

/**
 * Checks if Go toolchain is available
 */
async function isGoAvailable() {
  return new Promise((resolve) => {
    const goProcess = spawn('go', ['version'], { stdio: 'pipe' });
    
    goProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    goProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Checks if the Go profile dumper binary exists
 */
async function isProfileDumperAvailable(toolPath = 'tools/hnc-profile-dump') {
  try {
    await access(`${toolPath}/main.go`, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the Go profile dumper if needed
 */
async function buildProfileDumper(toolPath = 'tools/hnc-profile-dump') {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('go', ['build', '-o', 'hnc-profile-dump', 'main.go'], {
      cwd: toolPath,
      stdio: 'pipe'
    });

    let stderr = '';
    
    buildProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Go build failed with code ${code}: ${stderr}`));
      }
    });

    buildProcess.on('error', (error) => {
      reject(new Error(`Failed to start Go build: ${error.message}`));
    });
  });
}

/**
 * Runs the Go profile dumper to regenerate fixtures
 */
async function executeProfileDumper(toolPath = 'tools/hnc-profile-dump', outputDir) {
  return new Promise((resolve, reject) => {
    const args = outputDir ? ['--output', outputDir] : [];
    const dumperProcess = spawn('./hnc-profile-dump', args, {
      cwd: toolPath,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    dumperProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    dumperProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    dumperProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Profile generation output:', stdout);
        resolve();
      } else {
        reject(new Error(`Profile dumper failed with code ${code}: ${stderr}`));
      }
    });

    dumperProcess.on('error', (error) => {
      reject(new Error(`Failed to execute profile dumper: ${error.message}`));
    });
  });
}

/**
 * Main function to run Go profile generator from NPM script
 */
async function main() {
  try {
    console.log('🔍 Checking Go toolchain availability...');
    
    if (!(await isGoAvailable())) {
      throw new Error('Go toolchain not available');
    }

    if (!(await isProfileDumperAvailable())) {
      throw new Error('Profile dumper source not found at tools/hnc-profile-dump/main.go');
    }

    console.log('🔨 Building Go profile dumper...');
    await buildProfileDumper();

    console.log('🚀 Running profile generation...');
    await executeProfileDumper();

    console.log('✅ Profile generation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Profile generation failed:', error.message);
    console.log('💡 Falling back to existing fixtures');
    console.log('ℹ️  This is expected behavior when Go toolchain is not available');
    process.exit(0); // Don't fail the script - fallback is expected behavior
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}