#!/usr/bin/env node

/**
 * Kubernetes Bootstrap Tool
 * Creates ServiceAccount, Role, RoleBinding, and generates kubeconfig for HNC readonly access
 * Usage: node tools/k8s-bootstrap.mjs [options]
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const NAMESPACE = 'hnc-it';
const SERVICE_ACCOUNT = 'hnc-readonly';
const ROLE_NAME = 'hnc-readonly-role';
const ROLE_BINDING_NAME = 'hnc-readonly-binding';
const KUBECONFIG_PATH = './.secrets/hnc-readonly.kubeconfig';

// Command line argument parsing
const args = process.argv.slice(2);
const options = parseArgs(args);

async function main() {
  try {
    console.log('🚢 HNC Kubernetes Bootstrap Tool');
    console.log('=================================\n');

    if (options.help) {
      printUsage();
      return;
    }

    // Check if KUBECONFIG is available
    const kubeconfigPath = process.env.KUBECONFIG;
    if (!kubeconfigPath) {
      console.error('❌ Error: KUBECONFIG environment variable is required');
      console.error('   Set KUBECONFIG to your cluster config file path');
      process.exit(1);
    }

    if (!existsSync(kubeconfigPath)) {
      console.error(`❌ Error: KUBECONFIG file not found: ${kubeconfigPath}`);
      process.exit(1);
    }

    console.log('🔍 Validating Kubernetes connectivity...');
    try {
      execSync('kubectl cluster-info', { stdio: options.verbose ? 'inherit' : 'pipe' });
      console.log('✅ Connected to Kubernetes cluster\n');
    } catch (error) {
      console.error('❌ Failed to connect to Kubernetes cluster');
      console.error('   Check your KUBECONFIG and cluster connectivity');
      process.exit(1);
    }

    // Step 1: Create/ensure namespace exists
    await createNamespace();

    // Step 2: Create/ensure ServiceAccount exists
    await createServiceAccount();

    // Step 3: Create/ensure Role exists
    await createRole();

    // Step 4: Create/ensure RoleBinding exists
    await createRoleBinding();

    // Step 5: Generate kubeconfig
    await generateKubeconfig();

    console.log('\n🎉 Bootstrap completed successfully!');
    console.log(`📁 Kubeconfig saved to: ${resolve(KUBECONFIG_PATH)}`);

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function createNamespace() {
  console.log(`📦 Creating/ensuring namespace '${NAMESPACE}' exists...`);
  
  try {
    // Check if namespace exists
    execSync(`kubectl get namespace ${NAMESPACE}`, { stdio: 'pipe' });
    console.log(`✅ Namespace '${NAMESPACE}' already exists`);
  } catch (error) {
    // Namespace doesn't exist, create it
    try {
      execSync(`kubectl create namespace ${NAMESPACE}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
      console.log(`✅ Created namespace '${NAMESPACE}'`);
    } catch (createError) {
      throw new Error(`Failed to create namespace: ${createError.message}`);
    }
  }
}

async function createServiceAccount() {
  console.log(`👤 Creating/ensuring ServiceAccount '${SERVICE_ACCOUNT}' exists...`);
  
  try {
    // Check if ServiceAccount exists
    execSync(`kubectl get serviceaccount ${SERVICE_ACCOUNT} -n ${NAMESPACE}`, { stdio: 'pipe' });
    console.log(`✅ ServiceAccount '${SERVICE_ACCOUNT}' already exists`);
  } catch (error) {
    // ServiceAccount doesn't exist, create it
    try {
      execSync(`kubectl create serviceaccount ${SERVICE_ACCOUNT} -n ${NAMESPACE}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
      console.log(`✅ Created ServiceAccount '${SERVICE_ACCOUNT}'`);
    } catch (createError) {
      throw new Error(`Failed to create ServiceAccount: ${createError.message}`);
    }
  }
}

async function createRole() {
  console.log(`🔐 Creating/ensuring Role '${ROLE_NAME}' exists...`);
  
  const roleYaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: ${NAMESPACE}
  name: ${ROLE_NAME}
rules:
# HedgeHog wiring CRDs
- apiGroups: ["wiring.githedgehog.com"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
# VPC-related CRDs  
- apiGroups: ["vpc.githedgehog.com"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
# Core resources needed for FGD validation
- apiGroups: [""]
  resources: ["configmaps", "services"]
  verbs: ["get", "list", "watch"]
# Apps resources
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "daemonsets"]
  verbs: ["get", "list", "watch"]
# Networking resources
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies"]
  verbs: ["get", "list", "watch"]
`.trim();

  try {
    // Check if Role exists
    execSync(`kubectl get role ${ROLE_NAME} -n ${NAMESPACE}`, { stdio: 'pipe' });
    console.log(`✅ Role '${ROLE_NAME}' already exists`);
    
    // Update the role to ensure it has latest permissions
    const tempFile = '/tmp/hnc-role.yaml';
    writeFileSync(tempFile, roleYaml);
    execSync(`kubectl apply -f ${tempFile}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
    console.log(`✅ Updated Role '${ROLE_NAME}' permissions`);
  } catch (error) {
    // Role doesn't exist, create it
    try {
      const tempFile = '/tmp/hnc-role.yaml';
      writeFileSync(tempFile, roleYaml);
      execSync(`kubectl apply -f ${tempFile}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
      console.log(`✅ Created Role '${ROLE_NAME}'`);
    } catch (createError) {
      throw new Error(`Failed to create Role: ${createError.message}`);
    }
  }
}

async function createRoleBinding() {
  console.log(`🔗 Creating/ensuring RoleBinding '${ROLE_BINDING_NAME}' exists...`);
  
  const roleBindingYaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${ROLE_BINDING_NAME}
  namespace: ${NAMESPACE}
subjects:
- kind: ServiceAccount
  name: ${SERVICE_ACCOUNT}
  namespace: ${NAMESPACE}
roleRef:
  kind: Role
  name: ${ROLE_NAME}
  apiGroup: rbac.authorization.k8s.io
`.trim();

  try {
    // Check if RoleBinding exists
    execSync(`kubectl get rolebinding ${ROLE_BINDING_NAME} -n ${NAMESPACE}`, { stdio: 'pipe' });
    console.log(`✅ RoleBinding '${ROLE_BINDING_NAME}' already exists`);
    
    // Update the RoleBinding to ensure it's current
    const tempFile = '/tmp/hnc-rolebinding.yaml';
    writeFileSync(tempFile, roleBindingYaml);
    execSync(`kubectl apply -f ${tempFile}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
    console.log(`✅ Updated RoleBinding '${ROLE_BINDING_NAME}'`);
  } catch (error) {
    // RoleBinding doesn't exist, create it
    try {
      const tempFile = '/tmp/hnc-rolebinding.yaml';
      writeFileSync(tempFile, roleBindingYaml);
      execSync(`kubectl apply -f ${tempFile}`, { stdio: options.verbose ? 'inherit' : 'pipe' });
      console.log(`✅ Created RoleBinding '${ROLE_BINDING_NAME}'`);
    } catch (createError) {
      throw new Error(`Failed to create RoleBinding: ${createError.message}`);
    }
  }
}

async function generateKubeconfig() {
  console.log('🔑 Generating dedicated kubeconfig...');
  
  try {
    // Get current cluster info
    const clusterInfo = execSync('kubectl cluster-info', { encoding: 'utf8', stdio: 'pipe' });
    const serverMatch = clusterInfo.match(/Kubernetes control plane.*at\s+(\S+)/);
    if (!serverMatch) {
      throw new Error('Could not extract server URL from cluster info');
    }
    const serverUrl = serverMatch[1];

    // Get cluster name from current context
    const currentContext = execSync('kubectl config current-context', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const clusterName = execSync(`kubectl config view -o jsonpath='{.contexts[?(@.name=="${currentContext}")].context.cluster}'`, { encoding: 'utf8', stdio: 'pipe' }).trim();

    // Get cluster certificate
    const clusterCert = execSync(`kubectl config view --raw -o jsonpath='{.clusters[?(@.name=="${clusterName}")].cluster.certificate-authority-data}'`, { encoding: 'utf8', stdio: 'pipe' }).trim();

    // Get ServiceAccount token (for Kubernetes 1.24+, we need to create a token)
    let token;
    try {
      // Try to create a token (Kubernetes 1.24+)
      token = execSync(`kubectl create token ${SERVICE_ACCOUNT} -n ${NAMESPACE} --duration=8760h`, { encoding: 'utf8', stdio: 'pipe' }).trim();
      console.log('✅ Created long-lived token for ServiceAccount');
    } catch (tokenError) {
      // Fallback to secret-based token (older Kubernetes versions)
      try {
        const secretName = execSync(`kubectl get serviceaccount ${SERVICE_ACCOUNT} -n ${NAMESPACE} -o jsonpath='{.secrets[0].name}'`, { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (secretName) {
          token = execSync(`kubectl get secret ${secretName} -n ${NAMESPACE} -o jsonpath='{.data.token}' | base64 -d`, { encoding: 'utf8', stdio: 'pipe' }).trim();
          console.log('✅ Retrieved token from ServiceAccount secret');
        } else {
          throw new Error('No token available for ServiceAccount');
        }
      } catch (secretError) {
        throw new Error(`Failed to get ServiceAccount token: ${secretError.message}`);
      }
    }

    // Generate kubeconfig
    const kubeconfigContent = {
      apiVersion: 'v1',
      kind: 'Config',
      clusters: [{
        name: 'hnc-cluster',
        cluster: {
          'certificate-authority-data': clusterCert,
          server: serverUrl
        }
      }],
      contexts: [{
        name: 'hnc-readonly-context',
        context: {
          cluster: 'hnc-cluster',
          namespace: NAMESPACE,
          user: 'hnc-readonly-user'
        }
      }],
      'current-context': 'hnc-readonly-context',
      users: [{
        name: 'hnc-readonly-user',
        user: {
          token: token
        }
      }]
    };

    // Ensure .secrets directory exists
    const kubeconfigDir = dirname(resolve(KUBECONFIG_PATH));
    mkdirSync(kubeconfigDir, { recursive: true });

    // Write kubeconfig file
    writeFileSync(KUBECONFIG_PATH, JSON.stringify(kubeconfigContent, null, 2));
    console.log(`✅ Generated kubeconfig at: ${KUBECONFIG_PATH}`);

    // Test the generated kubeconfig
    console.log('🧪 Testing generated kubeconfig...');
    try {
      execSync(`KUBECONFIG=${KUBECONFIG_PATH} kubectl auth can-i list configmaps -n ${NAMESPACE}`, { stdio: 'pipe' });
      console.log('✅ Kubeconfig test successful - can access resources');
    } catch (testError) {
      console.warn('⚠️  Kubeconfig test failed - permissions may not be fully propagated yet');
      console.warn('   This is normal and should resolve within a few seconds');
    }

  } catch (error) {
    throw new Error(`Failed to generate kubeconfig: ${error.message}`);
  }
}

function parseArgs(args) {
  const options = {
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
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
Usage: node tools/k8s-bootstrap.mjs [options]

Description:
  Creates Kubernetes resources needed for HNC readonly access:
  - Namespace: ${NAMESPACE}
  - ServiceAccount: ${SERVICE_ACCOUNT}
  - Role: ${ROLE_NAME} (get/list/watch on wiring.githedgehog.com & vpc.githedgehog.com)
  - RoleBinding: ${ROLE_BINDING_NAME}
  - Kubeconfig: ${KUBECONFIG_PATH}

Options:
  --verbose              Show detailed output
  --help, -h             Show this help message

Requirements:
  KUBECONFIG             Environment variable pointing to cluster config

Examples:
  # Basic bootstrap
  export KUBECONFIG=/path/to/kubeconfig
  node tools/k8s-bootstrap.mjs

  # Verbose output
  node tools/k8s-bootstrap.mjs --verbose

Exit Codes:
  0  Success - all resources created/verified
  1  Error occurred during bootstrap
`);
}

// Run the bootstrap
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});