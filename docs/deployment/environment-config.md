# HNC Environment Configuration Guide

This guide provides comprehensive documentation for configuring HNC (Hybrid Network Calculator) using environment variables and feature flags for different deployment scenarios on HOSS ops clusters.

## Overview

HNC uses environment-driven configuration to enable/disable features and adapt to different deployment environments:

- **Feature Flags**: Toggle major functionality on/off
- **Environment Variables**: Configure behavior and integration settings
- **Secrets Management**: Secure handling of sensitive data
- **Multi-Environment Support**: Development, staging, and production configurations

## Core Environment Variables

### Application Configuration

```bash
# Application environment
NODE_ENV=production              # Environment: development, staging, production
HNC_VERBOSE=false               # Enable verbose logging
PORT=80                         # Application port (container internal)

# HOSS cluster configuration
K8S_NAMESPACE=hnc               # Kubernetes namespace for deployment
K8S_CLUSTER_NAME=hoss-ops       # HOSS cluster identifier
```

### Data and Storage

```bash
# Directory configuration
DATA_DIR=/app/data              # Persistent data directory
CONFIG_DIR=/app/config          # Configuration files directory
CACHE_DIR=/app/cache           # Cache directory

# Cache configuration
CACHE_TTL=3600                 # Cache time-to-live in seconds
```

## Feature Flags

Feature flags allow enabling/disabling major functionality based on deployment requirements:

### Core Features

```bash
# Git integration
FEATURE_GIT=true               # Enable Git repository operations
GIT_REMOTE=origin              # Git remote name

# Kubernetes integration
FEATURE_K8S=true               # Enable Kubernetes validation and deployment
KUBECONFIG=/etc/kubeconfig/config  # Kubeconfig file path (if using custom)

# Validation features
FEATURE_VALIDATION=true        # Enable configuration validation
FEATURE_HHFAB=true            # Enable HHFab CLI integration
HHFAB=/usr/local/bin/hhfab    # HHFab binary path
HHFAB_CONFIG=/etc/hhfab/config.yaml  # HHFab configuration file
```

### GitHub Integration

```bash
# GitHub features
FEATURE_GH_PR=false           # Enable GitHub Pull Request integration
GITHUB_OWNER=afewell          # GitHub repository owner
GITHUB_REPO=hnc               # GitHub repository name
GITHUB_TOKEN=<token>          # GitHub API token (via secret)
```

### Monitoring and Observability

```bash
# Monitoring features
FEATURE_MONITORING=true       # Enable monitoring endpoints
FEATURE_METRICS=true         # Enable metrics collection
METRICS_ENABLED=true         # Enable Prometheus metrics
METRICS_PORT=9090            # Metrics server port
HEALTH_CHECK_PATH=/health    # Health check endpoint path

# Logging configuration
LOG_LEVEL=info               # Logging level: debug, info, warn, error
LOG_FORMAT=json             # Log format: json, text
```

### Performance and Limits

```bash
# Concurrency limits
MAX_CONCURRENT_VALIDATIONS=3  # Maximum parallel validation operations
PLAYWRIGHT_MAX_WORKERS=1      # Playwright test concurrency
VITEST_MAX_WORKERS=4         # Vitest concurrency

# Timeout configuration
TEST_TIMEOUT=30000           # Test timeout in milliseconds
```

## Environment-Specific Configurations

### Development Environment

```bash
# Development-specific settings
NODE_ENV=development
HNC_VERBOSE=true
LOG_LEVEL=debug

# Feature flags for development
FEATURE_GIT=true
FEATURE_K8S=false            # Disable K8s for local development
FEATURE_HHFAB=false          # Disable HHFab if not available locally
FEATURE_GH_PR=false          # Disable GitHub PR for local development
FEATURE_VALIDATION=true
FEATURE_MONITORING=true

# Development paths
DATA_DIR=./data
CONFIG_DIR=./config
CACHE_DIR=./cache

# Performance settings for development
MAX_CONCURRENT_VALIDATIONS=1
PLAYWRIGHT_MAX_WORKERS=1
CACHE_TTL=300                # Shorter cache for development
```

### Staging Environment

