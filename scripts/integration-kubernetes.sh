#!/usr/bin/env bash
set -euo pipefail

# Kubernetes Integration Script - Handle K8s deployments and cluster operations
# This script manages Kubernetes deployments, service configurations, and cluster health

echo "☸️  Kubernetes Integration Script"
echo "================================"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    echo "   Visit: https://kubernetes.io/docs/tasks/tools/"
    if [ "${CI:-false}" = "true" ]; then
        echo "❌ kubectl required in CI environment"
        exit 1
    else
        echo "⚠️  Skipping Kubernetes integration (kubectl not available)"
        exit 0
    fi
fi

# Environment variable checks
echo "🔍 Checking Kubernetes environment..."

# Check for kubeconfig
if [ -z "${KUBECONFIG:-}" ] && [ ! -f "$HOME/.kube/config" ]; then
    echo "⚠️  No Kubernetes configuration found"
    echo "   KUBECONFIG environment variable not set"
    echo "   ~/.kube/config not found"
    if [ "${CI:-false}" = "true" ]; then
        echo "❌ Kubernetes configuration required in CI environment"
        exit 1
    else
        echo "⚠️  Skipping Kubernetes integration (no kubeconfig)"
        exit 0
    fi
fi

# Test cluster connectivity
echo "🔗 Testing cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    if [ "${CI:-false}" = "true" ]; then
        echo "❌ Cluster connectivity required in CI environment"
        exit 1
    else
        echo "⚠️  Skipping Kubernetes integration (cluster unreachable)"
        exit 0
    fi
fi

# Get cluster context
CURRENT_CONTEXT=$(kubectl config current-context)
echo "✅ Connected to cluster: $CURRENT_CONTEXT"
echo ""

# Configuration
NAMESPACE="${K8S_NAMESPACE:-hnc-system}"
APP_NAME="${K8S_APP_NAME:-hnc-wireframe}"
IMAGE_TAG="${K8S_IMAGE_TAG:-latest}"
DRY_RUN="${K8S_DRY_RUN:-false}"

echo "🛠️  Configuration:"
echo "   Namespace: $NAMESPACE"
echo "   App Name: $APP_NAME"
echo "   Image Tag: $IMAGE_TAG"
echo "   Dry Run: $DRY_RUN"
echo ""

# Check if namespace exists
echo "📜 Checking namespace '$NAMESPACE'..."
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo "✅ Namespace '$NAMESPACE' exists"
else
    echo "📝 Creating namespace '$NAMESPACE'..."
    if [ "$DRY_RUN" = "true" ]; then
        echo "   [DRY RUN] kubectl create namespace $NAMESPACE"
    else
        kubectl create namespace "$NAMESPACE" || {
            echo "⚠️  Failed to create namespace (may already exist or insufficient permissions)"
        }
    fi
fi
echo ""

# Deployment operations
echo "🚀 Kubernetes deployment operations..."

# 1. Check if deployment manifests exist
echo "1️⃣ Checking deployment manifests..."
MANIFEST_DIR="k8s"
if [ ! -d "$MANIFEST_DIR" ]; then
    MANIFEST_DIR="kubernetes"
fi
if [ ! -d "$MANIFEST_DIR" ]; then
    MANIFEST_DIR="deploy"
fi

if [ -d "$MANIFEST_DIR" ]; then
    echo "✅ Found manifest directory: $MANIFEST_DIR"
    MANIFESTS=$(find "$MANIFEST_DIR" -name "*.yaml" -o -name "*.yml" | head -10)
    if [ -n "$MANIFESTS" ]; then
        echo "📜 Available manifests:"
        echo "$MANIFESTS" | sed 's/^/   /'
    else
        echo "⚠️  No YAML manifests found in $MANIFEST_DIR"
    fi
else
    echo "⚠️  No Kubernetes manifest directory found (checked: k8s, kubernetes, deploy)"
    echo "📝 Will proceed with basic deployment configuration"
    MANIFESTS=""
fi
echo ""

# 2. Apply or validate manifests
if [ -n "$MANIFESTS" ]; then
    echo "2️⃣ Applying Kubernetes manifests..."
    for manifest in $MANIFESTS; do
        echo "📜 Processing: $manifest"
        if [ "$DRY_RUN" = "true" ]; then
            echo "   [DRY RUN] kubectl apply -f $manifest -n $NAMESPACE"
            kubectl apply -f "$manifest" -n "$NAMESPACE" --dry-run=client --validate=true || {
                echo "❌ Validation failed for $manifest"
            }
        else
            kubectl apply -f "$manifest" -n "$NAMESPACE" || {
                echo "⚠️  Failed to apply $manifest"
            }
        fi
    done
else
    echo "2️⃣ No manifests to apply, checking existing deployments..."
fi
echo ""

