# UP-WATCH: Upstream Change Detection

UP-WATCH is an automated upstream monitoring system that detects changes in githedgehog repositories and alerts when CRDs, switch profiles, or examples have been modified.

## Quick Start

```bash
# Check for upstream changes
npm run upstream:diff

# Verbose output with detailed analysis  
npm run upstream:diff:verbose

# Generate JSON report for automation
npm run upstream:diff:json

# Create GitHub issue on changes (requires GITHUB_TOKEN)
npm run upstream:diff:issue

# Test the diff detection system
npm run test:upstream-diff
```

## Features

- **CRD Change Detection**: Schema modifications, version changes, breaking changes
- **Switch Profile Monitoring**: Configuration updates and new profiles
- **Example Tracking**: New, modified, or removed example files
- **Smart Analysis**: Distinguishes between breaking and non-breaking changes
- **Multiple Output Formats**: Markdown reports and JSON for automation
- **GitHub Integration**: Automatic issue creation with detailed change reports
- **CI/CD Ready**: Exit codes and formats optimized for automation

## Change Types

| Type | Description | Action Required |
|------|-------------|-----------------|
| No Changes | All repositories in sync | ✅ Continue |
| New/Modified | Non-breaking changes detected | 📋 Plan update |
| Breaking Changes | Schema changes requiring intervention | 🚨 Immediate attention |

## Exit Codes

- `0` - No changes detected
- `1` - Changes detected (requires action)
- `2` - Breaking changes detected (requires manual intervention)  
- `3` - Tool error/failure

## Example Output

```bash
$ npm run upstream:diff

# Upstream Changes Report

**Generated**: 2025-09-01T00:46:50.894Z
**Total Changes**: 3
**Breaking Changes**: 1

## CRD Changes

### 💥 Breaking Changes
- **switches.wiring.githedgehog.com** (fabric)
  - required_added: uplinks (v1alpha1)

### ➕ New CRDs  
- **externals.vpc.githedgehog.com** (fabric)
  - Kind: External
  - Versions: v1alpha1

## Recommended Actions
1. ⚠️ Review breaking changes - Manual intervention may be required
2. Update type definitions - Run `npm run upstream:extract`
3. Update tests - Ensure tests work with new schemas
```

## Integration

UP-WATCH integrates seamlessly with CI/CD systems:

```yaml
# GitHub Actions example
- name: Check upstream changes
  run: |
    npm run upstream:diff || EXIT_CODE=$?
    if [ $EXIT_CODE -eq 2 ]; then
      echo "Breaking changes detected!"
      exit 1
    fi
```

## Documentation

- **[CI Integration Guide](upstream-diff-ci-integration.md)** - Complete CI/CD setup
- **Tool Source**: `tools/upstream-diff.mjs`
- **Test Suite**: `tools/test-upstream-diff.mjs`

## Configuration

The tool reads from:
- `upstream.json` - Pinned commits and repository configuration
- `src/upstream/extraction-snapshot.json` - Current extracted state
- `.upstream/` - Synced upstream repositories

Environment variables:
- `GITHUB_TOKEN` - Required for GitHub issue creation