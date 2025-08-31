# HNC Helm Chart Deployment Guide

This guide covers deploying HNC using the Helm chart with various configuration options.

## Chart Overview

The HNC Helm chart provides a production-ready deployment of the Hybrid Network Calculator with:

- Configurable feature flags via environment variables
- Multi-environment support (dev, staging, prod)
- GitOps integration with ArgoCD
- Security best practices
- Monitoring and observability hooks

## Chart Structure

```
deploy/charts/hnc/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration
├── values-dev.yaml         # Development overrides
├── values-prod.yaml        # Production overrides
└── templates/
    ├── deployment.yaml     # Main application deployment
    ├── service.yaml        # Kubernetes service
    ├── ingress.yaml        # Ingress configuration
    ├── configmap.yaml      # Environment configuration
    ├── secret.yaml         # Sensitive data (tokens, etc.)
    ├── serviceaccount.yaml # RBAC service account
    ├── pvc.yaml           # Persistent storage
    ├── hpa.yaml           # Horizontal Pod Autoscaler
    ├── pdb.yaml           # Pod Disruption Budget
    └── _helpers.tpl       # Template helpers
```

## Configuration

### Feature Flags

The chart supports all HNC feature flags through environment variables:

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GIT` | `true` | Enable Git integration features |
| `FEATURE_K8S` | `true` | Enable Kubernetes integration |
| `FEATURE_HHFAB` | `false` | Enable HHFab CLI validation |
| `FEATURE_GH_PR` | `false` | Enable GitHub PR mode |

### Environment Variables

```yaml
env:
  # Core Configuration
  HNC_VERBOSE: "false"
  
  # Feature Flags
  FEATURE_GIT: "true"
  FEATURE_K8S: "true"
  FEATURE_HHFAB: "false"
  FEATURE_GH_PR: "false"
  
  # Integration Settings
  GITHUB_TOKEN: ""          # Set via secrets
  GIT_REMOTE: "origin"
  KUBECONFIG: ""
  
  # Validation
  HHFAB: "/usr/local/bin/hhfab"
  TEST_FGD_FILE: "test-output/test-fabric.yaml"
  TEST_K8S_NAMESPACE: "hnc-test"
  
  # Performance
  PLAYWRIGHT_MAX_WORKERS: "1"
  VITEST_MAX_WORKERS: "4"
```

## Deployment Methods

### 1. Direct Helm Deployment

#### Basic Deployment

```bash
# Create namespace
kubectl create namespace hnc

# Install with default values
helm install hnc deploy/charts/hnc -n hnc

# Verify deployment
kubectl get pods -n hnc
```

#### Development Deployment

```bash
# Deploy with development configuration
helm install hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-dev.yaml \
  -n hnc

# Enable all features for development
helm install hnc deploy/charts/hnc \
  --set env.FEATURE_GIT=true \
  --set env.FEATURE_K8S=true \
  --set env.FEATURE_HHFAB=true \
  --set env.FEATURE_GH_PR=true \
  --set env.HNC_VERBOSE=true \
  -n hnc
```

#### Production Deployment

```bash
# Deploy with production configuration
helm install hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-prod.yaml \
  -n hnc

# With custom image
helm install hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-prod.yaml \
  --set image.repository=your-registry.com/hnc \
  --set image.tag=v0.5.0 \
  -n hnc
```

### 2. ArgoCD GitOps Deployment

#### App-of-Apps Pattern

```bash
# Deploy the app-of-apps
kubectl apply -f deploy/argo/app-of-apps.yaml

# Check application status
kubectl get applications -n argocd

# Force sync if needed
kubectl patch application hnc -n argocd \
  -p '{"operation":{"sync":{}}}' --type merge
```

#### Direct Application

```bash
# Deploy single application
kubectl apply -f deploy/argo/apps/hnc.yaml

# Monitor sync status
kubectl describe application hnc -n argocd
```

## Configuration Examples

### GitHub Integration

For GitHub features, configure secrets:

```yaml
# values.yaml
secrets:
  github:
    enabled: true
    token: "ghp_your_github_token_here"

