# HNC Integration Scripts

This document describes the integration scripts available in the HNC project for GitHub and Kubernetes integrations.

## Overview

The HNC project provides automated integration scripts that help manage:
- GitHub repository operations, pull requests, and CI workflows
- Kubernetes deployments, services, and cluster health monitoring

These scripts are designed to work both in local development environments and CI/CD pipelines.

## Quick Start

### GitHub Integration
```bash
# Basic GitHub integration check
npm run int:gh

# CI-mode GitHub integration (requires environment variables)
npm run int:gh:ci
```

### Kubernetes Integration
```bash
# Basic Kubernetes integration check
npm run int:k8s

# CI-mode Kubernetes integration (requires environment variables)
npm run int:k8s:ci
```

## GitHub Integration (`int:gh`)

### Purpose
The GitHub integration script manages:
- Repository synchronization (pull/push operations)
- Pull Request status and automation
- Issue tracking and references
- GitHub Actions workflow monitoring
- Repository insights and statistics

### Prerequisites

#### Required Tools
- **Git**: For repository operations
- **GitHub CLI (`gh`)**: For GitHub API interactions
  ```bash
  # Install GitHub CLI
  # macOS
  brew install gh
  
  # Ubuntu/Debian
  sudo apt install gh
  
  # Or download from: https://cli.github.com/
  ```

#### Authentication
Choose one of the following authentication methods:

1. **GitHub CLI Authentication (Recommended for local development)**
   ```bash
   gh auth login
   ```

2. **Environment Variable**
   ```bash
   export GITHUB_TOKEN=your_personal_access_token
   # or
   export GH_TOKEN=your_personal_access_token
   ```

### Configuration Options

Set these environment variables to customize behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_PULL` | `false` | Automatically pull remote changes when behind |
| `AUTO_PUSH` | `false` | Automatically push local changes when ahead |
| `AUTO_PR` | `false` | Auto-create PRs for feature branches |
| `AUTO_MERGE` | `false` | Auto-merge PRs when all checks pass |
| `REPO_INSIGHTS` | `false` | Show additional repository statistics |

### Usage Examples

#### Basic Integration Check
```bash
npm run int:gh
```

#### Automated Development Workflow
```bash
# Enable automation features
AUTO_PULL=true AUTO_PUSH=true AUTO_PR=true npm run int:gh
```

#### CI Pipeline Integration
```bash
# In CI environment with full automation
npm run int:gh:ci
```

### Script Behavior

#### Local Environment (CI=false)
- Gracefully handles missing authentication
- Provides helpful setup instructions
- Skips operations if tools are unavailable
- Shows warnings instead of failing

#### CI Environment (CI=true)
- Requires proper authentication
- Fails fast if requirements are not met
- Designed for automated pipeline execution

### Output Example
```
🐙 GitHub Integration Script
=============================
🔍 Checking environment configuration...
✅ GitHub token configured
✅ Repository context validated
📍 Repository: https://github.com/user/hnc

🚀 Running GitHub integrations...
1️⃣ Checking repository sync status...
✅ Branch is up to date with origin/main

2️⃣ Checking Pull Request status...
📋 Active PR #123 for branch 'feature/integration'
   State: OPEN
   ✅ All checks passing

3️⃣ Checking related issues...
🔗 Recent commits reference issues:
   fix: resolve issue with networking #456

4️⃣ Checking GitHub Actions workflows...
ci: success (SUCCESS)

=============================
✅ GitHub integration complete
=============================
```

## Kubernetes Integration (`int:k8s`)

### Purpose
The Kubernetes integration script manages:
- Cluster connectivity and authentication
- Namespace management
- Deployment and service status
- Health checks and monitoring
- Troubleshooting information

### Prerequisites

#### Required Tools
- **kubectl**: Kubernetes command-line tool
  ```bash
  # Install kubectl
  # macOS
  brew install kubectl
  
  # Ubuntu/Debian
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  ```

#### Cluster Configuration
Ensure you have Kubernetes cluster access through one of:

1. **Local kubeconfig**
   ```bash
   # Default location
   ~/.kube/config
   ```

2. **Environment variable**
   ```bash
   export KUBECONFIG=/path/to/your/kubeconfig
   ```

### Configuration Options

Set these environment variables to customize behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `K8S_NAMESPACE` | `hnc-system` | Target Kubernetes namespace |
| `K8S_APP_NAME` | `hnc-wireframe` | Application/deployment name |
| `K8S_IMAGE_TAG` | `latest` | Container image tag |
| `K8S_DRY_RUN` | `false` | Perform dry run operations only |
| `K8S_HEALTH_CHECK` | `true` | Enable cluster health checks |
| `K8S_TROUBLESHOOT` | `false` | Show detailed troubleshooting info |

### Usage Examples

#### Basic Integration Check
```bash
npm run int:k8s
```

#### Custom Namespace Deployment
```bash
K8S_NAMESPACE=production K8S_APP_NAME=hnc-prod npm run int:k8s
```

#### Dry Run Mode
```bash
K8S_DRY_RUN=true npm run int:k8s
```

#### CI Pipeline with Troubleshooting
```bash
K8S_TROUBLESHOOT=true npm run int:k8s:ci
```

### Manifest Structure

The script looks for Kubernetes manifests in these directories (in order):
1. `k8s/`
2. `kubernetes/`
3. `deploy/`

Example directory structure:
```
k8s/
├── namespace.yaml
├── deployment.yaml
├── service.yaml
└── configmap.yaml
```

### Script Behavior

#### Local Environment (CI=false)
- Gracefully handles missing kubectl or cluster access
- Provides helpful setup instructions
- Skips operations if cluster is unreachable
- Shows warnings instead of failing

#### CI Environment (CI=true)
- Requires kubectl and cluster access
- Fails fast if requirements are not met
- Designed for deployment pipelines

### Output Example
```
⚙️ Kubernetes Integration Script
================================
🔍 Checking Kubernetes environment...
🔗 Testing cluster connectivity...
✅ Connected to cluster: minikube

