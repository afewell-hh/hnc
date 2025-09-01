#!/usr/bin/env node

/**
 * UP-VALIDATE: Validate upstream examples via hhfab + K8s server-dry-run
 * 
 * Features:
 * - Validates upstream CRD examples using hhfab validate command
 * - Optional kubectl server-dry-run for CRD YAML validation
 * - Clear PASS/FAIL reporting per example
 * - Environment variable opt-in: HHFAB=1, FEATURE_K8S=true + KUBECONFIG
 * - Supports both individual file validation and batch validation
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Environment configuration
const config = {
  hhfabEnabled: process.env.HHFAB === '1' || process.env.FEATURE_HHFAB === 'true',
  k8sEnabled: process.env.FEATURE_K8S === 'true' && process.env.KUBECONFIG,
  verbose: process.env.HNC_VERBOSE === 'true',
  hhfabPath: process.env.HHFAB && process.env.HHFAB !== '1' ? process.env.HHFAB : 'hhfab',
  kubectlPath: process.env.KUBECTL || 'kubectl',
  hhfabWorkdir: path.join(projectRoot, 'hhfab'),
  examplesDir: path.join(projectRoot, 'examples', 'upstream-crds'),
  upstreamExamplesDir: path.join(projectRoot, 'src', 'upstream', 'examples')
};

// Colors for output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

/**
 * Execute a command and return result
 */
function executeCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    if (config.verbose) {
      console.log(`${colors.dim}Running: ${command} ${args.join(' ')}${colors.reset}`);
    }

    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd || process.cwd(),
      ...options
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      });
    });

    proc.on('error', (error) => {
      resolve({
        code: -1,
        stdout: '',
        stderr: error.message,
        success: false,
        error
      });
    });
  });
}

/**
 * Validate a file using hhfab
 */
