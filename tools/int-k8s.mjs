#!/usr/bin/env node

/**
 * Kubernetes Integration CLI Tool
 * Compares FGD YAML output against actual Kubernetes resources
 * Usage: node tools/int-k8s.mjs [options]
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';

// Dynamic imports for TypeScript modules
let K8sProvider, isK8sEnabled, overrideFeatureFlag;

async function loadModules() {
  try {
    // Import feature flags
    const flagsModule = await import('../src/features/feature-flags.js');
    isK8sEnabled = flagsModule.isK8sEnabled;
    overrideFeatureFlag = flagsModule.overrideFeatureFlag;
    
    // Import K8s service
    const k8sModule = await import('../src/services/k8s.service.js');
    K8sProvider = k8sModule.K8sProvider;
    
    return true;
  } catch (error) {
    console.error('❌ Failed to load modules. Make sure to compile TypeScript first:');
    console.error('   npm run build');
    console.error('\nAlternatively, this might indicate the project needs to be built.');
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return false; // Allow help to show even without modules
    }
    
    process.exit(1);
  }
}

// Command line argument parsing
const args = process.argv.slice(2);
const options = parseArgs(args);

async function main() {
  try {
    console.log('🚢 HNC Kubernetes Integration Tool');
    console.log('=====================================\n');

    // Handle help first (doesn't need modules)
    if (options.help) {
      printUsage();
      return;
    }

    // Load required modules
    const modulesLoaded = await loadModules();
    if (!modulesLoaded) {
      printUsage();
      return;
    }

    // Check if K8s integration is enabled
    if (!isK8sEnabled() && !options.forceEnable) {
      console.log('❌ K8s integration is disabled.');
      console.log('   Enable with: FEATURE_K8S=true or --force-enable flag\n');
      process.exit(1);
    }

    // Force enable if requested
    if (options.forceEnable) {
      console.log('🔧 Force enabling K8s integration for this run...\n');
      overrideFeatureFlag('k8s', true);
    }

    // Validate required options
    if (!options.runId) {
      console.error('❌ Error: --run-id is required');
      printUsage();
      process.exit(1);
    }

    if (!options.fgdFile) {
      console.error('❌ Error: --fgd-file is required');
      printUsage();
      process.exit(1);
    }

    // Initialize K8s provider
    console.log('🔌 Initializing Kubernetes connection...');
    const k8sProvider = new K8sProvider();
    const initialized = await k8sProvider.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize Kubernetes connection');
      console.error('   Check your kubeconfig and cluster connectivity');
      process.exit(1);
    }
    console.log('✅ Connected to Kubernetes cluster\n');

    // Generate namespace
    const namespace = k8sProvider.generateNamespace(options.runId);
    console.log(`📦 Target namespace: ${namespace}`);
    console.log(`🏷️  Label selector: hncRunId=${options.runId}\n`);

    // Load and parse FGD YAML
    console.log('📄 Loading FGD YAML file...');
    if (!existsSync(options.fgdFile)) {
      console.error(`❌ FGD file not found: ${options.fgdFile}`);
      process.exit(1);
    }

    const fgdContent = readFileSync(options.fgdFile, 'utf8');
    const expectedResources = parseFgdYaml(fgdContent);
    console.log(`✅ Parsed ${expectedResources.length} resources from FGD\n`);

    if (options.waitForResources) {
      // Wait for resources to be created
      console.log('⏳ Waiting for GitOps to apply resources...');
      const waitOptions = {
        maxRetries: options.maxRetries,
        initialDelayMs: options.initialDelay,
        maxDelayMs: options.maxDelay,
        backoffMultiplier: 2
      };

      const success = await k8sProvider.waitForResources(
        namespace,
        expectedResources,
        options.runId,
        waitOptions
      );

      if (!success) {
        console.error('❌ Timeout waiting for resources to be applied');
        process.exit(1);
      }
      console.log('✅ Resources are ready\n');
    }

    // Get actual resources from cluster
    console.log('🔍 Fetching resources from cluster...');
    const actualResources = await k8sProvider.listResourcesInNamespace(namespace, options.runId);
    console.log(`✅ Found ${actualResources.length} resources in cluster\n`);

    // Compare resources
    console.log('🔄 Comparing expected vs actual resources...');
    const diff = k8sProvider.compareResources(expectedResources, actualResources);

    // Report results
    printComparisonResults(diff);

    // Exit with appropriate code
    const hasIssues = diff.missing.length > 0 || diff.extra.length > 0 || diff.different.length > 0;
    if (hasIssues) {
      console.log('\n❌ Validation failed - resources do not match expected state');
      process.exit(1);
    } else {
      console.log('\n✅ Validation successful - all resources match expected state');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function parseArgs(args) {
  const options = {
    runId: null,
    fgdFile: null,
    waitForResources: false,
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    forceEnable: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--run-id':
        options.runId = args[++i];
        break;
      case '--fgd-file':
        options.fgdFile = resolve(args[++i]);
        break;
      case '--wait':
        options.waitForResources = true;
        break;
      case '--max-retries':
        options.maxRetries = parseInt(args[++i], 10);
        break;
      case '--initial-delay':
        options.initialDelay = parseInt(args[++i], 10);
        break;
      case '--max-delay':
        options.maxDelay = parseInt(args[++i], 10);
        break;
      case '--force-enable':
        options.forceEnable = true;
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

function parseFgdYaml(yamlContent) {
  try {
    const documents = yaml.loadAll(yamlContent);
    const resources = [];
    
    for (const doc of documents) {
      if (doc && typeof doc === 'object' && doc.kind && doc.metadata) {
        resources.push({
          apiVersion: doc.apiVersion || 'v1',
          kind: doc.kind,
          metadata: {
            name: doc.metadata.name,
            namespace: doc.metadata.namespace,
            labels: doc.metadata.labels || {}
          },
          spec: doc.spec,
          status: doc.status
        });
      }
    }
    
    return resources;
  } catch (error) {
    throw new Error(`Failed to parse FGD YAML: ${error.message}`);
  }
}

function printComparisonResults(diff) {
  console.log('📊 Comparison Results:');
  console.log('=====================\n');

  if (diff.missing.length > 0) {
    console.log(`❌ Missing resources (${diff.missing.length}):`);
    for (const resource of diff.missing) {
      console.log(`   - ${resource.kind}/${resource.metadata.name}`);
    }
    console.log();
  }

  if (diff.extra.length > 0) {
    console.log(`⚠️  Extra resources (${diff.extra.length}):`);
    for (const resource of diff.extra) {
      console.log(`   + ${resource.kind}/${resource.metadata.name}`);
    }
    console.log();
  }

  if (diff.different.length > 0) {
    console.log(`🔄 Different resources (${diff.different.length}):`);
    for (const { expected, actual, differences } of diff.different) {
      console.log(`   ~ ${expected.kind}/${expected.metadata.name}:`);
      for (const diff of differences) {
        console.log(`     ${diff}`);
      }
    }
    console.log();
  }

  if (diff.missing.length === 0 && diff.extra.length === 0 && diff.different.length === 0) {
    console.log('✅ All resources match perfectly!');
  }
}

function printUsage() {
  console.log(`
Usage: node tools/int-k8s.mjs --run-id <runId> --fgd-file <path> [options]

Required:
  --run-id <string>      Run ID for namespace isolation (e.g., "test-123")
  --fgd-file <path>      Path to FGD YAML file to compare

Options:
  --wait                 Wait for resources to be created before comparison
  --max-retries <n>      Maximum retry attempts for waiting (default: 10)
  --initial-delay <ms>   Initial delay between retries (default: 1000ms)
  --max-delay <ms>       Maximum delay between retries (default: 30000ms)
  --force-enable         Force enable K8s integration for this run
  --verbose              Show detailed error information
  --help, -h             Show this help message

Examples:
  # Basic comparison (requires FEATURE_K8S=true)
  node tools/int-k8s.mjs --run-id test-123 --fgd-file ./output/fabric.yaml

  # Wait for GitOps and then compare
  node tools/int-k8s.mjs --run-id prod-456 --fgd-file ./output/fabric.yaml --wait

  # Force enable and use custom retry settings
  node tools/int-k8s.mjs --run-id dev-789 --fgd-file ./output/fabric.yaml \\
    --force-enable --wait --max-retries 15 --initial-delay 2000

Environment Variables:
  FEATURE_K8S=true       Enable K8s integration
  KUBECONFIG=<path>      Path to kubeconfig file (optional)

Exit Codes:
  0  Success - resources match
  1  Validation failed or error occurred
`);
}

// Run the tool
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});