# K3s Single-Node Bootstrap Guide for HNC HOSS Deployment

This guide provides comprehensive instructions for setting up a single-node k3s cluster for deploying HNC (Hybrid Network Calculator) on the HOSS (Hedgehog Operations Support System) ops cluster.

## Overview

This deployment is designed for:
- **HOSS ops cluster** - Separate from ONF controller infrastructure
- **Single-node k3s** - Simple, lightweight Kubernetes for development/testing
- **GitOps workflow** - Using ArgoCD for deployment automation
- **Environment-driven configuration** - Feature flags via environment variables

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04 LTS or newer (recommended)
- **CPU**: 2 cores minimum (4 cores recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 20GB free space minimum (50GB recommended)
- **Network**: Internet access for pulling container images

### Required Tools

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git jq

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## K3s Installation

### Step 1: Install K3s

```bash
# Install k3s with specific configuration for HNC
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server" sh -s - \
  --disable traefik \
  --disable servicelb \
  --disable metrics-server \
  --write-kubeconfig-mode 644 \
  --cluster-domain cluster.local \
  --cluster-dns 10.43.0.10 \
  --kube-controller-manager-arg bind-address=0.0.0.0 \
  --kube-proxy-arg metrics-bind-address=0.0.0.0 \
  --kube-scheduler-arg bind-address=0.0.0.0

# Verify installation
sudo systemctl status k3s

# Configure kubectl for current user
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config

# Verify cluster is ready
kubectl get nodes
kubectl get pods -A
```

### Step 2: Install NGINX Ingress Controller

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/baremetal/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Verify ingress controller
kubectl get pods -n ingress-nginx
```

### Step 3: Configure Local DNS (Optional)

```bash
# Add local DNS entries for development
sudo tee -a /etc/hosts <<EOF
127.0.0.1 hnc.hoss.local
127.0.0.1 hnc.k3s.local
127.0.0.1 argocd.k3s.local
EOF
```

### Step 4: Install ArgoCD

```bash
# Create argocd namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Get ArgoCD admin password
ARGO_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD admin password: $ARGO_PASSWORD"

# Create ingress for ArgoCD (optional)
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/backend-protocol: "GRPC"
spec:
  ingressClassName: nginx
  rules:
  - host: argocd.k3s.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 80
EOF
```

### Step 5: Install cert-manager (for TLS support)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager

# Create a self-signed issuer for development
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-issuer
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@hedgehog-fabric.com
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@hedgehog-fabric.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## HNC Deployment Setup

### Step 1: Clone HNC Repository

```bash
# Clone the repository
git clone https://github.com/afewell/hnc.git
cd hnc
```

### Step 2: Configure Environment Variables

Create a secrets file for sensitive configuration:

```bash
# Create namespace for HNC
kubectl create namespace hnc

# Create GitHub token secret (if GitHub integration is needed)
# Replace 'your-github-token' with actual token
kubectl create secret generic hnc-github-token \
  --from-literal=token='your-github-token' \
  --namespace=hnc

# Verify secret
kubectl get secrets -n hnc
```

### Step 3: Deploy using ArgoCD App-of-Apps

```bash
# Apply the app-of-apps pattern
kubectl apply -f deploy/argo/app-of-apps.yaml

# Verify applications are created
kubectl get applications -n argocd

# Check application status
kubectl get applications hnc -n argocd -o yaml
```

### Step 4: Manual Helm Deployment (Alternative)

If you prefer manual deployment without ArgoCD:

```bash
# Install Helm (if not already installed)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Deploy HNC using Helm
helm upgrade --install hnc deploy/charts/hnc \
  --namespace hnc \
  --create-namespace \
  --values deploy/charts/hnc/values.yaml \
  --set image.tag="0.4.0-alpha" \
  --set ingress.hosts[0].host="hnc.hoss.local"
```

## Configuration Management

### Environment Variables

HNC supports environment-driven feature flags:

```bash
# Core feature flags
FEATURE_GIT=true          # Enable Git integration
FEATURE_K8S=true          # Enable Kubernetes validation
FEATURE_HHFAB=true        # Enable HHFab validation
FEATURE_GH_PR=false       # Enable GitHub PR integration
FEATURE_VALIDATION=true   # Enable validation features
FEATURE_PERSISTENCE=true  # Enable data persistence
FEATURE_MONITORING=true   # Enable monitoring/metrics

# GitHub integration
GITHUB_TOKEN=<token>      # GitHub API token
GITHUB_OWNER=afewell      # GitHub repository owner
GITHUB_REPO=hnc           # GitHub repository name

# Kubernetes configuration
K8S_NAMESPACE=hnc         # Kubernetes namespace
K8S_CLUSTER_NAME=hoss-ops # Cluster identifier
```

### Override Configuration

Create custom values file:

```yaml
# custom-values.yaml
app:
  environment: dev
  cluster:
    type: hoss
    name: my-ops-cluster

image:
  tag: "latest"

env:
  FEATURE_GH_PR: "true"
  HNC_VERBOSE: "true"

secrets:
  github:
    enabled: true
    existingSecret: "hnc-github-token"
```

Deploy with custom configuration:

```bash
helm upgrade --install hnc deploy/charts/hnc \
  --namespace hnc \
  --create-namespace \
  --values deploy/charts/hnc/values.yaml \
  --values custom-values.yaml
```

## Accessing HNC

### Local Access

1. **Direct Port Forward**:
   ```bash
   kubectl port-forward -n hnc service/hnc 8080:80
   # Access at http://localhost:8080
   ```

2. **Via Ingress** (if configured):
   ```bash
   # Access at http://hnc.hoss.local or http://hnc.k3s.local
   curl http://hnc.hoss.local/health
   ```

### ArgoCD Access

1. **Port Forward**:
   ```bash
   kubectl port-forward -n argocd service/argocd-server 8080:443
   # Access at https://localhost:8080
   ```

2. **Via Ingress** (if configured):
   ```bash
   # Access at http://argocd.k3s.local
   # Username: admin
   # Password: (retrieved earlier)
   ```

## Monitoring and Troubleshooting

### Health Checks

```bash
# Check HNC deployment status
kubectl get deployments -n hnc
kubectl get pods -n hnc
kubectl describe pod -n hnc -l app.kubernetes.io/name=hnc

# Check ingress status
kubectl get ingress -n hnc

# Check application logs
kubectl logs -n hnc -l app.kubernetes.io/name=hnc --tail=100
```

### Common Issues

1. **Pod not starting**:
   ```bash
   kubectl describe pod -n hnc <pod-name>
   kubectl logs -n hnc <pod-name>
   ```

2. **Ingress not working**:
   ```bash
   kubectl get ingress -n hnc
   kubectl describe ingress -n hnc hnc
   ```

3. **ArgoCD sync issues**:
   ```bash
   kubectl get applications -n argocd
   kubectl describe application hnc -n argocd
   ```

## Maintenance

### Updating HNC

```bash
# Update via ArgoCD (automatic if auto-sync enabled)
# Or manually sync via ArgoCD UI

# Update via Helm
helm upgrade hnc deploy/charts/hnc \
  --namespace hnc \
  --values deploy/charts/hnc/values.yaml \
  --set image.tag="new-version"
```

### Backup Configuration

```bash
# Backup Kubernetes resources
kubectl get all -n hnc -o yaml > hnc-backup.yaml

# Backup persistent data (if persistence enabled)
kubectl exec -n hnc deployment/hnc -- tar -czf - /app/data > hnc-data-backup.tar.gz
```

### Cleanup

```bash
# Remove HNC deployment
helm uninstall hnc -n hnc
kubectl delete namespace hnc

# Remove ArgoCD applications
kubectl delete -f deploy/argo/app-of-apps.yaml

# Uninstall k3s completely
sudo /usr/local/bin/k3s-uninstall.sh
```

## Security Considerations

1. **Network Security**:
   - Configure firewall rules for necessary ports only
   - Use TLS for production deployments
   - Implement network policies

2. **Authentication**:
   - Configure proper RBAC
   - Use service accounts with minimal permissions
   - Rotate secrets regularly

3. **Data Security**:
   - Enable encryption at rest for persistent volumes
   - Use sealed secrets or external secret management
   - Regular security updates

## Production Deployment Notes

For production deployments on HOSS:

1. Use `values-prod.yaml` configuration
2. Enable TLS with valid certificates
3. Configure proper resource limits and requests
4. Implement monitoring and alerting
5. Set up backup and disaster recovery procedures
6. Use external secret management (e.g., Vault)
7. Configure multi-node cluster for high availability

## Support

- **Documentation**: [HNC GitHub Repository](https://github.com/afewell/hnc)
- **Issues**: [GitHub Issues](https://github.com/afewell/hnc/issues)
- **Helm Chart**: Located in `deploy/charts/hnc/`
- **ArgoCD Apps**: Located in `deploy/argo/`