async function validateWithHhfab(filePath) {
  const result = {
    tool: 'hhfab',
    file: path.relative(projectRoot, filePath),
    success: false,
    message: '',
    details: ''
  };

  try {
    // Copy file to hhfab working directory temporarily
    const fileName = path.basename(filePath);
    const tempPath = path.join(config.hhfabWorkdir, fileName);
    
    await fs.copyFile(filePath, tempPath);
    
    try {
      const hhfabResult = await executeCommand(
        config.hhfabPath,
        ['validate', '--brief'],
        { cwd: config.hhfabWorkdir }
      );

      result.success = hhfabResult.success;
      result.message = hhfabResult.success ? 'Valid hhfab configuration' : 'hhfab validation failed';
      result.details = hhfabResult.stderr || hhfabResult.stdout || '';

      if (config.verbose && result.details) {
        result.details = `stdout: ${hhfabResult.stdout}\nstderr: ${hhfabResult.stderr}`;
      }
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    result.message = `hhfab validation error: ${error.message}`;
    result.details = error.stack || '';
  }

  return result;
}

/**
 * Validate a YAML file using kubectl server-dry-run
 */
async function validateWithKubectl(filePath) {
  const result = {
    tool: 'kubectl',
    file: path.relative(projectRoot, filePath),
    success: false,
    message: '',
    details: ''
  };

  try {
    const kubectlResult = await executeCommand(
      config.kubectlPath,
      ['apply', '--dry-run=server', '--validate=strict', '-f', filePath]
    );

    result.success = kubectlResult.success;
    result.message = kubectlResult.success ? 'Valid Kubernetes YAML' : 'kubectl validation failed';
    result.details = kubectlResult.stderr || kubectlResult.stdout || '';

    if (config.verbose && result.details) {
      result.details = `stdout: ${kubectlResult.stdout}\nstderr: ${kubectlResult.stderr}`;
    }
  } catch (error) {
    result.message = `kubectl validation error: ${error.message}`;
    result.details = error.stack || '';
  }

  return result;
}

/**
 * Get all YAML files in a directory
 */
async function getYamlFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const yamlFiles = entries
      .filter(entry => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
      .map(entry => path.join(directory, entry.name));
    return yamlFiles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Validate a single file
 */
async function validateFile(filePath) {
  const results = [];

  console.log(`${colors.blue}Validating:${colors.reset} ${path.relative(projectRoot, filePath)}`);

  // hhfab validation
  if (config.hhfabEnabled) {
    const hhfabResult = await validateWithHhfab(filePath);
    results.push(hhfabResult);
  } else {
    results.push({
      tool: 'hhfab',
      file: path.relative(projectRoot, filePath),
      success: null,
      message: 'Skipped (HHFAB validation disabled)',
      details: 'Set HHFAB=1 or FEATURE_HHFAB=true to enable'
    });
  }

  // kubectl validation
  if (config.k8sEnabled) {
    const kubectlResult = await validateWithKubectl(filePath);
    results.push(kubectlResult);
  } else {
    results.push({
      tool: 'kubectl',
      file: path.relative(projectRoot, filePath),
      success: null,
      message: 'Skipped (K8s validation disabled)',
      details: 'Set FEATURE_K8S=true and KUBECONFIG to enable'
    });
  }

  return results;
}

/**
 * Format and display validation results
 */
function displayResults(allResults) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  console.log(`\n${colors.bold}=== VALIDATION RESULTS ===${colors.reset}`);

  for (const fileResults of allResults) {
    const fileName = fileResults[0]?.file || 'unknown';
    console.log(`\n${colors.cyan}File: ${fileName}${colors.reset}`);

    for (const result of fileResults) {
      summary.total++;

      const status = result.success === true ? 'PASS' : result.success === false ? 'FAIL' : 'SKIP';
      const color = result.success === true ? colors.green : result.success === false ? colors.red : colors.yellow;

      console.log(`  ${result.tool}: ${color}${status}${colors.reset} - ${result.message}`);

      if (result.success === true) {
        summary.passed++;
      } else if (result.success === false) {
        summary.failed++;
      } else {
        summary.skipped++;
      }

      if (result.details && (config.verbose || result.success === false)) {
        // Show details for failures or when verbose
        const detailLines = result.details.split('\n').filter(line => line.trim());
        for (const line of detailLines.slice(0, 3)) { // Limit to first 3 lines
          console.log(`    ${colors.dim}${line}${colors.reset}`);
        }
        if (detailLines.length > 3) {
          console.log(`    ${colors.dim}... (${detailLines.length - 3} more lines)${colors.reset}`);
        }
      }
    }
  }

  console.log(`\n${colors.bold}=== SUMMARY ===${colors.reset}`);
  console.log(`Total validations: ${summary.total}`);
  console.log(`${colors.green}Passed: ${summary.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${summary.failed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${summary.skipped}${colors.reset}`);

  return summary;
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const specificFile = args.find(arg => !arg.startsWith('--'));
  const isVerbose = args.includes('--verbose') || args.includes('-v');
  
  if (isVerbose) {
    config.verbose = true;
  }

  console.log(`${colors.bold}UP-VALIDATE: Upstream Examples Validation${colors.reset}`);
  console.log(`hhfab validation: ${config.hhfabEnabled ? colors.green + 'ENABLED' : colors.yellow + 'DISABLED'}${colors.reset}`);
  console.log(`kubectl validation: ${config.k8sEnabled ? colors.green + 'ENABLED' : colors.yellow + 'DISABLED'}${colors.reset}`);

  let filesToValidate = [];

  if (specificFile) {
    // Validate specific file
    const fullPath = path.resolve(specificFile);
    try {
      await fs.access(fullPath);
      filesToValidate = [fullPath];
    } catch (error) {
      console.error(`${colors.red}Error: File not found: ${specificFile}${colors.reset}`);
      process.exit(1);
    }
  } else {
    // Validate all files in examples directories
    const exampleFiles = await getYamlFiles(config.examplesDir);
    const upstreamFiles = await getYamlFiles(config.upstreamExamplesDir);
    filesToValidate = [...exampleFiles, ...upstreamFiles];

    if (filesToValidate.length === 0) {
      console.log(`${colors.yellow}No YAML files found to validate${colors.reset}`);
      console.log(`Searched in:`);
      console.log(`  - ${path.relative(projectRoot, config.examplesDir)}`);
      console.log(`  - ${path.relative(projectRoot, config.upstreamExamplesDir)}`);
      return;
    }
  }

  console.log(`\nValidating ${filesToValidate.length} file(s)...\n`);

  // Validate all files
  const allResults = [];
  for (const filePath of filesToValidate) {
    const results = await validateFile(filePath);
    allResults.push(results);
  }

  // Display results and determine exit code
  const summary = displayResults(allResults);
  
  // Exit with error code if any validations failed
  if (summary.failed > 0) {
    console.log(`\n${colors.red}Validation failed with ${summary.failed} error(s)${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}All validations passed!${colors.reset}`);
    process.exit(0);
  }
}

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${colors.bold}UP-VALIDATE: Upstream Examples Validation${colors.reset}

Validates upstream examples using hhfab and optional kubectl server-dry-run.

Usage:
  node upstream-validate.mjs [options] [file]

Options:
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Environment Variables:
  HHFAB=1                    Enable hhfab validation
  FEATURE_HHFAB=true         Alternative way to enable hhfab validation
  FEATURE_K8S=true          Enable kubectl validation (requires KUBECONFIG)
  KUBECONFIG=path           Path to kubeconfig file for kubectl validation
  HNC_VERBOSE=true          Enable verbose output by default
  HHFAB=path                Custom path to hhfab binary
  KUBECTL=path              Custom path to kubectl binary

Examples:
  # Validate all upstream examples
  npm run validate:upstream

  # Validate specific file
  node tools/upstream-validate.mjs examples/upstream-crds/fabric.yaml

  # Validate with verbose output
  node tools/upstream-validate.mjs --verbose

  # Enable hhfab validation only
  HHFAB=1 node tools/upstream-validate.mjs

  # Enable both hhfab and kubectl validation
  HHFAB=1 FEATURE_K8S=true KUBECONFIG=~/.kube/config node tools/upstream-validate.mjs
`);
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  if (config.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});