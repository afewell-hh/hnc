# HOSS Ops Cluster Deployment Guide

This document provides comprehensive instructions for deploying HNC (Hybrid Network Calculator) on the HOSS (Hedgehog Operations Support System) ops cluster, ensuring proper separation from the ONF controller infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HOSS Ops Cluster                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                GitOps Workflow                          ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ ││
│  │  │   Git Repo  │───▶│   ArgoCD    │───▶│    HNC      │ ││
│  │  │             │    │             │    │ Application │ ││
│  │  └─────────────┘    └─────────────┘    └─────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Infrastructure Services                    ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     ││
│  │  │   Ingress   │  │ cert-manager│  │  Monitoring │     ││
│  │  │   NGINX     │  │             │  │ Prometheus  │     ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ONF Controller                             │
│              (Separate Infrastructure)                      │
│                     Not Modified                           │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Principles

### HOSS Ops Cluster Isolation

- **Separate Infrastructure**: HNC runs on dedicated HOSS ops cluster
- **No ONF Controller Dependencies**: Independent of ONF controller systems
- **Ops-Focused**: Designed for operations team workflows
- **GitOps Enabled**: Automated deployment and management

### Key Features

- **Environment-Driven Configuration**: Feature flags via environment variables
- **Secure Secrets Management**: Kubernetes native secret handling
- **High Availability**: Production-ready with redundancy
- **Monitoring Integration**: Prometheus metrics and health checks
- **TLS Support**: Certificate management with cert-manager
- **Ingress Configuration**: External access with NGINX

## Prerequisites

### HOSS Ops Cluster Requirements

- **Kubernetes Version**: 1.19+ (k3s, k8s, or managed Kubernetes)
- **Ingress Controller**: NGINX Ingress Controller
- **Certificate Management**: cert-manager (for TLS)
- **GitOps**: ArgoCD installed and configured
- **Storage**: Persistent volume support
- **Resources**: Minimum 2 CPU cores, 4GB RAM

### Network Requirements

- **External Access**: Ingress capability for web UI access
- **Container Registry Access**: Pull images from ghcr.io
- **Git Repository Access**: Access to HNC repository
- **DNS Configuration**: Proper DNS resolution for ingress hosts

## Deployment Methods

### Method 1: GitOps with ArgoCD (Recommended)

#### Step 1: Deploy ArgoCD App-of-Apps

```bash
# Ensure ArgoCD is installed and running
kubectl get pods -n argocd

# Deploy the App-of-Apps pattern
kubectl apply -f https://raw.githubusercontent.com/afewell/hnc/main/deploy/argo/app-of-apps.yaml

# Verify application is created
kubectl get applications -n argocd
```

#### Step 2: Configure Secrets

```bash
# Create namespace for HNC
kubectl create namespace hnc

# Create GitHub token secret (if GitHub integration needed)
kubectl create secret generic hnc-github-token \
  --from-literal=token='ghp_your_github_token_here' \
  --namespace=hnc

# Create registry pull secret (if using private registry)
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=your-username \
  --docker-password=your-token \
  --docker-email=your-email \
  --namespace=hnc
```

#### Step 3: Monitor Deployment

```bash
# Check ArgoCD application status
kubectl get applications hnc -n argocd

# Monitor deployment progress
kubectl get pods -n hnc -w

# Check application health
kubectl get ingress -n hnc
```

### Method 2: Direct Helm Deployment

#### Step 1: Prepare Environment

```bash
# Clone repository
git clone https://github.com/afewell/hnc.git
cd hnc

# Create namespace
kubectl create namespace hnc

# Configure secrets (same as GitOps method)
kubectl create secret generic hnc-github-token \
  --from-literal=token='your-github-token' \
  --namespace=hnc
```

#### Step 2: Install with Helm

```bash
# Install Helm chart
helm upgrade --install hnc deploy/charts/hnc \
  --namespace hnc \
  --create-namespace \
  --values deploy/charts/hnc/values.yaml \
  --set app.environment=ops \
  --set app.cluster.type=hoss \
  --set app.cluster.name=ops-cluster \
  --set image.tag="0.4.0-alpha" \
  --set secrets.github.enabled=true \
  --set secrets.github.existingSecret=hnc-github-token
```

#### Step 3: Verify Deployment

```bash
# Check deployment status
kubectl get all -n hnc

# Check ingress
kubectl get ingress -n hnc

# Test health endpoint
kubectl exec -n hnc deployment/hnc -- curl -s http://localhost:80/health
```

