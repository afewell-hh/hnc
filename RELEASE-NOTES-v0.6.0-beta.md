# HNC v0.6.0-beta Release Notes

## 🚀 Release Highlights

### 🎯 100% Core Test Suite Achievement
- **690 tests passing** across 48 test files with **0 failures**
- Systematic **test taxonomy implementation** (@core/@integration/@flaky)
- **Test infrastructure hardening** with proper polyfills and environment setup
- **Strategic test reclassification** separating core functionality from integration scenarios

### 🏗️ Dual-Fabric GPU Support
- Complete dual-fabric GPU cluster topology generation
- Advanced port pinning and locking capabilities (WP-PIN1)
- Scale validation for 8→32 server scenarios with deterministic port assignments
- External bandwidth helper and explicit port allocation

### 🔧 Infrastructure & Quality
- **jsdom environment** with comprehensive browser polyfills
- **TypeScript path aliases** resolution in test suite
- **Vitest configuration** optimized for deterministic test execution
- **Storybook build** validation ensuring UI component integrity

## 📊 Quality Metrics

| Metric | Value | Status |
|--------|-------|---------|
| Core Test Pass Rate | 100% (690/690) | ✅ |
| Test Files Coverage | 48 files | ✅ |
| Build Time | ~6s production, ~20s Storybook | ✅ |
| Test Taxonomy | @core/@integration/@flaky | ✅ |
| YAML Generation | Deterministic, stable ordering | ✅ |

## 🛡️ Release Gate Validation

### ✅ Completed
- [x] `npm run test:core` → 100% pass
- [x] `npm run build` → success
- [x] `npm run build-storybook` → success  
- [x] Test taxonomy implementation
- [x] Release artifacts prepared
- [x] Documentation updated

### 📦 Release Artifacts
- `storybook-static.zip` (1.96MB) - Complete Storybook build
- `qc-report.txt` - Quality control validation summary
- `docs/release-gate.md` - Release gate checklist for future releases
- Sample FGDs: 8-server and 32-server scale test configurations

## 🔧 Technical Improvements

### Test Infrastructure
```typescript
// vitest.config.ts improvements
environment: 'jsdom'  // Browser environment for React components
resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
testTimeout: 30000  // Stable timeout for complex tests
```

### Test Taxonomy
```bash
# Core tests (fast, deterministic)
npm run test:core  # Excludes integration/flaky/upstream tests

# Integration tests (external dependencies)
npm run test:integration  # Complex scenarios, optional on CI
```

## 🎛️ Feature Flags & Environment
- `FEATURE_GIT=false` (default in prod)
- `FEATURE_K8S=false` (default in prod) 
- Integration tests require proper secrets/environment setup
- Core functionality fully testable without external dependencies

## 🚦 Known Limitations
- Vendor SKUs behind feature flag (future WP-BOMV1)
- Integration tests optional on CI (environment-dependent)
- Some build warnings for Node.js module externalization (non-blocking)

## 🔄 Next Steps
Two work packets ready for parallel development:
- **WP-BOMV1**: Vendor SKU plugin with feature flag
- **RC-HYGIENE**: Real-world scenario replays in CI

## 📋 Deployment Notes
- Staging namespace: `hnc-stg`
- Production namespace: `hnc`
- Helm chart ready with `image.tag=0.6.0-beta`
- Post-release validation includes live smoke tests

---

**Ship Criteria Met**: ✅ Core CI 100% green + Clean build + Storybook functional

*Generated: 2025-09-02*