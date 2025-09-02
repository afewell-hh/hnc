# Integration Testing Guide - HNC CI/CD

## Overview

HNC v0.4.1 introduces optional integration testing that extends the core CI pipeline without disrupting fast, hermetic builds. Integration tests only run when the necessary credentials and infrastructure are available, ensuring that the main development workflow remains fast and reliable.

## Philosophy: Opt-In, Non-Blocking

- **Default CI**: Remains hermetic, fast, and always reliable
- **Integration Tests**: Activate only when secrets/configuration are present
- **No Dependencies**: Main branch never depends on external services
- **Safe Isolation**: All tests use isolated, throwaway resources

## CI Pipeline Architecture

### Core Pipeline (Always Runs)

The main CI pipeline remains unchanged and includes all essential quality gates:

```yaml
core-tests:
  - TypeScript type checking (tsc --noEmit)
  - Application build (npm run build)
  - Unit tests (npm test)
  - E2E golden path test (Playwright)
  - Storybook build and tests
```

**Guarantees**: 
- Runs on every push/PR
- No external dependencies
- Completes in under 5 minutes
- Must pass for merge approval

### Optional Integration Tests

Additional jobs that run only when properly configured:

#### GitHub Integration (`integration-github`)
**Triggers**: `secrets.GITHUB_TOKEN` + `vars.GIT_REMOTE` exist
**Purpose**: Validate Git operations against real GitHub repositories

#### K8s Integration (`integration-k8s`)
**Triggers**: `secrets.KUBECONFIG` exists OR manual workflow dispatch
**Purpose**: Validate Kubernetes resource generation and deployment

## GitHub Integration Testing

### Prerequisites

**Repository Secrets**:
- `GITHUB_TOKEN`: Personal Access Token with repo permissions
- `GIT_REMOTE`: Test repository URL (e.g., `https://github.com/user/hnc-test-repo`)

**Repository Variables**:
- `GIT_REMOTE`: Can also be set as a variable instead of secret

### Test Scope

The GitHub integration tests validate:

1. **Branch Creation**: Create isolated test branches (`hnc-ci/<run-id>`)
2. **Commit Operations**: Commit generated YAML files to test branches
3. **Authentication**: Verify token-based HTTPS authentication works
4. **Cleanup**: Automatic deletion of test branches after completion
5. **Error Handling**: Graceful degradation when GitHub is unavailable

### Local Testing

Run GitHub integration tests locally:

```bash
# Set up environment
export GITHUB_TOKEN="your_personal_access_token"
export GIT_REMOTE="https://github.com/your-username/hnc-test-repo"
export FEATURE_GIT="true"

# Run tests
npm run int:gh
```

### Safety Guarantees

- **Never touches main branch**: All operations use isolated test branches
- **Automatic cleanup**: Test branches deleted after each run
- **Failure isolation**: GitHub failures don't affect core functionality
- **Rate limiting**: Respectful of GitHub API limits

## Kubernetes Integration Testing

### Prerequisites

**Option A: Real Cluster**
```bash
# Repository secret
KUBECONFIG: |
  apiVersion: v1
  kind: Config
  clusters: ...
```

**Option B: Manual Trigger**
- Use GitHub Actions workflow dispatch with `enable_k8s_validation: true`
- Creates local Kind cluster automatically

### Test Scope

The K8s integration tests validate:

1. **Resource Generation**: Create Kubernetes YAML from fabric definitions
2. **Deployment**: Apply resources to test namespace
3. **Validation**: Read back resources and compare to expected state
4. **Drift Detection**: Identify differences between desired and actual state
5. **Cleanup**: Remove all test resources after completion

### Local Testing

**With existing cluster**:
```bash
# Ensure kubectl is configured
kubectl cluster-info

# Set feature flag
export FEATURE_K8S="true"

# Run validation
npm run k8s:validate
```

**With local Kind cluster**:
```bash
# Install Kind if not present
go install sigs.k8s.io/kind@latest

# Create test cluster
kind create cluster --name hnc-test

# Run tests
export FEATURE_K8S="true"
npm run k8s:validate
```

### Safety Guarantees

- **Namespace Isolation**: All resources created in `hnc-it-<run-id>` namespace
- **Label-based Selection**: Only resources with `hncRunId=<run-id>` label are managed
- **Read-Only by Default**: Integration tests primarily read existing resources
- **Automatic Cleanup**: Test namespace deleted after each run
- **No Production Impact**: Tests never touch production namespaces

## Setting Up Integration Tests

### For Repository Owners

**Step 1: Configure GitHub Integration**
```bash
# Create test repository
gh repo create hnc-test-integration --private

# Add repository secrets
gh secret set GITHUB_TOKEN --body "ghp_your_token_here"
gh secret set GIT_REMOTE --body "https://github.com/your-org/hnc-test-integration"
```

