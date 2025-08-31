# HNC HOSS Deployment Scaffold

This deployment scaffold provides production-ready Kubernetes deployment for HNC with GitOps capabilities.

## 🚀 What's Included

### Helm Chart (`charts/hnc/`)
- Complete Kubernetes deployment templates
- Environment-driven FEATURE_* flags configuration
- Multi-environment support (dev, staging, prod)
- Security best practices (non-root, read-only filesystem)
- Resource management and autoscaling
- Ingress with TLS support
- Persistent storage options

### ArgoCD GitOps (`argo/`)
- App-of-apps deployment pattern
- Automated sync policies
- Multi-environment management
- Git-based configuration management

### Documentation (`docs/deployment/`)
- K3s single-node setup guide
- Comprehensive Helm deployment guide
- ArgoCD setup and configuration
- Troubleshooting procedures

## ✅ Validation Results

All charts and manifests have been validated:

- ✅ Helm chart linting passes
- ✅ Default configuration renders successfully
- ✅ Development configuration renders successfully  
- ✅ Production configuration renders successfully
- ✅ Feature flag configurations work correctly
- ✅ ArgoCD manifests are structurally valid
- ✅ Security contexts properly configured
- ✅ Environment variables properly templated

## 🎯 Key Features

### Environment-Driven Configuration
```yaml
env:
  FEATURE_GIT: "true"      # Git integration
  FEATURE_K8S: "true"      # Kubernetes features
  FEATURE_HHFAB: "false"   # HHFab validation
  FEATURE_GH_PR: "false"   # GitHub PR mode
  HNC_VERBOSE: "false"     # Verbose logging
```

### Multi-Environment Support
- **Development**: All features enabled, verbose logging, larger resources
- **Production**: Conservative settings, autoscaling, TLS, security hardening

### Production-Ready Features
- Non-root container execution
- Read-only root filesystem
- Health checks (liveness/readiness)
- Resource limits and requests
- Horizontal Pod Autoscaling
- Pod Disruption Budgets
- Persistent storage for configurations

## 🚀 Quick Start

### 1. K3s Deployment
```bash
# Install K3s and ArgoCD
curl -sfL https://get.k3s.io | sh -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Deploy HNC via GitOps
kubectl apply -f deploy/argo/app-of-apps.yaml
```

### 2. Direct Helm Deployment
```bash
# Development
helm install hnc deploy/charts/hnc -f deploy/charts/hnc/values-dev.yaml -n hnc

# Production
helm install hnc deploy/charts/hnc -f deploy/charts/hnc/values-prod.yaml -n hnc
```

## 📊 Deployment Statistics

- **Helm Templates**: 9 Kubernetes resource templates
- **Configuration Files**: 4 values files (default, dev, prod, custom)
- **ArgoCD Applications**: 2 GitOps manifests
- **Documentation**: 4 comprehensive guides
- **Validation Scripts**: Automated testing and validation
- **Security Features**: Non-root, read-only filesystem, security contexts
- **Monitoring**: Health checks, resource monitoring, logging

## 🛡️ Security & Production Readiness

### Security Features
- Non-root user execution (UID 1000/10001)
- Read-only root filesystem
- Dropped capabilities
- Security contexts applied
- Secret management for sensitive data

### Production Features
- Horizontal Pod Autoscaling (2-10 replicas)
- Pod Disruption Budget (min 1 available)
- Resource limits and requests
- TLS-enabled ingress with cert-manager
- Persistent storage with proper storage classes
- Health checks with appropriate timeouts

### Monitoring & Observability
- Structured logging support
- Health check endpoints
- Resource usage monitoring
- Event tracking
- Error reporting

## 📁 File Structure
```
deploy/
├── charts/hnc/                    # Helm chart
│   ├── Chart.yaml                 # Chart metadata
│   ├── values.yaml                # Default values
│   ├── values-dev.yaml            # Development overrides
│   ├── values-prod.yaml           # Production overrides
│   ├── NOTES.txt                  # Post-install notes
│   └── templates/                 # Kubernetes templates
│       ├── deployment.yaml        # Main application
│       ├── service.yaml           # Service definition
│       ├── ingress.yaml           # Ingress configuration
│       ├── configmap.yaml         # Environment config
│       ├── secret.yaml            # Sensitive data
│       ├── serviceaccount.yaml    # RBAC service account
│       ├── pvc.yaml               # Persistent storage
│       ├── hpa.yaml               # Autoscaling
│       ├── pdb.yaml               # Disruption budget
│       └── _helpers.tpl           # Template helpers
├── argo/                          # ArgoCD applications
│   ├── app-of-apps.yaml           # Parent application
│   └── apps/
│       └── hnc.yaml               # HNC application
└── README.md                      # This file
```

## 🔧 Customization

### Feature Flags
Override any feature flag at deployment time:
```bash
helm install hnc deploy/charts/hnc \
  --set env.FEATURE_GIT=false \
  --set env.FEATURE_K8S=true \
  --set env.HNC_VERBOSE=true
```

### Custom Images
```bash
helm install hnc deploy/charts/hnc \
  --set image.repository=your-registry/hnc \
  --set image.tag=v0.5.0
```

### Domain Configuration
```bash
helm install hnc deploy/charts/hnc \
  --set ingress.hosts[0].host=hnc.your-domain.com \
  --set ingress.tls[0].secretName=hnc-tls \
  --set ingress.tls[0].hosts[0]=hnc.your-domain.com
```

## 📚 Next Steps

1. **Review Documentation**: Read the comprehensive guides in `docs/deployment/`
2. **Set Up K3s**: Follow the K3s setup guide for single-node deployment
3. **Configure ArgoCD**: Set up GitOps with the ArgoCD configuration guide
4. **Deploy HNC**: Use either direct Helm or GitOps deployment method
5. **Monitor**: Set up monitoring and alerting as needed

This scaffold provides everything needed to deploy HNC on a dedicated ops cluster without runtime code changes, serving built frontend static files with full environment-driven configuration.