#!/usr/bin/env node

/**
 * Kubernetes Dry-run Validator
 * Validates FGD YAML files using kubectl server-side dry-run
 * Usage: node tools/k8s-dryrun.mjs [options]
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const KUBECONFIG_PATH = './.secrets/hnc-readonly.kubeconfig';
const NAMESPACE = 'hnc-it';
const FGD_BASE_DIR = './fgd';

// Command line argument parsing
const args = process.argv.slice(2);
const options = parseArgs(args);

async function main() {
  try {
    console.log('🧪 HNC Kubernetes Dry-run Validator');
    console.log('===================================\n');

    if (options.help) {
      printUsage();
      return;
    }

    // Check if kubeconfig file exists
    const kubeconfigPath = resolve(KUBECONFIG_PATH);
    if (!existsSync(kubeconfigPath)) {
      console.error('❌ Error: HNC readonly kubeconfig not found');
      console.error(`   Expected: ${kubeconfigPath}`);
      console.error('   Run: node tools/k8s-bootstrap.mjs');
      process.exit(1);
    }

    console.log('🔍 Testing kubeconfig connectivity...');
    try {
      execSync(`KUBECONFIG=${kubeconfigPath} kubectl auth can-i list configmaps -n ${NAMESPACE}`, { stdio: 'pipe' });
      console.log('✅ Kubeconfig is working and has proper permissions\n');
    } catch (error) {
      console.error('❌ Kubeconfig test failed');
      console.error('   The ServiceAccount may not have proper permissions');
      console.error('   Try re-running: node tools/k8s-bootstrap.mjs');
      process.exit(1);
    }

    // Determine what to validate
    const targets = determineValidationTargets();
    if (targets.length === 0) {
      console.error('❌ No validation targets found');
      console.error(`   Expected FGD directories in: ${resolve(FGD_BASE_DIR)}`);
      process.exit(1);
    }

    console.log(`🎯 Found ${targets.length} validation target(s):`);
    targets.forEach(target => console.log(`   📁 ${target}`));
    console.log();

    // Validate each target
    let allValid = true;
    const results = [];

    for (const target of targets) {
      console.log(`🔄 Validating: ${target}`);
      const result = await validateTarget(target, kubeconfigPath);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${target}: PASS`);
      } else {
        console.log(`❌ ${target}: FAIL`);
        allValid = false;
      }
      console.log();
    }

    // Summary
    console.log('📊 Validation Summary:');
    console.log('=====================\n');
    
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.target}`);
      
      if (!result.success && result.errors.length > 0) {
        result.errors.slice(0, 3).forEach(error => {
          console.log(`     └─ ${error}`);
        });
        if (result.errors.length > 3) {
          console.log(`     └─ ... and ${result.errors.length - 3} more errors`);
        }
      }
    });

    console.log();
    if (allValid) {
      console.log('🎉 All validations PASSED!');
      process.exit(0);
    } else {
      const failCount = results.filter(r => !r.success).length;
      console.log(`💥 ${failCount}/${results.length} validations FAILED`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function determineValidationTargets() {
  const targets = [];
  
  // Check if specific fabric was provided
  if (options.fabricId) {
    const fabricPath = join(FGD_BASE_DIR, options.fabricId);
    if (existsSync(fabricPath) && statSync(fabricPath).isDirectory()) {
      targets.push(fabricPath);
    } else {
      console.error(`❌ Fabric directory not found: ${fabricPath}`);
    }
    return targets;
  }

  // Check if FGD base directory exists
  if (!existsSync(FGD_BASE_DIR)) {
    return targets;
  }

  // Find all fabric directories
  try {
    const entries = readdirSync(FGD_BASE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fabricPath = join(FGD_BASE_DIR, entry.name);
        // Check if directory contains YAML files
        const yamlFiles = readdirSync(fabricPath).filter(f => 
          f.endsWith('.yaml') || f.endsWith('.yml')
        );
        if (yamlFiles.length > 0) {
          targets.push(fabricPath);
        }
      }
    }
  } catch (error) {
    console.error(`Warning: Could not scan FGD directory: ${error.message}`);
  }

  return targets;
}

async function validateTarget(targetPath, kubeconfigPath) {
  const result = {
    target: targetPath,
    success: false,
    errors: [],
    warnings: []
  };

  try {
    // Run kubectl apply with server-side dry-run
    const command = `KUBECONFIG=${kubeconfigPath} kubectl apply --server-dry-run=server -n ${NAMESPACE} -f ${targetPath}/`;
    
    if (options.verbose) {
      console.log(`   Running: ${command}`);
    }

    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe'
    });

    // Parse output for any issues
    const lines = output.split('\n').filter(line => line.trim());
    let hasErrors = false;

    for (const line of lines) {
      if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
        result.errors.push(line.trim());
        hasErrors = true;
      } else if (line.includes('warning') || line.includes('Warning') || line.includes('WARN')) {
        result.warnings.push(line.trim());
      }
    }

    // If no explicit errors found, check for success indicators
    if (!hasErrors) {
      const successIndicators = [
        'created (server dry run)',
        'configured (server dry run)',
        'unchanged (server dry run)'
      ];
      
      const hasSuccessIndicators = lines.some(line =>
        successIndicators.some(indicator => line.includes(indicator))
      );

      if (hasSuccessIndicators || lines.length === 0) {
        result.success = true;
      } else {
        // Unknown output format, consider it an error
        result.errors.push('No clear success or error indicators in output');
        if (options.verbose) {
          result.errors.push(`Output: ${output}`);
        }
      }
    }

    if (options.verbose && result.warnings.length > 0) {
      console.log(`   Warnings for ${targetPath}:`);
      result.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
    }

  } catch (error) {
    // kubectl command failed
    result.success = false;
    
    // Parse stderr for meaningful errors
    const errorOutput = error.stderr || error.message || 'Unknown error';
    const errorLines = errorOutput.split('\n').filter(line => line.trim());
    
    // Extract meaningful error messages
    for (const line of errorLines) {
      if (line.includes('error') || line.includes('Error') || line.includes('invalid') || 
          line.includes('not found') || line.includes('forbidden') || line.includes('unauthorized')) {
        result.errors.push(line.trim());
      }
    }

    // If no specific errors found, add generic error
    if (result.errors.length === 0) {
      result.errors.push('kubectl dry-run command failed');
      if (options.verbose) {
        result.errors.push(`Error: ${errorOutput}`);
      }
    }
  }

  return result;
}

function parseArgs(args) {
  const options = {
    fabricId: null,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--fabric-id':
        options.fabricId = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node tools/k8s-dryrun.mjs [options]

Description:
  Validates FGD YAML files using kubectl server-side dry-run.
  Uses the readonly kubeconfig created by k8s-bootstrap.mjs.

Options:
  --fabric-id <id>       Validate specific fabric directory (optional)
  --verbose              Show detailed output and errors
  --help, -h             Show this help message

Behavior:
  - Without --fabric-id: Validates all fabric directories in ${FGD_BASE_DIR}/
  - With --fabric-id: Validates only ${FGD_BASE_DIR}/<fabric-id>/
  - Stops on first validation error per fabric
  - Uses server-side dry-run for accurate validation

Requirements:
  - HNC readonly kubeconfig must exist: ${KUBECONFIG_PATH}
  - Run 'node tools/k8s-bootstrap.mjs' first if needed

Examples:
  # Validate all fabrics
  node tools/k8s-dryrun.mjs

  # Validate specific fabric
  node tools/k8s-dryrun.mjs --fabric-id vlab-sample

  # Verbose output
  node tools/k8s-dryrun.mjs --verbose

Exit Codes:
  0  All validations passed
  1  One or more validations failed or error occurred
`);
}

// Run the validator
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});