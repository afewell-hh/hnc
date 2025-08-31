#!/bin/bash

# HNC Deployment Validation Script
# Validates Helm charts and ArgoCD manifests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHART_DIR="$PROJECT_ROOT/deploy/charts/hnc"
ARGO_DIR="$PROJECT_ROOT/deploy/argo"

echo "=== HNC Deployment Validation ==="
echo "Project Root: $PROJECT_ROOT"
echo "Chart Directory: $CHART_DIR"
echo "ArgoCD Directory: $ARGO_DIR"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed. Please install Helm 3.x"
        exit 1
    fi
    
    if ! command -v kubectl &> /dev/null; then
        log_warn "kubectl is not installed. Some validations will be skipped"
    fi
    
    HELM_VERSION=$(helm version --short 2>/dev/null | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)
    log_info "Helm version: $HELM_VERSION"
}

# Validate chart structure
validate_chart_structure() {
    log_info "Validating chart structure..."
    
    local required_files=(
        "Chart.yaml"
        "values.yaml"
        "values-dev.yaml"
        "values-prod.yaml"
        "templates/deployment.yaml"
        "templates/service.yaml"
        "templates/ingress.yaml"
        "templates/configmap.yaml"
        "templates/_helpers.tpl"
        "NOTES.txt"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$CHART_DIR/$file" ]]; then
            log_info "✓ Found $file"
        else
            log_error "✗ Missing $file"
            exit 1
        fi
    done
}

# Run Helm lint
run_helm_lint() {
    log_info "Running Helm lint..."
    
    if helm lint "$CHART_DIR"; then
        log_info "✓ Chart passes lint checks"
    else
        log_error "✗ Chart fails lint checks"
        exit 1
    fi
}

# Test chart rendering
test_chart_rendering() {
    log_info "Testing chart rendering..."
    
    local test_cases=(
        "default::"
        "development::-f $CHART_DIR/values-dev.yaml"
        "production::-f $CHART_DIR/values-prod.yaml"
        "all-features::--set env.FEATURE_GIT=true --set env.FEATURE_K8S=true --set env.FEATURE_HHFAB=true --set env.FEATURE_GH_PR=true"
        "no-features::--set env.FEATURE_GIT=false --set env.FEATURE_K8S=false --set env.FEATURE_HHFAB=false --set env.FEATURE_GH_PR=false"
        "custom-image::--set image.repository=custom/hnc --set image.tag=v1.0.0"
        "with-secrets::--set secrets.github.enabled=true --set secrets.github.token=test-token"
        "with-persistence::--set persistence.enabled=true --set persistence.size=5Gi"
    )
    
    for test_case in "${test_cases[@]}"; do
        IFS="::" read -r name flags <<< "$test_case"
        log_info "Testing $name configuration..."
        
        if helm template test-$name "$CHART_DIR" $flags > /dev/null; then
            log_info "✓ $name configuration renders successfully"
        else
            log_error "✗ $name configuration fails to render"
            exit 1
        fi
    done
}

# Validate feature flags
validate_feature_flags() {
    log_info "Validating feature flag configurations..."
    
    local feature_flags=(
        "FEATURE_GIT"
        "FEATURE_K8S"
        "FEATURE_HHFAB"
        "FEATURE_GH_PR"
    )
    
    for flag in "${feature_flags[@]}"; do
        # Test true value
        if helm template test "$CHART_DIR" --set "env.$flag=true" | grep -q "$flag.*true"; then
            log_info "✓ $flag=true configuration works"
        else
            log_error "✗ $flag=true configuration failed"
            exit 1
        fi
        
        # Test false value
        if helm template test "$CHART_DIR" --set "env.$flag=false" | grep -q "$flag.*false"; then
            log_info "✓ $flag=false configuration works"
        else
            log_error "✗ $flag=false configuration failed"
            exit 1
        fi
    done
}

# Validate ArgoCD manifests
validate_argocd_manifests() {
    log_info "Validating ArgoCD manifests..."
    
    local argo_files=(
        "app-of-apps.yaml"
        "apps/hnc.yaml"
    )
    
    for file in "${argo_files[@]}"; do
        local filepath="$ARGO_DIR/$file"
        if [[ -f "$filepath" ]]; then
            log_info "✓ Found ArgoCD manifest: $file"
            
            # Basic YAML validation
            if kubectl apply --dry-run=client -f "$filepath" &> /dev/null; then
                log_info "✓ $file is valid Kubernetes YAML"
            else
                log_error "✗ $file has invalid YAML syntax"
                exit 1
            fi
        else
            log_error "✗ Missing ArgoCD manifest: $file"
            exit 1
        fi
    done
}

# Test different scenarios
test_scenarios() {
    log_info "Testing deployment scenarios..."
    
    # Scenario 1: Minimal deployment
    log_info "Testing minimal deployment..."
    helm template minimal "$CHART_DIR" \
        --set replicaCount=1 \
        --set ingress.enabled=false \
        --set autoscaling.enabled=false \
        > /dev/null && log_info "✓ Minimal deployment works"
    
    # Scenario 2: High availability
    log_info "Testing high availability deployment..."
    helm template ha "$CHART_DIR" \
        -f "$CHART_DIR/values-prod.yaml" \
        --set replicaCount=3 \
        --set autoscaling.enabled=true \
        --set podDisruptionBudget.enabled=true \
        > /dev/null && log_info "✓ HA deployment works"
    
    # Scenario 3: Development with all features
    log_info "Testing development deployment..."
    helm template dev "$CHART_DIR" \
        -f "$CHART_DIR/values-dev.yaml" \
        --set env.HNC_VERBOSE=true \
        > /dev/null && log_info "✓ Development deployment works"
}

# Generate test manifests
generate_test_manifests() {
    log_info "Generating test manifests..."
    
    local output_dir="$PROJECT_ROOT/test-manifests"
    mkdir -p "$output_dir"
    
    # Generate different configurations
    helm template hnc-default "$CHART_DIR" > "$output_dir/default.yaml"
    helm template hnc-dev "$CHART_DIR" -f "$CHART_DIR/values-dev.yaml" > "$output_dir/development.yaml"
    helm template hnc-prod "$CHART_DIR" -f "$CHART_DIR/values-prod.yaml" > "$output_dir/production.yaml"
    
    log_info "Test manifests generated in $output_dir/"
    log_info "  - default.yaml (default configuration)"
    log_info "  - development.yaml (development configuration)"
    log_info "  - production.yaml (production configuration)"
}

# Validate security settings
validate_security() {
    log_info "Validating security configurations..."
    
    # Check for security context
    if helm template test "$CHART_DIR" | grep -q "securityContext"; then
        log_info "✓ Security context is configured"
    else
        log_warn "⚠ Security context not found"
    fi
    
    # Check for non-root user
    if helm template test "$CHART_DIR" | grep -q "runAsNonRoot.*true"; then
        log_info "✓ Non-root user configuration found"
    else
        log_warn "⚠ Non-root user configuration not found"
    fi
    
    # Check for read-only root filesystem
    if helm template test "$CHART_DIR" | grep -q "readOnlyRootFilesystem.*true"; then
        log_info "✓ Read-only root filesystem configured"
    else
        log_warn "⚠ Read-only root filesystem not configured"
    fi
}

# Main execution
main() {
    log_info "Starting HNC deployment validation..."
    echo
    
    check_prerequisites
    echo
    
    validate_chart_structure
    echo
    
    run_helm_lint
    echo
    
    test_chart_rendering
    echo
    
    validate_feature_flags
    echo
    
    validate_argocd_manifests
    echo
    
    test_scenarios
    echo
    
    validate_security
    echo
    
    generate_test_manifests
    echo
    
    log_info "🎉 All validations passed! HNC deployment is ready."
    echo
    log_info "Next steps:"
    log_info "1. Review generated test manifests in test-manifests/"
    log_info "2. Deploy to K3s: helm install hnc deploy/charts/hnc -n hnc"
    log_info "3. Set up ArgoCD: kubectl apply -f deploy/argo/app-of-apps.yaml"
    log_info "4. Check documentation in docs/deployment/"
}

# Run main function
main "$@"