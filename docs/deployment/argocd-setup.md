# ArgoCD Setup and GitOps Configuration for HNC

This guide covers setting up ArgoCD for GitOps deployment of HNC with the app-of-apps pattern.

## Overview

ArgoCD provides continuous deployment for Kubernetes applications with Git as the source of truth. This setup enables:

- Automated deployments from Git repositories
- Multi-environment management
- Rollback capabilities
- Drift detection and correction
- GitOps best practices

## Prerequisites

- Kubernetes cluster (K3s recommended)
- kubectl configured and working
- Helm 3.x installed
- Git repository with HNC chart

## ArgoCD Installation

### 1. Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for deployment
kubectl wait --for=condition=available --timeout=600s \
  deployment/argocd-server -n argocd
```

### 2. Access ArgoCD UI

#### Method 1: Port Forward

```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access UI at https://localhost:8080
# Username: admin
# Password: (from command above)
```

#### Method 2: Ingress (Recommended)

```yaml
# argocd-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    nginx.ingress.kubernetes.io/server-snippet: |
      grpc_read_timeout 300;
      grpc_send_timeout 300;
      client_body_timeout 60;
      client_header_timeout 60;
      client_max_body_size 1m;
spec:
  rules:
  - host: argocd.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
```

```bash
# Apply ingress
kubectl apply -f argocd-ingress.yaml

# Add to /etc/hosts
echo "127.0.0.1 argocd.local" | sudo tee -a /etc/hosts

# Access at https://argocd.local
```

### 3. ArgoCD CLI Installation

```bash
# Download ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Login via CLI
argocd login argocd.local --username admin --password $ARGOCD_PASSWORD
```

## Repository Configuration

### 1. Add Git Repository

#### Via UI:
1. Go to Settings → Repositories
2. Click "Connect Repo using HTTPS"
3. Enter repository URL: `https://github.com/your-org/hnc`
4. Add credentials if private repo

#### Via CLI:
```bash
# Public repository
argocd repo add https://github.com/your-org/hnc

# Private repository
argocd repo add https://github.com/your-org/hnc \
  --username your-username \
  --password your-token
```

### 2. Verify Repository

```bash
# List repositories
argocd repo list

# Test repository connectivity
argocd repo get https://github.com/your-org/hnc
```

## Application Deployment Patterns

### Pattern 1: App-of-Apps (Recommended)

The app-of-apps pattern manages multiple applications from a single parent application.

#### Deploy App-of-Apps

```bash
# Apply the parent application
kubectl apply -f deploy/argo/app-of-apps.yaml

# Verify deployment
kubectl get applications -n argocd
```

#### Sync Applications

```bash
# Sync all applications
argocd app sync hnc-app-of-apps

# Sync individual application
argocd app sync hnc
```

### Pattern 2: Direct Application

Deploy HNC as a single application:

```bash
# Apply application directly
kubectl apply -f deploy/argo/apps/hnc.yaml

# Sync application
argocd app sync hnc
```

## Multi-Environment Setup

### Environment Structure

```
deploy/argo/
├── app-of-apps.yaml           # Parent application
├── environments/
│   ├── dev/
│   │   └── hnc.yaml          # Development environment
│   ├── staging/
│   │   └── hnc.yaml          # Staging environment
│   └── production/
│       └── hnc.yaml          # Production environment
└── apps/
    └── hnc.yaml              # Base application template
```

### Development Environment

```yaml
# deploy/argo/environments/dev/hnc.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hnc-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/hnc
    targetRevision: develop
    path: deploy/charts/hnc
    helm:
      valueFiles:
        - values.yaml
        - values-dev.yaml
      parameters:
        - name: env.HNC_VERBOSE
          value: "true"
        - name: env.FEATURE_GH_PR
          value: "true"
  destination:
    server: https://kubernetes.default.svc
    namespace: hnc-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Production Environment

```yaml
# deploy/argo/environments/production/hnc.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hnc-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/hnc
    targetRevision: main
    path: deploy/charts/hnc
    helm:
      valueFiles:
        - values.yaml
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: hnc-prod
  syncPolicy:
    automated:
      prune: false  # Manual approval for production
      selfHeal: false
    syncOptions:
      - CreateNamespace=true
```

## ArgoCD Projects

### Create Project for HNC

```yaml
# hnc-project.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: hnc
  namespace: argocd