```bash
# Staging environment settings
NODE_ENV=staging
HNC_VERBOSE=false
LOG_LEVEL=info

# Feature flags for staging
FEATURE_GIT=true
FEATURE_K8S=true
FEATURE_HHFAB=true
FEATURE_GH_PR=false          # Test without PR integration first
FEATURE_VALIDATION=true
FEATURE_MONITORING=true
FEATURE_METRICS=true

# Staging cluster configuration
K8S_NAMESPACE=hnc-staging
K8S_CLUSTER_NAME=hoss-ops-staging

# Moderate performance settings
MAX_CONCURRENT_VALIDATIONS=2
CACHE_TTL=1800
```

### Production Environment

```bash
# Production environment settings
NODE_ENV=production
HNC_VERBOSE=false
LOG_LEVEL=warn

# Feature flags for production
FEATURE_GIT=true
FEATURE_K8S=true
FEATURE_HHFAB=true
FEATURE_GH_PR=true           # Enable all features in production
FEATURE_VALIDATION=true
FEATURE_MONITORING=true
FEATURE_METRICS=true

# Production cluster configuration
K8S_NAMESPACE=hnc-prod
K8S_CLUSTER_NAME=hoss-ops-prod

# Production performance settings
MAX_CONCURRENT_VALIDATIONS=5
CACHE_TTL=7200               # Longer cache for production
PLAYWRIGHT_MAX_WORKERS=2
VITEST_MAX_WORKERS=4
```

## Secrets Management

### GitHub Integration Secrets

Create Kubernetes secrets for GitHub integration:

```bash
# Create GitHub token secret
kubectl create secret generic hnc-github-token \
  --from-literal=token='ghp_your_token_here' \
  --namespace=hnc

# Verify secret creation
kubectl get secret hnc-github-token -n hnc -o yaml
```

### Custom Kubeconfig (Multi-cluster scenarios)

```bash
# Create kubeconfig secret for external cluster access
kubectl create secret generic hnc-kubeconfig \
  --from-file=config=/path/to/external/kubeconfig \
  --namespace=hnc
```

### TLS Certificates

```bash
# Create TLS certificate secret
kubectl create secret tls hnc-tls-cert \
  --cert=/path/to/tls.crt \
  --key=/path/to/tls.key \
  --namespace=hnc
```

## Helm Chart Configuration

### Basic Configuration

```yaml
# values.yaml override
env:
  NODE_ENV: "production"
  FEATURE_GIT: "true"
  FEATURE_K8S: "true"
  FEATURE_HHFAB: "true"
  FEATURE_GH_PR: "false"
  HNC_VERBOSE: "false"
  LOG_LEVEL: "info"

secrets:
  github:
    enabled: true
    existingSecret: "hnc-github-token"
    existingSecretKey: "token"
```

### Production Configuration

```yaml
# values-prod.yaml
app:
  environment: prod
  cluster:
    type: hoss
    name: ops-cluster-prod

env:
  NODE_ENV: "production"
  LOG_LEVEL: "warn"
  FEATURE_GH_PR: "true"
  MAX_CONCURRENT_VALIDATIONS: "5"
  CACHE_TTL: "7200"

secrets:
  github:
    enabled: true
    existingSecret: "hnc-github-token"
  
  tls:
    enabled: true
    existingSecret: "hnc-tls-cert"
```

### ArgoCD Configuration

```yaml
# In ArgoCD application manifest
helm:
  values: |
    env:
      FEATURE_GIT: "true"
      FEATURE_K8S: "true"
      K8S_CLUSTER_NAME: "hoss-ops"
    
    secrets:
      github:
        enabled: true
        existingSecret: "hnc-github-token"
```

## Configuration Validation

### Environment Variable Validation

HNC validates environment variables on startup:

```bash
# Required variables (will cause startup failure if missing)
NODE_ENV                    # Must be: development, staging, production
PORT                        # Must be valid port number

# Feature flag validation
FEATURE_*                   # Must be: true, false, 1, 0

# Path validation
DATA_DIR                    # Must be accessible directory
CONFIG_DIR                  # Must be accessible directory
HHFAB                       # Must be executable file (if FEATURE_HHFAB=true)
```

### Configuration Testing

Test configuration before deployment:

```bash
# Dry-run with Helm to validate configuration
helm template hnc deploy/charts/hnc \
  --values deploy/charts/hnc/values.yaml \
  --set env.NODE_ENV=production \
  --set env.FEATURE_GH_PR=true

# Validate ArgoCD application
kubectl apply --dry-run=client -f deploy/argo/apps/hnc.yaml
```

## Troubleshooting Configuration Issues

### Common Configuration Problems

1. **Invalid Feature Flags**:
   ```bash
   # Check pod logs for validation errors
   kubectl logs -n hnc deployment/hnc | grep -i "invalid\|error\|warn"
   ```

2. **Missing Secrets**:
   ```bash
   # Verify secrets exist
   kubectl get secrets -n hnc
   kubectl describe secret hnc-github-token -n hnc
   ```

3. **Permission Issues**:
   ```bash
   # Check service account permissions
   kubectl describe serviceaccount hnc -n hnc
   kubectl auth can-i --list --as=system:serviceaccount:hnc:hnc
   ```

### Configuration Debugging

Enable verbose logging for configuration debugging:

```yaml
env:
  HNC_VERBOSE: "true"
  LOG_LEVEL: "debug"
```

### Health Check Configuration

```bash
# Check application health with current configuration
kubectl exec -n hnc deployment/hnc -- curl -s http://localhost:80/health

# Check configuration endpoint (if available)
kubectl exec -n hnc deployment/hnc -- curl -s http://localhost:80/config
```

## Best Practices

### Security

1. **Never hardcode secrets** in configuration files
2. **Use Kubernetes secrets** for sensitive data
3. **Rotate secrets regularly**
4. **Use least privilege principle** for service accounts
5. **Enable TLS** for production deployments

### Performance

1. **Tune concurrency settings** based on cluster resources
2. **Set appropriate cache TTL** values
3. **Monitor resource usage** and adjust limits
4. **Use resource quotas** to prevent resource exhaustion

### Maintainability

1. **Document environment-specific configurations**
2. **Use consistent naming conventions**
3. **Version control configuration changes**
4. **Test configurations** in lower environments first
5. **Implement configuration validation**

### GitOps Integration

1. **Store configurations** in Git repositories
2. **Use ArgoCD applications** for deployment
3. **Implement configuration drift detection**
4. **Use sealed secrets** or external secret management
5. **Automate configuration updates** through CI/CD

## Configuration Examples

### Complete Development Setup

```bash
# .env file for local development
NODE_ENV=development
HNC_VERBOSE=true
LOG_LEVEL=debug

FEATURE_GIT=true
FEATURE_K8S=false
FEATURE_HHFAB=false
FEATURE_GH_PR=false
FEATURE_VALIDATION=true
FEATURE_MONITORING=true

DATA_DIR=./data
CONFIG_DIR=./config
CACHE_DIR=./cache

GITHUB_OWNER=afewell
GITHUB_REPO=hnc
# GITHUB_TOKEN set via environment or secret

MAX_CONCURRENT_VALIDATIONS=1
CACHE_TTL=300
```

### Complete Production Setup

```yaml
# Kubernetes ConfigMap for production
apiVersion: v1
kind: ConfigMap
metadata:
  name: hnc-config
  namespace: hnc
data:
  NODE_ENV: "production"
  LOG_LEVEL: "warn"
  FEATURE_GIT: "true"
  FEATURE_K8S: "true"
  FEATURE_HHFAB: "true"
  FEATURE_GH_PR: "true"
  FEATURE_VALIDATION: "true"
  FEATURE_MONITORING: "true"
  FEATURE_METRICS: "true"
  K8S_CLUSTER_NAME: "hoss-ops-prod"
  K8S_NAMESPACE: "hnc-prod"
  MAX_CONCURRENT_VALIDATIONS: "5"
  CACHE_TTL: "7200"
  GITHUB_OWNER: "afewell"
  GITHUB_REPO: "hnc"
```

## Support and References

- **Environment Variables**: See `.env.example` in repository root
- **Helm Values**: See `deploy/charts/hnc/values.yaml`
- **Production Values**: See `deploy/charts/hnc/values-prod.yaml`
- **ArgoCD Configuration**: See `deploy/argo/apps/hnc.yaml`
- **Issues**: [GitHub Issues](https://github.com/afewell/hnc/issues)