🛠️ Configuration:
   Namespace: hnc-system
   App Name: hnc-wireframe
   Image Tag: latest
   Dry Run: false

🚀 Kubernetes deployment operations...
1️⃣ Checking deployment manifests...
✅ Found manifest directory: k8s
📜 Available manifests:
   k8s/deployment.yaml
   k8s/service.yaml

2️⃣ Applying Kubernetes manifests...
📜 Processing: k8s/deployment.yaml
📜 Processing: k8s/service.yaml

3️⃣ Checking deployment status...
✅ Deployment 'hnc-wireframe' exists
   Replicas: 3/3 ready
   ✅ All replicas are ready

4️⃣ Checking service status...
✅ Service 'hnc-wireframe' exists
   Service type: ClusterIP

5️⃣ Running health checks...
❤️ Cluster health:
   controller-manager: Healthy
   scheduler: Healthy
   etcd-0: Healthy

================================
✅ Kubernetes integration complete
================================
```

## CI/CD Integration

### GitHub Actions

Add to your `.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: 
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      
      # Existing build and test steps
      - run: npm run build
      - run: npm test -- --run
      
      # Integration checks
      - name: GitHub Integration Check
        run: npm run int:gh:ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Kubernetes Integration Check
        run: npm run int:k8s:ci
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
        if: ${{ secrets.KUBECONFIG != '' }}
```

### GitLab CI

Add to your `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - integrate

test:
  stage: test
  script:
    - npm ci
    - npm run build
    - npm test -- --run

github-integration:
  stage: integrate
  script:
    - npm run int:gh:ci
  variables:
    GITHUB_TOKEN: $CI_JOB_TOKEN
  only:
    - merge_requests
    - main

k8s-integration:
  stage: integrate
  script:
    - npm run int:k8s:ci
  variables:
    K8S_NAMESPACE: "hnc-staging"
  only:
    - main
```

## Troubleshooting

### Common Issues

#### GitHub Integration

**Problem**: `gh: command not found`
```bash
# Solution: Install GitHub CLI
brew install gh  # macOS
sudo apt install gh  # Ubuntu
```

**Problem**: `Not authenticated with GitHub CLI`
```bash
# Solution: Authenticate with GitHub
gh auth login
# Follow the interactive prompts
```

**Problem**: `No origin remote configured`
```bash
# Solution: Add origin remote
git remote add origin https://github.com/username/repository.git
```

#### Kubernetes Integration

**Problem**: `kubectl: command not found`
```bash
# Solution: Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/
```

**Problem**: `Cannot connect to Kubernetes cluster`
```bash
# Solution: Check cluster connection
kubectl cluster-info
# Ensure kubeconfig is properly configured
```

**Problem**: `Insufficient permissions`
```bash
# Solution: Check RBAC permissions
kubectl auth can-i '*' '*' --all-namespaces
# Contact cluster administrator if needed
```

### Getting Help

1. **Check script output**: Both scripts provide detailed status information
2. **Enable debug mode**: Set `DEBUG=true` for additional logging
3. **Run dry run**: Use `K8S_DRY_RUN=true` to test Kubernetes operations
4. **Check environment**: Verify all required environment variables are set

## Best Practices

### Security
- Never commit authentication tokens to version control
- Use environment variables or secure secret management
- Regularly rotate access tokens
- Follow principle of least privilege for cluster access

### Development
- Test scripts locally before using in CI
- Use dry run mode when testing new configurations
- Keep integration scripts updated with project changes
- Monitor script execution time in CI pipelines

### Maintenance
- Regularly update kubectl and GitHub CLI tools
- Review and update authentication methods
- Monitor for deprecated Kubernetes API versions
- Keep documentation synchronized with script changes

## Contributing

When modifying integration scripts:

1. **Test both local and CI modes**: Ensure scripts work in both environments
2. **Maintain backward compatibility**: Don't break existing usage patterns
3. **Update documentation**: Keep this guide current with script changes
4. **Add appropriate error handling**: Graceful degradation in local environments
5. **Follow project conventions**: Match existing script patterns and naming

## Support

For issues with integration scripts:

1. Check this documentation first
2. Review script output for specific error messages
3. Verify environment setup and authentication
4. Create an issue with detailed error information and environment details