spec:
  description: HNC Application Project
  
  # Git repositories
  sourceRepos:
  - https://github.com/your-org/hnc
  
  # Destination clusters
  destinations:
  - namespace: hnc*
    server: https://kubernetes.default.svc
  - namespace: argocd
    server: https://kubernetes.default.svc
  
  # Allowed Kubernetes resources
  clusterResourceWhitelist:
  - group: ""
    kind: Namespace
  - group: rbac.authorization.k8s.io
    kind: ClusterRole
  - group: rbac.authorization.k8s.io
    kind: ClusterRoleBinding
  
  namespaceResourceWhitelist:
  - group: ""
    kind: "*"
  - group: apps
    kind: "*"
  - group: networking.k8s.io
    kind: "*"
  - group: autoscaling
    kind: "*"
  
  # RBAC roles
  roles:
  - name: developer
    description: Developer access
    policies:
    - p, proj:hnc:developer, applications, get, hnc/*, allow
    - p, proj:hnc:developer, applications, sync, hnc/*, allow
    groups:
    - developers
  
  - name: admin
    description: Admin access
    policies:
    - p, proj:hnc:admin, applications, *, hnc/*, allow
    - p, proj:hnc:admin, repositories, *, hnc/*, allow
    groups:
    - admins
```

```bash
# Apply project
kubectl apply -f hnc-project.yaml
```

## Monitoring and Observability

### Application Health

```bash
# Check application status
argocd app get hnc

# Check application health
kubectl get applications -n argocd -o wide

# Describe application for events
kubectl describe application hnc -n argocd
```

### Sync Status

```bash
# Check sync status
argocd app list

# Get sync history
argocd app history hnc

# Check last sync operation
kubectl get application hnc -n argocd -o jsonpath='{.status.operationState}'
```

### Resource Management

```bash
# List managed resources
argocd app resources hnc

# Get resource details
kubectl get all -n hnc -o wide

# Check resource events
kubectl get events -n hnc --sort-by=.metadata.creationTimestamp
```

## GitOps Workflows

### Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Modify chart or application
# Edit deploy/charts/hnc/values.yaml
# Or deploy/argo/apps/hnc.yaml

# 3. Commit changes
git add deploy/
git commit -m "feat: add new feature configuration"
git push origin feature/new-feature

# 4. Create PR and merge to develop
# ArgoCD will automatically sync dev environment

# 5. Promote to production
git checkout main
git merge develop
git push origin main
# Production sync (manual approval required)
```

### Rollback Procedure

```bash
# Via ArgoCD CLI
argocd app rollback hnc

# Via kubectl
kubectl patch application hnc -n argocd \
  -p '{"operation":{"info":[{"name":"rollback","value":"true"}]}}' \
  --type merge

# Check rollback status
argocd app get hnc
```

### Configuration Updates

```bash
# Update environment variables
kubectl patch application hnc -n argocd \
  -p '{"spec":{"source":{"helm":{"parameters":[{"name":"env.FEATURE_GIT","value":"false"}]}}}}' \
  --type merge

# Sync changes
argocd app sync hnc
```

## Security Configuration

### RBAC Setup

```yaml
# argocd-rbac-cm.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    # Admin users
    p, role:admin, applications, *, */*, allow
    p, role:admin, clusters, *, *, allow
    p, role:admin, repositories, *, *, allow
    g, admins, role:admin
    
    # Developer users
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, applications, action/*, */*, allow
    g, developers, role:developer
```

### SSO Integration (Optional)

```yaml
# argocd-cmd.yaml - OIDC example
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd
  namespace: argocd
data:
  oidc.config: |
    name: OIDC
    issuer: https://your-oidc-provider.com
    clientId: argocd
    clientSecret: $oidc.clientSecret
    requestedScopes: ["openid", "profile", "email", "groups"]
```

## Troubleshooting

### Common Issues

#### 1. Sync Failures

```bash
# Check application logs
kubectl logs -n argocd deployment/argocd-application-controller

# Check repository connectivity
argocd repo list
argocd repo get https://github.com/your-org/hnc

# Force refresh
argocd app get hnc --refresh
```

#### 2. Helm Template Errors

```bash
# Test chart rendering locally
helm template hnc deploy/charts/hnc --debug

# Check application spec
kubectl get application hnc -n argocd -o yaml

# Review ArgoCD server logs
kubectl logs -n argocd deployment/argocd-server
```

#### 3. Permission Issues

```bash
# Check RBAC configuration
kubectl get configmap argocd-rbac-cm -n argocd -o yaml

# Verify service account permissions
kubectl auth can-i get pods --as=system:serviceaccount:argocd:argocd-application-controller
```

#### 4. Resource Conflicts

```bash
# Check for resource conflicts
kubectl get events -n hnc --field-selector reason=FailedCreate

# Review application conditions
kubectl get application hnc -n argocd -o jsonpath='{.status.conditions}'

# Manual resource cleanup
kubectl delete -f deploy/charts/hnc/templates/ -n hnc
argocd app sync hnc
```

### Debug Commands

```bash
# Enable debug logging
kubectl patch configmap argocd-cmd -n argocd \
  -p '{"data":{"application.instanceLabelKey":"argocd.argoproj.io/instance","server.log.level":"debug"}}'

# Restart ArgoCD server
kubectl rollout restart deployment/argocd-server -n argocd

# Check debug logs
kubectl logs -f deployment/argocd-server -n argocd
```

This completes the ArgoCD setup and GitOps configuration for HNC. The system now supports automated deployments with proper monitoring and troubleshooting capabilities.