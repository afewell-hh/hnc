# HNC Integrations Roadmap

## Philosophy: Opt-In, Non-Blocking CI

Default CI remains hermetic and fast. Integrations activate only when secrets/config present.

## GitHub Integration (INT-GH1)

### Scope
- **Feature Flag**: `FEATURE_GIT=true` + env `GITHUB_TOKEN` + `GIT_REMOTE`
- **Behavior**: Commit `./fgd/<fabric-id>/*.yaml` to throwaway branch `hnc-ci/<run-id>`
- **Safety**: Never touches main branch, fully isolated test branches

### Implementation
- `GitHubProvider` using isomorphic-git with HTTPS token auth
- Integration test creates branch, commits YAML, fetches to verify
- Cleanup: Delete test branches after run completion
- Error handling: Graceful degradation when GitHub unavailable

### Testing Strategy
- Unit tests always run (mocked GitHub API)
- Integration tests only when `GITHUB_TOKEN` + `GIT_REMOTE` present
- CI job: `test:integration:git` (conditional)

## Fabric K8s Integration (INT-K8S1)

### Scope  
- **Feature Flag**: `FEATURE_FKS=true` + `KUBECONFIG` (or in-cluster)
- **Behavior**: Read-only drift detection against test namespaces
- **Safety**: Only reads CRs in `hnc-it-<run-id>` namespace with label `hncRunId=<run-id>`

### Implementation
- `K8sProvider` using `@kubernetes/client-node` (read-only)
- Drift comparison: FGD YAML vs actual K8s Custom Resources
- CLI tool under `tools/k8s-drift-probe.mjs` with exponential backoff
- Namespace isolation for complete test safety

### Testing Strategy
- Unit tests for diff logic (always run)
- Integration tests when K8s config present
- Manual integration documentation with setup instructions
- CI job: `test:integration:k8s` (conditional)

## Extra Hardening

### Property-Based Testing
- **Tool**: fast-check for allocator invariants
- **Coverage**: Random class mixes, edge cases, invariant preservation
- **Goal**: Catch corner cases in multi-class allocation logic

### Deterministic YAML Round-Trip
- Ensure save/load cycles preserve exact configuration
- Canonical serialization order for reproducible diffs
- Schema version migration testing

### Enhanced Storybook Contract
- Stories as integration contracts (no data-testids in plays)
- Semantic selectors only: role, aria-label, visible text
- Cross-browser compatibility validation

## Implementation Priority

1. **Tag v0.4.0-alpha** ✅ (Complete)
2. **WP-OVR1/OVR2** (v0.4.1 expert overrides)
3. **INT-GH1** (GitHub integration with test repo)
4. **INT-K8S1** (K8s read-only drift when lab cluster ready)
5. **Property testing** (ongoing quality improvement)

## CI Pipeline Evolution

### Current (Hermetic)
```yaml
jobs:
  - typecheck
  - build  
  - unit-tests
  - storybook-build
  - storybook-tests
  - e2e-golden-path
```

### With Integrations (Conditional)
```yaml
jobs:
  # Always run (hermetic)
  - typecheck
  - build
  - unit-tests  
  - storybook-build
  - storybook-tests
  - e2e-golden-path
  
  # Only when secrets present
  - integration-git:
      if: ${{ secrets.GITHUB_TOKEN && vars.GIT_REMOTE }}
  - integration-k8s:
      if: ${{ secrets.KUBECONFIG }}
```

This maintains fast, reliable CI while enabling rich integration testing when infrastructure is available.