**Step 2: Configure K8s Integration**
```bash
# Get kubeconfig for test cluster
kubectl config view --raw --minify > /tmp/kubeconfig

# Add as repository secret
gh secret set KUBECONFIG < /tmp/kubeconfig
```

### For Developers

**Local Development**:
1. Fork the test repository for personal testing
2. Create personal access token with repo permissions
3. Set environment variables for local testing
4. Run integration tests before submitting PRs

**CI Verification**:
- Integration tests are informational only
- Core tests must pass for PR approval
- Integration failures are investigated but don't block merges

## Integration Test Scripts

### GitHub Integration (`npm run int:gh`)

Runs the complete GitHub integration test suite:
- `tests/integration/github-integration.test.ts`
- Creates isolated test branches
- Commits sample fabric configurations
- Verifies authentication and operations
- Cleans up test branches

### K8s Integration (`npm run k8s:validate`)

Runs Kubernetes validation:
- `tools/int-k8s.mjs`
- Generates Kubernetes YAML from fabric specs
- Applies resources to test namespace
- Validates deployed resources match expectations
- Reports any drift or discrepancies

### Combined Integration (`npm run int:all`)

Runs all available integration tests:
```bash
npm run int:all
# Equivalent to:
# npm run int:gh && npm run k8s:validate
```

## Troubleshooting Integration Tests

### GitHub Integration Issues

**Authentication Failures**:
```bash
# Verify token permissions
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Check repository access
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/repos/owner/repo
```

**Branch Creation Failures**:
- Verify repository exists and is accessible
- Check that token has push permissions
- Ensure repository is not archived or disabled

**Rate Limiting**:
- GitHub integration tests respect rate limits
- Tests will retry with exponential backoff
- Consider using GitHub Apps for higher limits

### Kubernetes Integration Issues

**Cluster Connection**:
```bash
# Test cluster connectivity
kubectl cluster-info
kubectl auth can-i list pods --namespace=hnc-it-test
```

**Permission Issues**:
- Ensure kubeconfig has namespace creation permissions
- Verify ServiceAccount has required RBAC permissions
- Check for NetworkPolicies blocking test traffic

**Resource Conflicts**:
- Ensure test namespace is clean before running
- Check for conflicting CRDs or operators
- Verify cluster has sufficient resources

### Local Environment Issues

**Missing Dependencies**:
```bash
# Install required tools
npm install -g @kubernetes/client-node
npm install -g isomorphic-git

# Verify installations
node -e "console.log(require('@kubernetes/client-node').KubeConfig)"
```

**Environment Variables**:
```bash
# Verify all required variables are set
echo "FEATURE_GIT: $FEATURE_GIT"
echo "FEATURE_K8S: $FEATURE_K8S"  
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}..." # Masked output
```

## Best Practices

### For CI Configuration

1. **Keep Core Fast**: Never add dependencies to core-tests job
2. **Fail Gracefully**: Integration failures should be informational
3. **Clean Resources**: Always clean up test resources, even on failure
4. **Rate Limit**: Respect external service rate limits
5. **Document Dependencies**: Clear documentation for required secrets

### For Integration Tests

1. **Isolated Testing**: Use unique identifiers for all test resources
2. **Idempotent Operations**: Tests should be safe to run multiple times
3. **Comprehensive Cleanup**: Clean up all created resources
4. **Meaningful Assertions**: Test real integration concerns, not mocked behavior
5. **Performance Conscious**: Keep integration tests under 10 minutes

### For Development Workflow

1. **Local First**: Test integrations locally before pushing
2. **Core Dependencies**: Never make core functionality depend on integrations
3. **Feature Flags**: Use feature flags to enable/disable integrations
4. **Graceful Degradation**: Application works without integration features
5. **Monitoring**: Track integration test success rates and performance

## Future Enhancements

### Planned Improvements

- **Parallel Execution**: Run GitHub and K8s tests simultaneously
- **Matrix Testing**: Test against multiple K8s versions and GitHub configurations
- **Performance Benchmarks**: Include performance regression testing
- **Security Scanning**: Automated security analysis of generated resources
- **Cross-Environment Testing**: Validate across different cloud providers

### Integration Roadmap

- **Phase 1** ✅: Basic GitHub and K8s integration (v0.4.1)
- **Phase 2**: Advanced GitOps workflows and drift detection
- **Phase 3**: Multi-cluster testing and federation scenarios
- **Phase 4**: Performance and scalability testing at enterprise scale

---

The integration testing framework ensures that HNC works reliably with real-world infrastructure while maintaining the speed and reliability of the core development workflow.