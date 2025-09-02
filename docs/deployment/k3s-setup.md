# K3s Single-Node Setup for HNC

This guide walks through setting up a single-node K3s cluster optimized for running HNC with ArgoCD.

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- 2GB+ RAM, 2+ CPU cores
- 20GB+ available disk space
- Root or sudo access
- curl and basic utilities

## K3s Installation

### 1. Install K3s

```bash
# Install K3s with embedded registry and default storage class
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -

# Verify installation
sudo k3s kubectl get nodes
```

### 2. Configure kubectl

```bash
# Set up kubectl for current user
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config

# Test kubectl access
kubectl get nodes
```

### 3. Install NGINX Ingress Controller

```bash
# Deploy NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/baremetal/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 4. Configure Local DNS (Optional)

Add entries to `/etc/hosts` for local development:

```bash
# Add to /etc/hosts
127.0.0.1 hnc.local
127.0.0.1 hnc-dev.local
127.0.0.1 argocd.local
```

## ArgoCD Installation

### 1. Install ArgoCD

```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=600s deployment/argocd-server -n argocd
```

### 2. Access ArgoCD UI

```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo

# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Navigate to `https://localhost:8080` and login with:
- Username: `admin`
- Password: (from command above)

### 3. Configure ArgoCD Ingress (Optional)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
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

## Helm Installation

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installation
helm version
```

## Deploy HNC

### 1. Clone Repository

```bash
git clone https://github.com/your-org/hnc.git
cd hnc
```

### 2. Test Helm Chart Rendering

```bash
# Test default values
helm template hnc deploy/charts/hnc

# Test with development values
helm template hnc deploy/charts/hnc -f deploy/charts/hnc/values-dev.yaml

# Test with production values
helm template hnc deploy/charts/hnc -f deploy/charts/hnc/values-prod.yaml
```

### 3. Deploy via Helm (Direct)

```bash
# Create namespace
kubectl create namespace hnc

# Deploy with development settings
helm upgrade --install hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-dev.yaml \
  -n hnc

# Verify deployment
kubectl get pods -n hnc
kubectl get ingress -n hnc
```

### 4. Deploy via ArgoCD (Recommended)

```bash
# Apply app-of-apps pattern
kubectl apply -f deploy/argo/app-of-apps.yaml

# Sync applications
kubectl get applications -n argocd
```

## Configuration

### Environment Variables

The HNC chart supports extensive environment-based configuration:

```yaml
# Core feature flags
FEATURE_GIT: "true"      # Enable Git integration
FEATURE_K8S: "true"      # Enable Kubernetes integration
FEATURE_HHFAB: "false"   # Enable HHFab validation
FEATURE_GH_PR: "false"   # Enable GitHub PR mode

# GitHub integration
GITHUB_TOKEN: ""         # GitHub API token (use secret)
GIT_REMOTE: "origin"     # Git remote name

# Kubernetes configuration
KUBECONFIG: ""           # Path to kubeconfig (optional)
TEST_K8S_NAMESPACE: "hnc-test"

# Performance tuning
PLAYWRIGHT_MAX_WORKERS: "1"
VITEST_MAX_WORKERS: "4"
```

### Secrets Management

For sensitive data like GitHub tokens:

```bash
# Create secret manually
kubectl create secret generic hnc-github \
  --from-literal=token=your-github-token \
  -n hnc

# Or use Helm values
helm upgrade --install hnc deploy/charts/hnc \
  --set secrets.github.enabled=true \
  --set secrets.github.token=your-github-token \
  -n hnc
```

## Monitoring and Troubleshooting

### Check Pod Status

```bash
# Get pod status
kubectl get pods -n hnc

# Check pod logs
kubectl logs -n hnc deployment/hnc

# Describe pod for events
kubectl describe pod -n hnc -l app.kubernetes.io/name=hnc
```

### Verify Ingress

```bash
# Check ingress status
kubectl get ingress -n hnc

# Test local access
curl -H "Host: hnc.local" http://localhost
```

### ArgoCD Sync Issues

```bash
# Check application status
kubectl get applications -n argocd

# Force sync
kubectl patch application hnc -n argocd -p '{"operation":{"sync":{}}}' --type merge

# Check sync status
kubectl describe application hnc -n argocd
```

### Resource Monitoring

```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n hnc

# Check persistent volumes
kubectl get pv,pvc -n hnc
```

## Upgrade and Maintenance

### Update HNC

```bash
# Pull latest changes
git pull origin main

# Upgrade via Helm
helm upgrade hnc deploy/charts/hnc -f deploy/charts/hnc/values-dev.yaml -n hnc

# Or sync via ArgoCD
kubectl patch application hnc -n argocd -p '{"operation":{"sync":{}}}' --type merge
```

### Backup Configuration

```bash
# Export current values
helm get values hnc -n hnc > hnc-backup-values.yaml

# Backup persistent data (if enabled)
kubectl exec -n hnc deployment/hnc -- tar czf - /app/data > hnc-data-backup.tar.gz
```

## Security Considerations

### Network Policies

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
    ports:
    - protocol: TCP
      port: 80
```

### RBAC

The chart creates minimal RBAC permissions. For K8s integration features, additional permissions may be needed:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: hnc-k8s-access
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
```

## Troubleshooting Common Issues

### 1. Pod CrashLoopBackOff

```bash
# Check container logs
kubectl logs -n hnc deployment/hnc --previous

# Common causes:
# - Missing environment variables
# - Invalid configuration
# - Resource constraints
```

### 2. Ingress Not Working

```bash
# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify ingress class
kubectl get ingressclass

# Test direct service access
kubectl port-forward -n hnc svc/hnc 8080:80
```

### 3. ArgoCD Sync Failures

```bash
# Check repository access
kubectl exec -n argocd deployment/argocd-repo-server -- \
  git ls-remote https://github.com/your-org/hnc.git

# Refresh repository
kubectl patch application hnc -n argocd -p '{"operation":{"info":[{"name":"refresh","value":"hard"}]}}' --type merge
```

This completes the K3s setup guide for HNC deployment. The cluster is now ready to run HNC with full GitOps capabilities via ArgoCD.