## Configuration for HOSS Environment

### Production Configuration (values-prod.yaml)

Key configuration items for HOSS ops cluster:

```yaml
# HOSS-specific application configuration
app:
  environment: prod
  cluster:
    type: hoss
    name: ops-cluster-prod
    isolation: true

# Production image configuration
image:
  repository: ghcr.io/afewell/hnc
  tag: "0.4.0-alpha"
  pullPolicy: Always
  pullSecrets:
    - name: ghcr-secret

# High availability setup
replicaCount: 2

# Production ingress with TLS
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: hnc-ops.hedgehog.fabric
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: hnc-ops-tls-cert
      hosts:
        - hnc-ops.hedgehog.fabric

# Feature flags for ops cluster
env:
  FEATURE_GIT: "true"
  FEATURE_K8S: "true"
  FEATURE_HHFAB: "true"
  FEATURE_GH_PR: "true"
  FEATURE_VALIDATION: "true"
  FEATURE_MONITORING: "true"
  K8S_CLUSTER_NAME: "hoss-ops-prod"
```

### Environment Variables for HOSS

```bash
# HOSS-specific environment variables
NODE_ENV=production
K8S_CLUSTER_NAME=hoss-ops
K8S_NAMESPACE=hnc
FEATURE_K8S=true
FEATURE_MONITORING=true
```

## Security Configuration

### RBAC Configuration

```yaml
# ServiceAccount with minimal permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hnc
  namespace: hnc
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: hnc-role
  namespace: hnc
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: hnc-rolebinding
  namespace: hnc
subjects:
- kind: ServiceAccount
  name: hnc
  namespace: hnc
roleRef:
  kind: Role
  name: hnc-role
  apiGroup: rbac.authorization.k8s.io
```

### Pod Security Context

```yaml
# Hardened security context
podSecurityContext:
  fsGroup: 65534
  runAsNonRoot: true
  runAsUser: 65534
  seccompProfile:
    type: RuntimeDefault

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 65534
```

## Monitoring and Observability

### Prometheus Metrics

HNC exposes metrics for monitoring:

```yaml
# Pod annotations for Prometheus scraping
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
  prometheus.io/path: "/metrics"
```

### Health Checks

```yaml
# Comprehensive health checks
healthCheck:
  enabled: true
  livenessProbe:
    httpGet:
      path: /health
      port: http
    initialDelaySeconds: 60
    periodSeconds: 30
  readinessProbe:
    httpGet:
      path: /health
      port: http
    initialDelaySeconds: 30
    periodSeconds: 10
  startupProbe:
    httpGet:
      path: /health
      port: http
    initialDelaySeconds: 10
    periodSeconds: 10
    failureThreshold: 30
```

### Logging Configuration

```yaml
env:
  LOG_LEVEL: "warn"          # Production logging level
  LOG_FORMAT: "json"         # Structured logging
  METRICS_ENABLED: "true"    # Enable metrics collection
```

## High Availability Configuration

### Pod Disruption Budget

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

### Anti-Affinity Rules

```yaml
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

### Autoscaling

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

## Persistence Configuration

### Data Persistence

```yaml
persistence:
  enabled: true
  storageClass: "fast-ssd"     # Use appropriate storage class
  accessMode: ReadWriteOnce
  size: 20Gi
  mountPath: /app/data
```

### Backup Strategy

```bash
# Regular backup of persistent data
kubectl create cronjob hnc-backup \
  --image=alpine:latest \
  --schedule="0 2 * * *" \
  --restart=OnFailure \
  -- /bin/sh -c 'kubectl exec -n hnc deployment/hnc -- tar -czf - /app/data | kubectl exec -i -n backup deployment/backup-storage -- tar -xzf -'
```

## Network Configuration

### Ingress Configuration

```yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    # TLS configuration
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    
    # Security headers
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Performance optimizations
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    
    # Rate limiting
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
  
  hosts:
    - host: hnc-ops.hedgehog.fabric
      paths:
        - path: /
          pathType: Prefix
  
  tls:
    - secretName: hnc-ops-tls-cert
      hosts:
        - hnc-ops.hedgehog.fabric
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hnc-network-policy
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
    ports:
    - protocol: TCP
      port: 80
  egress:
  - {}  # Allow all egress (adjust as needed)
