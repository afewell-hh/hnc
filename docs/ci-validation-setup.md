# CI Validation Setup Guide

This document describes the comprehensive CI validation pipeline for HNC, including required core validation and optional ONF integration checks.

## Overview

The CI pipeline is designed with two tiers of validation:

1. **Required Core Validation** - Always runs, must pass for PR merge
2. **Optional Validation Gates** - Runs when environment variables are configured

## Core Validation Pipeline (Always Required)

The following jobs always run and must pass:

### `core-tests` (Matrix: Node 18 & 20)
- TypeScript type checking (`npm run typecheck`)
- Application build (`npm run build`)
- Unit tests with property tests (`npm test -- --run`)
- E2E golden path tests (`npm run e2e`)
- Storybook build (`npm run build-storybook`)
- Storybook story tests (`npm run test-storybook`)

## Optional Validation Gates

These jobs run only when enabled via environment variables or manual dispatch.

### HHFab Validation (`validation-hhfab`)

Validates fabric configurations using the HHFab CLI tool.

**Triggers:**
- Repository variable: `ENABLE_HHFAB_VALIDATION=true`
- Repository variable: `HHFAB` is set
- Manual workflow dispatch: `enable_hhfab_validation=true`

**Environment Variables:**
- `HHFAB`: Path to HHFab CLI tool (default: `/usr/local/bin/hhfab`)

**Commands:**
```bash
npm run validate:hhfab:ci
```

### K8s Validation (`validation-k8s`)

Validates Kubernetes manifests without requiring a live cluster.

**Triggers:**
- Repository variable: `ENABLE_K8S_VALIDATION=true`
- Manual workflow dispatch: `enable_k8s_validation=true`

**Environment Variables:**
- `FEATURE_K8S=true`

**Commands:**
```bash
npm run validate:k8s:ci
```

### K8s Integration (`integration-k8s`)

Full integration tests against a live or local Kubernetes cluster.

**Triggers:**
- Repository secret: `KUBECONFIG` is set
- Repository variable: `ENABLE_INTEGRATION_TESTS=true`
- Manual workflow dispatch: `enable_integration=true`

**Environment Variables:**
- `FEATURE_K8S=true`
- `KUBECONFIG`: Kubernetes configuration

**Commands:**
```bash
npm run int:k8s:ci
```

### GitHub Integration (`integration-github`)

Integration tests with GitHub API (existing job).

**Triggers:**
- Repository secret: `GITHUB_TOKEN` is set
- Repository variable: `GIT_REMOTE` is set

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub API token
- `GIT_REMOTE`: Git remote name
- `FEATURE_GIT=true`

**Commands:**
```bash
npm run int:gh:ci
```

## Environment Configuration

### Repository Secrets (GitHub Settings → Secrets)
- `KUBECONFIG`: Base64-encoded Kubernetes config for live cluster integration
- `GITHUB_TOKEN`: GitHub API token for GitHub integration tests

### Repository Variables (GitHub Settings → Variables)
- `ENABLE_HHFAB_VALIDATION`: Set to `true` to enable HHFab validation
- `ENABLE_K8S_VALIDATION`: Set to `true` to enable K8s validation
- `ENABLE_INTEGRATION_TESTS`: Set to `true` to enable integration tests
- `HHFAB`: Path to HHFab CLI tool (optional, defaults to `/usr/local/bin/hhfab`)
- `GIT_REMOTE`: Git remote name (optional, defaults to `origin`)

### Local Development (.env file)

Copy `.env.example` to `.env` and configure:

```bash
# Copy example environment
cp .env.example .env

# Edit with your configuration
nano .env
```

Key variables for local validation:
- `HHFAB`: Path to HHFab CLI tool
- `FEATURE_HHFAB=true`: Enable HHFab validation
- `FEATURE_K8S=true`: Enable K8s validation
- `KUBECONFIG`: Path to your Kubernetes config

## NPM Scripts Reference

### Core Validation
```bash
npm run validate:core     # TypeCheck + Build + Unit tests
npm run validate:ci       # Core + E2E + Storybook
```

### Optional Validation
```bash
npm run validate:optional # HHFab + K8s validation
npm run validate:hhfab:ci # HHFab validation with guards
npm run validate:k8s:ci   # K8s validation with guards
```

### Complete Validation
```bash
npm run validate:all      # Core + Optional validation
```

### Integration Tests
```bash
npm run validate:integration # GitHub + K8s integration
npm run int:gh:ci           # GitHub integration only
npm run int:k8s:ci          # K8s integration only
```

## Manual Workflow Dispatch

You can manually trigger the CI workflow with optional validations:

1. Go to Actions → CI workflow
2. Click "Run workflow"
3. Select branch and enable desired validations:
   - ✅ Enable HHFab validation
   - ✅ Enable K8s validation  
   - ✅ Enable integration tests

## Environment Guards

All optional validation scripts include proper environment guards:

```bash
# Example guard pattern
scripts/load-env.sh && ([ "$FEATURE_K8S" = "true" ] && npm run validate:k8s || echo "K8s validation skipped")
```

Guards ensure:
- Scripts exit gracefully when tools are not available
- Clear messaging about why validation was skipped
- No failures due to missing optional dependencies

## Troubleshooting

### HHFab Validation Fails
- Verify `HHFAB` points to valid executable
- Check HHFab CLI tool is installed and accessible
- Review fabric configuration files for syntax errors

### K8s Validation Fails
- Ensure Kubernetes manifests are valid YAML
- Check resource definitions match expected schemas
- Verify namespace and resource naming conventions

### Integration Test Failures
- Check network connectivity to external services
- Verify secrets/tokens are correctly configured
- Review test logs for specific API errors

### CI Job Conditions Not Working
- Verify repository variables are set correctly (case-sensitive)
- Check that secrets are available to the workflow
- Confirm workflow dispatch inputs are boolean type

## Best Practices

1. **Start Simple**: Enable core validation first, add optional validation gradually
2. **Test Locally**: Run validation scripts locally before pushing
3. **Monitor Performance**: Optional validations should not significantly slow CI
4. **Document Changes**: Update this guide when adding new validation types
5. **Environment Consistency**: Keep `.env.example` updated with all options

## Support

For issues with validation setup:
1. Check the validation script logs in CI
2. Test validation scripts locally with verbose output
3. Review environment variable configuration
4. Consult this documentation for troubleshooting steps