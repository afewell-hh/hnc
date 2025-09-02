# HNC Release Gate (must be ✅ to tag)

## Pre-Release Validation Checklist

### Core Quality Gates
- [ ] `npm run test:core` → 100% pass rate (no failures, no skips)
- [ ] `npm run build` → success (no runtime errors in preview)
- [ ] `npm run build-storybook && npm run test-storybook` → success
- [ ] Scenario replays (gpu-8→32) → green + minimal diff
- [ ] YAML contracts: purity (no non-ONF fields) + stable ordering → green

### Artifacts Ready for Release
- [ ] `storybook-static.zip` - Built Storybook bundle
- [ ] Sample FGDs (frontend+backend GPU demo, 8→32 scale-up set)
- [ ] QC report from test:core + build logs
- [ ] hhfab validate logs for sample FGDs
- [ ] contracts.md (current ONF compliance)

### Test Taxonomy Compliance
- [ ] All tests properly classified (@core/@integration/@flaky)
- [ ] Core suite excludes integration/upstream/performance tests
- [ ] Integration tests run independently via `test:integration`
- [ ] Flaky tests isolated and documented

### Environment Safety
- [ ] `FEATURE_GIT=false` and `FEATURE_K8S=false` by default in prod
- [ ] Integration tests (`int:gh`, `int:k8s`) only run with proper secrets
- [ ] No hardcoded secrets or credentials in codebase

## Post-Release (First 24 Hours)

### Live Validation
- [ ] Open app → run GPU dual-fabric demo → export FGDs → hhfab validate both
- [ ] Replay 8→32 scenario → verify minimal diff and pinned ports unchanged
- [ ] Feature-flag sanity check in production environment

### Monitoring
- [ ] Watch server logs for error/warn spikes
- [ ] Capture Storybook play test result bundle for release archive
- [ ] Verify branch protection rules require: test:core, build, storybook build

## Quality Metrics (v0.6.0-beta)
- **Test Coverage**: 48 files, 690 tests, 100% pass rate
- **Build Time**: ~6s production build, ~20s Storybook build
- **Test Taxonomy**: @core (690 tests) | @integration (isolated) | @flaky (isolated)
- **Performance**: All tests complete under timeout limits
- **Stability**: Deterministic YAML generation, stable port assignments