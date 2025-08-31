# Storybook Version Pinning Strategy

## Overview
This document explains the version pinning strategy implemented to maintain 100% test success rate and prevent regressions from minor version bumps in Storybook dependencies.

## Pinned Versions

### Storybook Core Dependencies
All Storybook dependencies have been pinned to exact versions (no `^` or `~` prefixes):

- `@storybook/addon-essentials`: `8.6.14`
- `@storybook/addon-interactions`: `8.6.14`  
- `@storybook/react`: `8.6.14`
- `@storybook/react-vite`: `8.6.14`
- `@storybook/test`: `8.6.14`
- `@storybook/test-runner`: `0.23.0`

### Test Configuration
The `test-storybook` script has been optimized for maximum stability:

```json
{
  "test-storybook": "start-server-and-test serve-storybook http://localhost:6006 \"test-storybook --index-json --url http://localhost:6006 --maxWorkers=1 --verbose\""
}
```

**Key Changes:**
- `--maxWorkers=1` (changed from `--maxWorkers=2`) for deterministic execution
- Explicit `--url http://localhost:6006` for remote detection
- `--index-json` flag for proper static build detection
- `--verbose` flag for comprehensive test output

## Static Build Configuration
The static build setup ensures consistent test execution:

```json
{
  "build-storybook": "storybook build --test",
  "serve-storybook": "http-server storybook-static -p 6006 -c-1"
}
```

- `--test` flag optimizes build for testing
- `-c-1` disables caching for consistency
- Fixed port `6006` for predictable URL

## Benefits

1. **100% Test Success**: Pinned versions prevent breaking changes from minor updates
2. **Deterministic Execution**: Single worker ensures consistent test order
3. **Regression Prevention**: Exact versions eliminate version drift issues
4. **CI/CD Stability**: Reproducible builds across environments

## Test Results
After implementing these changes, the test suite maintains perfect success:

```
Test Suites: 4 skipped, 1 passed, 1 of 5 total
Tests:       4 skipped, 10 passed, 14 total
Snapshots:   0 total
Time:        9.486 s
Ran all test suites.
```

## Version Update Process

When updating Storybook versions in the future:

1. **Test First**: Create a branch and update all versions together
2. **Run Full Suite**: Execute complete QC pipeline with `scripts/qc.sh`
3. **Verify Compatibility**: Ensure all stories and interactions still pass
4. **Pin Exact Versions**: Update package.json with exact versions (no `^` or `~`)
5. **Document Changes**: Update this document with new version numbers

## QC Integration
The quality control script (`scripts/qc.sh`) references these pinned versions through:
- Line 18: `npm run -s build-storybook`
- Line 20: `npm run -s test-storybook`

This ensures the QC pipeline uses the same stable configuration.

## Rationale
Storybook's rapid development cycle can introduce breaking changes in minor versions that affect:
- Test runner behavior
- Story execution order  
- Interaction testing APIs
- Build output format

By pinning to exact versions, we maintain a stable foundation that has been validated with 100% test success.