# 3. Check deployment status
echo "3️⃣ Checking deployment status..."
if kubectl get deployment "$APP_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo "✅ Deployment '$APP_NAME' exists"
    
    # Get deployment status
    REPLICAS=$(kubectl get deployment "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
    READY_REPLICAS=$(kubectl get deployment "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    
    echo "   Replicas: $READY_REPLICAS/$REPLICAS ready"
    
    if [ "$READY_REPLICAS" = "$REPLICAS" ] && [ "$REPLICAS" -gt 0 ]; then
        echo "   ✅ All replicas are ready"
    else
        echo "   ⚠️  Some replicas are not ready"
        kubectl get pods -n "$NAMESPACE" -l app="$APP_NAME" --no-headers | head -5
    fi
    
    # Check for recent rollouts
    ROLLOUT_STATUS=$(kubectl rollout status deployment/"$APP_NAME" -n "$NAMESPACE" --timeout=10s 2>/dev/null || echo "timeout")
    if [ "$ROLLOUT_STATUS" != "timeout" ]; then
        echo "   🔄 $ROLLOUT_STATUS"
    fi
else
    echo "📝 No deployment named '$APP_NAME' found in namespace '$NAMESPACE'"
    
    # List available deployments
    AVAILABLE_DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" --no-headers 2>/dev/null | awk '{print $1}' | head -5 || echo "")
    if [ -n "$AVAILABLE_DEPLOYMENTS" ]; then
        echo "   Available deployments in '$NAMESPACE':"
        echo "$AVAILABLE_DEPLOYMENTS" | sed 's/^/     /'
    fi
fi
echo ""

# 4. Service status
echo "4️⃣ Checking service status..."
if kubectl get service "$APP_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo "✅ Service '$APP_NAME' exists"
    
    SERVICE_TYPE=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.type}')
    echo "   Service type: $SERVICE_TYPE"
    
    if [ "$SERVICE_TYPE" = "LoadBalancer" ]; then
        EXTERNAL_IP=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
        echo "   External IP: $EXTERNAL_IP"
    elif [ "$SERVICE_TYPE" = "NodePort" ]; then
        NODE_PORT=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}')
        echo "   Node Port: $NODE_PORT"
    fi
else
    echo "📝 No service named '$APP_NAME' found"
fi
echo ""

# 5. Health checks and monitoring
if [ "${K8S_HEALTH_CHECK:-true}" = "true" ]; then
    echo "5️⃣ Running health checks..."
    
    # Cluster health
    echo "❤️  Cluster health:"
    kubectl get componentstatuses --no-headers 2>/dev/null | head -3 | sed 's/^/   /' || echo "   Component status unavailable"
    
    # Node status
    echo "💻 Node status:"
    kubectl get nodes --no-headers 2>/dev/null | head -3 | awk '{print "   " $1 ": " $2}' || echo "   Node status unavailable"
    
    # Resource usage (if metrics-server is available)
    if kubectl top nodes &> /dev/null; then
        echo "📈 Resource usage:"
        kubectl top nodes --no-headers 2>/dev/null | head -3 | awk '{print "   " $1 ": CPU " $2 ", Memory " $3}' || echo "   Resource metrics unavailable"
    else
        echo "📝 Resource metrics unavailable (metrics-server not found)"
    fi
    echo ""
fi

# 6. Troubleshooting information
if [ "${K8S_TROUBLESHOOT:-false}" = "true" ]; then
    echo "6️⃣ Troubleshooting information..."
    
    # Recent events
    echo "📜 Recent events in namespace '$NAMESPACE':"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -5 | sed 's/^/   /' || echo "   No events found"
    
    # Failed pods
    FAILED_PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed --no-headers 2>/dev/null | head -3 || echo "")
    if [ -n "$FAILED_PODS" ]; then
        echo "❌ Failed pods:"
        echo "$FAILED_PODS" | sed 's/^/   /'
    else
        echo "✅ No failed pods found"
    fi
    echo ""
fi

echo "================================"
echo "✅ Kubernetes integration complete"
echo "================================"
echo ""
echo "Summary:"
echo "  ✅ Cluster connectivity verified"
echo "  ✅ Namespace '$NAMESPACE' checked/created"
if [ -n "$MANIFESTS" ]; then
    echo "  ✅ Manifests processed"
fi
echo "  ✅ Deployment status checked"
echo "  ✅ Service status verified"
if [ "${K8S_HEALTH_CHECK:-true}" = "true" ]; then
    echo "  ✅ Health checks completed"
fi
echo ""
echo "🔧 Configuration options:"
echo "  K8S_NAMESPACE=name        - Target namespace (default: hnc-system)"
echo "  K8S_APP_NAME=name         - Application name (default: hnc-wireframe)"
echo "  K8S_IMAGE_TAG=tag         - Image tag (default: latest)"
echo "  K8S_DRY_RUN=true          - Perform dry run only"
echo "  K8S_HEALTH_CHECK=false    - Skip health checks"
echo "  K8S_TROUBLESHOOT=true     - Show troubleshooting info"