```

## Operational Procedures

### Deployment Process

1. **Pre-deployment Checks**:
   ```bash
   # Verify cluster health
   kubectl get nodes
   kubectl get pods -A | grep -E "(nginx|argocd|cert-manager)"
   
   # Check resource availability
   kubectl top nodes
   kubectl describe nodes
   ```

2. **Deployment**:
   ```bash
   # Deploy via ArgoCD
   kubectl apply -f deploy/argo/app-of-apps.yaml
   
   # Monitor deployment
   kubectl get applications -n argocd -w
   kubectl get pods -n hnc -w
   ```

3. **Post-deployment Verification**:
   ```bash
   # Test application health
   curl -k https://hnc-ops.hedgehog.fabric/health
   
   # Check metrics
   curl -k https://hnc-ops.hedgehog.fabric/metrics
   
   # Verify persistence
   kubectl exec -n hnc deployment/hnc -- ls -la /app/data
   ```

### Maintenance Procedures

#### Rolling Updates

```bash
# Update image tag via ArgoCD or Helm
helm upgrade hnc deploy/charts/hnc \
  --namespace hnc \
  --reuse-values \
  --set image.tag="0.4.1-alpha"

# Monitor rollout
kubectl rollout status deployment/hnc -n hnc
```

#### Configuration Updates

```bash
# Update configuration via ConfigMap
kubectl patch configmap hnc-config -n hnc -p '{"data":{"FEATURE_GH_PR":"true"}}'

# Restart deployment to pick up changes
kubectl rollout restart deployment/hnc -n hnc
```

#### Certificate Renewal

```bash
# Check certificate expiration
kubectl get certificate -n hnc

# Force certificate renewal (if needed)
kubectl delete certificaterequest -n hnc --all
```

### Troubleshooting

#### Common Issues

1. **Pod Startup Issues**:
   ```bash
   kubectl describe pod -n hnc -l app.kubernetes.io/name=hnc
   kubectl logs -n hnc -l app.kubernetes.io/name=hnc --tail=100
   ```

2. **Ingress Issues**:
   ```bash
   kubectl describe ingress hnc -n hnc
   kubectl get endpoints -n hnc
   ```

3. **ArgoCD Sync Issues**:
   ```bash
   kubectl describe application hnc -n argocd
   kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
   ```

#### Health Checks

```bash
# Application health
kubectl exec -n hnc deployment/hnc -- wget -qO- http://localhost:80/health

# Resource utilization
kubectl top pods -n hnc

# Storage usage
kubectl exec -n hnc deployment/hnc -- df -h /app/data
```

## Disaster Recovery

### Backup Procedures

```bash
# Backup Kubernetes manifests
kubectl get all,ingress,configmap,secret -n hnc -o yaml > hnc-backup-$(date +%Y%m%d).yaml

# Backup persistent data
kubectl exec -n hnc deployment/hnc -- tar -czf - /app/data > hnc-data-backup-$(date +%Y%m%d).tar.gz
```

### Recovery Procedures

```bash
# Restore from backup
kubectl apply -f hnc-backup-YYYYMMDD.yaml

# Restore data (if needed)
kubectl exec -n hnc deployment/hnc -- tar -xzf - -C /app/data < hnc-data-backup-YYYYMMDD.tar.gz
```

## Performance Tuning

### Resource Optimization

```yaml
# Production resource limits
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 256Mi

# Performance-related environment variables
env:
  MAX_CONCURRENT_VALIDATIONS: "5"
  CACHE_TTL: "7200"
  PLAYWRIGHT_MAX_WORKERS: "2"
```

### Storage Performance

```yaml
# Use high-performance storage class
persistence:
  storageClass: "fast-ssd"
  size: 20Gi

# Enable storage optimizations
annotations:
  volume.beta.kubernetes.io/storage-provisioner: rancher.io/local-path
```

## Support and Maintenance

### Monitoring Dashboard

Access monitoring dashboards:
- **Application**: https://hnc-ops.hedgehog.fabric
- **ArgoCD**: https://argocd.hoss.local
- **Metrics**: https://hnc-ops.hedgehog.fabric/metrics

### Log Aggregation

```bash
# Centralized logging with structured logs
kubectl logs -n hnc -l app.kubernetes.io/name=hnc --tail=100 -f | jq .
```

### Support Contacts

- **Repository**: https://github.com/afewell/hnc
- **Issues**: https://github.com/afewell/hnc/issues
- **Documentation**: https://github.com/afewell/hnc/tree/main/docs

---

This deployment guide ensures HNC is properly isolated on the HOSS ops cluster while maintaining production-grade reliability, security, and operational excellence.