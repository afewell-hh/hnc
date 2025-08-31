# HNC Kubernetes Deployment

This directory contains all deployment artifacts for running HNC on Kubernetes with GitOps capabilities.

## Quick Start

### 1. Prerequisites
- Kubernetes cluster (K3s recommended for single-node)
- kubectl configured
- Helm 3.x installed
- ArgoCD (optional, for GitOps)

### 2. Direct Deployment
```bash
# Create namespace
kubectl create namespace hnc

# Deploy with Helm
helm install hnc deploy/charts/hnc -n hnc

# Access application
kubectl port-forward svc/hnc 8080:80 -n hnc
# Visit http://localhost:8080
```

### 3. GitOps Deployment
```bash
# Deploy via ArgoCD
kubectl apply -f deploy/argo/app-of-apps.yaml
```

## Structure

```
deploy/
├── charts/hnc/              # Helm chart
│   ├── Chart.yaml           # Chart metadata
│   ├── values.yaml          # Default configuration
│   ├── values-dev.yaml      # Development overrides
│   ├── values-prod.yaml     # Production overrides
│   └── templates/           # Kubernetes templates
│       ├── deployment.yaml  # Application deployment
│       ├── service.yaml     # Kubernetes service
│       ├── ingress.yaml     # Ingress configuration
│       ├── configmap.yaml   # Environment variables
│       ├── secret.yaml      # Sensitive data
│       └── ...              # Additional resources
├── argo/                    # ArgoCD applications
│   ├── app-of-apps.yaml     # Parent application
│   └── apps/
│       └── hnc.yaml         # HNC application
└── README.md                # This file
```

## Configuration

### Feature Flags

All HNC feature flags are configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_GIT` | `true` | Enable Git integration |
| `FEATURE_K8S` | `true` | Enable Kubernetes features |
| `FEATURE_HHFAB` | `false` | Enable HHFab validation |
| `FEATURE_GH_PR` | `false` | Enable GitHub PR mode |

### Environment-Specific Configurations

- **Development**: `values-dev.yaml` - All features enabled, verbose logging
- **Production**: `values-prod.yaml` - Conservative settings, TLS, autoscaling

### Example Customization

```bash
# Enable all features
helm install hnc deploy/charts/hnc \
  --set env.FEATURE_GIT=true \
  --set env.FEATURE_K8S=true \
  --set env.FEATURE_HHFAB=true \
  --set env.HNC_VERBOSE=true \
  -n hnc

# Production deployment with custom domain
helm install hnc deploy/charts/hnc \
  -f deploy/charts/hnc/values-prod.yaml \
  --set ingress.hosts[0].host=hnc.company.com \
  --set image.repository=your-registry/hnc \
  --set image.tag=v0.5.0 \
  -n hnc
```

## Guides

- [K3s Setup](k3s-setup.md) - Complete single-node cluster setup
- [Helm Deployment](helm-deployment-guide.md) - Detailed Helm usage
- [ArgoCD Setup](argocd-setup.md) - GitOps configuration

## Security

- Non-root container execution
- Read-only root filesystem
- Security contexts applied
- Secret management for sensitive data
- Network policies support

## Monitoring

- Health checks (liveness/readiness probes)
- Metrics exposure ready
- Structured logging
- Resource monitoring

## Support

For deployment issues:

1. Check pod logs: `kubectl logs -f deployment/hnc -n hnc`
2. Verify configuration: `kubectl get configmap hnc-env -n hnc -o yaml`
3. Test connectivity: `kubectl port-forward svc/hnc 8080:80 -n hnc`
4. Review ingress: `kubectl get ingress -n hnc`

The deployment supports both single-node development and production multi-node clusters with full GitOps integration.