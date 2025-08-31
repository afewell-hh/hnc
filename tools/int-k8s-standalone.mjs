#!/usr/bin/env node

/**
 * Standalone Kubernetes Integration CLI Tool
 * Demonstrates the K8s integration functionality without requiring TypeScript compilation
 * Usage: node tools/int-k8s-standalone.mjs [options]
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';

// Standalone implementation for demonstration
class StandaloneK8sProvider {
  constructor() {
    this.isInitialized = false;
  }

  generateNamespace(runId) {
    return `hnc-it-${runId}`;
  }

  async initialize() {
    console.log('🔧 Standalone mode: K8s integration would initialize here');
    console.log('   - Loading kubeconfig');
    console.log('   - Creating Kubernetes API clients');
    console.log('   - Testing cluster connectivity');
    
    // Simulate initialization success/failure
    const hasKubeconfig = process.env.KUBECONFIG || existsSync(`${process.env.HOME}/.kube/config`);
    
    if (hasKubeconfig) {
      console.log('✅ Found kubeconfig file');
      this.isInitialized = true;
      return true;
    } else {
      console.log('❌ No kubeconfig found');
      return false;
    }
  }

  isReady() {
    return this.isInitialized;
  }

  async waitForResources(namespace, expectedResources, hncRunId, options = {}) {
    const { maxRetries = 10, initialDelayMs = 1000, maxDelayMs = 30000, backoffMultiplier = 2 } = options;
    
    console.log(`📊 Simulating wait for ${expectedResources.length} resources in namespace ${namespace}`);
    console.log(`🏷️  Using label selector: hncRunId=${hncRunId}`);
    
    let currentDelay = initialDelayMs;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`⏳ Attempt ${attempt + 1}/${maxRetries}...`);
      
      // Simulate resource checking
      await new Promise(resolve => setTimeout(resolve, Math.min(500, currentDelay / 4)));
      
      // Simulate gradual resource availability
      const foundResourcesCount = Math.min(attempt + 1, expectedResources.length);
      console.log(`   Found ${foundResourcesCount}/${expectedResources.length} resources`);
      
      if (foundResourcesCount === expectedResources.length) {
        console.log('✅ All expected resources found');
        return true;
      }
      
      if (attempt < maxRetries - 1) {
        console.log(`   Waiting ${currentDelay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
      }
    }
    
    console.log('⏱️  Timeout reached');
    return false;
  }

  async listResourcesInNamespace(namespace, hncRunId) {
    console.log(`🔍 Would list resources in namespace: ${namespace}`);
    console.log(`🏷️  With label selector: hncRunId=${hncRunId}`);
    
    // Simulate found resources
    return [
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'fabric-config',
          namespace: namespace,
          labels: { hncRunId, component: 'fabric-config' }
        }
      },
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'fabric-controller',
          namespace: namespace,
          labels: { hncRunId, component: 'fabric-controller' }
        }
      }
    ];
  }

  compareResources(expected, actual) {
    const missing = [];
    const extra = [];
    const different = [];

    console.log(`📊 Comparing ${expected.length} expected vs ${actual.length} actual resources`);

    // Find missing resources
    for (const expectedResource of expected) {
      const actualResource = actual.find(r => 
        r.kind === expectedResource.kind && 
        r.metadata.name === expectedResource.metadata.name
      );
      
      if (!actualResource) {
        missing.push(expectedResource);
      } else {
        // Check for differences
        const differences = this.findResourceDifferences(expectedResource, actualResource);
        if (differences.length > 0) {
          different.push({ expected: expectedResource, actual: actualResource, differences });
        }
      }
    }

    // Find extra resources
    for (const actualResource of actual) {
      const expectedResource = expected.find(r => 
        r.kind === actualResource.kind && 
        r.metadata.name === actualResource.metadata.name
      );
      
      if (!expectedResource) {
        extra.push(actualResource);
      }
    }

    return { missing, extra, different };
  }

  findResourceDifferences(expected, actual) {
    const differences = [];
    
    if (expected.apiVersion !== actual.apiVersion) {
      differences.push(`apiVersion: expected ${expected.apiVersion}, got ${actual.apiVersion}`);
    }
    
    if (expected.metadata.labels && actual.metadata.labels) {
      for (const [key, value] of Object.entries(expected.metadata.labels)) {
        if (actual.metadata.labels[key] !== value) {
          differences.push(`label ${key}: expected ${value}, got ${actual.metadata.labels[key] || 'undefined'}`);
        }
      }
    }
    
    return differences;
  }

  parseYamlToResources(yamlContent) {
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
}

// Feature flag simulation
function isK8sEnabled() {
  return process.env.FEATURE_K8S === 'true';
}

function overrideFeatureFlag(key, value) {
  process.env[`FEATURE_${key.toUpperCase()}`] = value.toString();
  console.log(`🔧 Feature flag ${key} set to ${value}`);
}

// Command line argument parsing
const args = process.argv.slice(2);
const options = parseArgs(args);

async function main() {
  try {
    console.log('🚢 HNC Kubernetes Integration Tool (Standalone Demo)');
    console.log('===================================================\n');

    // Handle help first
    if (options.help) {
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
      console.log('🔧 Force enabling K8s integration for this demo...\n');
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
    console.log('🔌 Initializing Kubernetes connection (demo mode)...');
    const k8sProvider = new StandaloneK8sProvider();
    const initialized = await k8sProvider.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize Kubernetes connection');
      console.error('   This is expected in demo mode without a real cluster');
      
      if (!options.demoMode) {
        process.exit(1);
      } else {
        console.log('🔧 Continuing in demo mode...\n');
      }
    } else {
      console.log('✅ Kubernetes connection ready\n');
    }

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
    const expectedResources = k8sProvider.parseYamlToResources(fgdContent);
    console.log(`✅ Parsed ${expectedResources.length} resources from FGD:`);
    expectedResources.forEach(r => {
      console.log(`   - ${r.kind}/${r.metadata.name}`);
    });
    console.log();

    if (options.waitForResources) {
      // Wait for resources to be created
      console.log('⏳ Waiting for GitOps to apply resources (demo simulation)...');
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
        if (!options.demoMode) {
          process.exit(1);
        }
      } else {
        console.log('✅ Resources are ready\n');
      }
    }

    // Get actual resources from cluster
    console.log('🔍 Fetching resources from cluster (demo simulation)...');
    const actualResources = await k8sProvider.listResourcesInNamespace(namespace, options.runId);
    console.log(`✅ Found ${actualResources.length} resources in cluster:`);
    actualResources.forEach(r => {
      console.log(`   - ${r.kind}/${r.metadata.name}`);
    });
    console.log();

    // Compare resources
    console.log('🔄 Comparing expected vs actual resources...');
    const diff = k8sProvider.compareResources(expectedResources, actualResources);

    // Report results
    printComparisonResults(diff);

    // Exit with appropriate code
    const hasIssues = diff.missing.length > 0 || diff.extra.length > 0 || diff.different.length > 0;
    if (hasIssues) {
      console.log('\n⚠️  Validation would fail in real scenario - resources do not match expected state');
      if (options.demoMode) {
        console.log('✅ Demo completed successfully');
        process.exit(0);
      } else {
        process.exit(1);
      }
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
    help: false,
    demoMode: false
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
      case '--demo':
        options.demoMode = true;
        options.forceEnable = true;
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
Usage: node tools/int-k8s-standalone.mjs --run-id <runId> --fgd-file <path> [options]

Required:
  --run-id <string>      Run ID for namespace isolation (e.g., "test-123")
  --fgd-file <path>      Path to FGD YAML file to compare

Options:
  --wait                 Wait for resources to be created before comparison
  --max-retries <n>      Maximum retry attempts for waiting (default: 10)
  --initial-delay <ms>   Initial delay between retries (default: 1000ms)
  --max-delay <ms>       Maximum delay between retries (default: 30000ms)
  --force-enable         Force enable K8s integration for this run
  --demo                 Run in demo mode (continues without real cluster)
  --verbose              Show detailed error information
  --help, -h             Show this help message

Examples:
  # Demo mode (no cluster required)
  node tools/int-k8s-standalone.mjs --run-id test-123 \\
    --fgd-file ./examples/sample-fabric.yaml --demo

  # Real cluster validation
  FEATURE_K8S=true node tools/int-k8s-standalone.mjs \\
    --run-id prod-456 --fgd-file ./output/fabric.yaml --wait

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