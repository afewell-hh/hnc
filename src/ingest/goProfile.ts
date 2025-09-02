/**
 * Go Profile Generator Wrapper - HNC v0.3
 * Node.js wrapper for optional Go profile generation tool
 */

import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';

/**
 * Checks if Go toolchain is available
 */
async function isGoAvailable(): Promise<boolean> {
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
async function isProfileDumperAvailable(toolPath: string = 'tools/hnc-profile-dump'): Promise<boolean> {
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
async function buildProfileDumper(toolPath: string = 'tools/hnc-profile-dump'): Promise<void> {
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
async function executeProfileDumper(toolPath: string = 'tools/hnc-profile-dump', outputDir?: string): Promise<void> {
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
 * Main function to run Go profile generator
 * Handles graceful fallback when Go toolchain is missing
 */
export async function runGoProfileGenerator(toolPath: string = 'tools/hnc-profile-dump', outputDir?: string): Promise<void> {
  // Check if Go is available
  if (!(await isGoAvailable())) {
    throw new Error('Go toolchain not available');
  }

  // Check if profile dumper source exists
  if (!(await isProfileDumperAvailable(toolPath))) {
    throw new Error(`Profile dumper source not found at ${toolPath}/main.go`);
  }

  try {
    // Build the Go tool
    console.log('Building Go profile dumper...');
    await buildProfileDumper(toolPath);

    // Run the profile dumper
    console.log('Running profile generation...');
    await executeProfileDumper(toolPath, outputDir);

    console.log('✅ Profile generation completed successfully');
  } catch (error) {
    throw new Error(`Go profile generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Simple health check for Go profile generation capability
 */
export async function checkGoProfileCapability(): Promise<{ available: boolean; reason?: string }> {
  if (!(await isGoAvailable())) {
    return { available: false, reason: 'Go toolchain not available' };
  }

  if (!(await isProfileDumperAvailable())) {
    return { available: false, reason: 'Profile dumper source not found' };
  }

  return { available: true };
}