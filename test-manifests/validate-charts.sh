#!/bin/bash

# Simple chart validation script
set -e

echo "=== HNC Chart Validation ==="

# Test default configuration
echo "Testing default configuration..."
helm template hnc deploy/charts/hnc > test-manifests/default.yaml
echo "✓ Default configuration renders successfully"

# Test development configuration
echo "Testing development configuration..."
helm template hnc deploy/charts/hnc -f deploy/charts/hnc/values-dev.yaml > test-manifests/development.yaml
echo "✓ Development configuration renders successfully"

# Test production configuration
echo "Testing production configuration..."
helm template hnc deploy/charts/hnc -f deploy/charts/hnc/values-prod.yaml > test-manifests/production.yaml
echo "✓ Production configuration renders successfully"

# Test feature flag configurations
echo "Testing feature flag configurations..."
helm template hnc deploy/charts/hnc --set env.FEATURE_GIT=false --set env.FEATURE_K8S=false > test-manifests/no-features.yaml
echo "✓ No features configuration renders successfully"

helm template hnc deploy/charts/hnc --set env.FEATURE_GIT=true --set env.FEATURE_K8S=true --set env.FEATURE_HHFAB=true --set env.FEATURE_GH_PR=true > test-manifests/all-features.yaml
echo "✓ All features configuration renders successfully"

# Validate ArgoCD manifests
echo "Validating ArgoCD manifests..."
kubectl apply --dry-run=client -f deploy/argo/app-of-apps.yaml
kubectl apply --dry-run=client -f deploy/argo/apps/hnc.yaml
echo "✓ ArgoCD manifests are valid"

echo "🎉 All validations passed!"
echo
echo "Generated manifests:"
ls -la test-manifests/
echo
echo "Next steps:"
echo "1. Install on K3s: helm install hnc deploy/charts/hnc -n hnc"
echo "2. Deploy via ArgoCD: kubectl apply -f deploy/argo/app-of-apps.yaml"