env:
  FEATURE_GH_PR: "true"
  GIT_REMOTE: "origin"
```

Or using kubectl:

```bash
# Create secret separately
kubectl create secret generic hnc-github \
  --from-literal=token=ghp_your_token \
  -n hnc

# Reference in values
helm install hnc deploy/charts/hnc \
  --set secrets.github.enabled=true \
  -n hnc
```

### Custom Domain and TLS

```yaml
# values.yaml
ingress:
  enabled: true
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: hnc.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: hnc-tls
      hosts:
        - hnc.example.com
```

### Persistent Storage

```yaml
# values.yaml
persistence:
  enabled: true
  storageClass: "gp2"
  accessMode: ReadWriteOnce
  size: 10Gi
  mountPath: /app/data
```

### High Availability

```yaml
# values.yaml
replicaCount: 3

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

podDisruptionBudget:
  enabled: true
  minAvailable: 1

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - hnc
        topologyKey: kubernetes.io/hostname
```

## Monitoring and Observability

### Health Checks

The chart includes comprehensive health checks:

```yaml
healthCheck:
  enabled: true
  livenessProbe:
    httpGet:
      path: /
      port: http
    initialDelaySeconds: 30
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /
      port: http
    initialDelaySeconds: 5
    periodSeconds: 5
```

### Metrics and Logging

```bash
# Check pod logs
kubectl logs -f deployment/hnc -n hnc

# Multiple pods with label selector
kubectl logs -f -l app.kubernetes.io/name=hnc -n hnc

# Previous pod logs (for crash investigation)
kubectl logs deployment/hnc -n hnc --previous
```

## Upgrade Procedures

### Rolling Updates

```bash
# Upgrade with new image
helm upgrade hnc deploy/charts/hnc \
  --set image.tag=v0.5.1 \
  -n hnc

# Upgrade with new values
helm upgrade hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-prod.yaml \
  -n hnc

# Check upgrade status
helm list -n hnc
kubectl rollout status deployment/hnc -n hnc
```

### Rollback

```bash
# View release history
helm history hnc -n hnc

# Rollback to previous version
helm rollback hnc -n hnc

# Rollback to specific revision
helm rollback hnc 2 -n hnc
```

## Troubleshooting

### Common Issues

#### 1. ImagePullBackOff

```bash
# Check image repository and tags
kubectl describe pod -l app.kubernetes.io/name=hnc -n hnc

# Verify image exists
docker pull your-registry.com/hnc:v0.5.0
```

#### 2. Configuration Issues

```bash
# Check environment variables
kubectl exec deployment/hnc -n hnc -- printenv | grep FEATURE

# Verify ConfigMap
kubectl get configmap hnc-env -n hnc -o yaml

# Check secrets
kubectl get secret hnc-github -n hnc -o yaml
```

#### 3. Ingress Problems

```bash
# Check ingress status
kubectl get ingress -n hnc
kubectl describe ingress hnc -n hnc

# Test service directly
kubectl port-forward svc/hnc 8080:80 -n hnc
curl http://localhost:8080
```

#### 4. Storage Issues

```bash
# Check PVC status
kubectl get pvc -n hnc
kubectl describe pvc hnc-data -n hnc

# Check storage class
kubectl get storageclass
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
helm upgrade hnc deploy/charts/hnc \
  --set env.HNC_VERBOSE=true \
  -n hnc

# Check detailed logs
kubectl logs -f deployment/hnc -n hnc
```

## Security Best Practices

### 1. Use Secrets for Sensitive Data

```yaml
# Don't store tokens in values.yaml
secrets:
  github:
    enabled: true
    # Use external secret management
```

### 2. Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hnc-netpol
  namespace: hnc
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: hnc
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
```

### 3. Security Context

The chart includes secure defaults:

```yaml
securityContext:
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000

podSecurityContext:
  fsGroup: 2000
```

## Performance Tuning

### Resource Limits

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

### Horizontal Pod Autoscaling

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

This guide provides comprehensive coverage of deploying and managing HNC using Helm charts in various environments.