# GitHub Integration for HNC

This document describes the GitHub integration implementation for the HNC (Hybrid Network Configuration) project.

## Overview

The GitHub integration provides CI testing capabilities using throwaway branches, ensuring that the main application flow remains unaffected while enabling optional GitHub operations for testing and validation.

## Key Features

- **Throwaway Branch Strategy**: Uses `hnc-ci/<runId>` pattern for isolated testing
- **Token Authentication**: Secure GitHub authentication via environment variables
- **Optional Execution**: Gracefully degrades when environment variables are not set
- **Comprehensive Error Handling**: Robust error handling for all GitHub operations
- **Complete Isolation**: Never touches main branch or affects core application

## Architecture

### Components

1. **GitHubProvider** (`src/features/github-provider.ts`)
   - Main class for GitHub operations
   - Uses isomorphic-git for cross-platform compatibility
   - Implements throwaway branch workflow

2. **Run ID Utilities** (`src/utils/run-id.ts`)
   - Generates unique run identifiers
   - Format: `YYYYMMDD-HHMMSS-XXXXX`
   - Used for branch naming and tracking

3. **Unit Tests** (`tests/features/github-provider.test.ts`)
   - Comprehensive mocking of isomorphic-git
   - Tests all scenarios including error conditions
   - Always run as part of regular test suite

4. **Integration Tests** (`tests/integration/github-integration.test.ts`)
   - Real GitHub operations against actual repository
   - Only run when environment variables are present
   - Automatic cleanup of test artifacts

## Environment Variables

### Required for Integration Tests

- `GITHUB_TOKEN`: GitHub personal access token with repository access
- `GIT_REMOTE`: Repository URL (e.g., `https://github.com/user/repo.git`)

### Optional

- `GIT_BASE_BRANCH`: Base branch name (default: `main`)

## Usage

### Running Integration Tests

```bash
# Set environment variables
export GITHUB_TOKEN="your_github_token"
export GIT_REMOTE="https://github.com/your-user/your-repo.git"

# Run integration tests
npm run int:gh
```

### Programmatic Usage

```typescript
import { createGitHubProvider, isGitHubIntegrationAvailable } from './features/github-provider.js'

// Check if integration is available
if (isGitHubIntegrationAvailable()) {
  const provider = createGitHubProvider()
  await provider.initialize()
  
  // Run complete integration test
  const result = await provider.runIntegrationTest('my-fabric', diagram)
  console.log('Integration test:', result.success ? 'PASSED' : 'FAILED')
}
```

## Workflow

### Complete Integration Test

1. **Create Throwaway Branch**
   - Pattern: `hnc-ci/<runId>`
   - Based on configured base branch (default: `main`)
   - Unique run ID ensures no conflicts

2. **Commit FGD Files**
   - Creates `./fgd/<fabric-id>/` directory structure
   - Commits `servers.yaml`, `switches.yaml`, `connections.yaml`
   - Uses descriptive commit message with fabric metadata

3. **Verify Contents**
   - Fetches branch and verifies all expected files exist
   - Checks file content is non-empty
   - Returns detailed verification results

4. **Cleanup**
   - Deletes throwaway branch from remote
   - Cleans up temporary directories
   - No traces left in repository

### Error Handling

- **Authentication Failures**: Clear error messages, graceful degradation
- **Network Issues**: Retry logic and detailed error reporting
- **Repository Errors**: Safe handling of missing repos/branches
- **File System Errors**: Proper cleanup of temporary directories

## Testing Strategy

### Unit Tests (Always Run)
- Mock all isomorphic-git operations
- Test all code paths including error conditions
- Verify correct API calls and parameters
- No external dependencies required

### Integration Tests (Conditional)
- Real GitHub operations with actual repository
- Environment variable guards prevent accidental execution
- Automatic cleanup of test artifacts
- Extended timeouts for network operations

## Safety Features

1. **Isolated Operations**: Never affects main/production branches
2. **Environment Guards**: Integration tests only run when explicitly configured
3. **Automatic Cleanup**: Throwaway branches are automatically deleted
4. **Error Recovery**: Comprehensive error handling with graceful degradation
5. **Optional Execution**: Application works normally without GitHub integration

## Performance Considerations

- **Minimal Dependencies**: Only loads Git modules when needed
- **Efficient Branching**: Uses shallow clones and single-branch operations
- **Concurrent Operations**: Parallel file operations where possible
- **Temporary Directories**: OS temp directories for isolation

## Integration with CI/CD

The GitHub integration is designed to be CI-friendly:

```yaml
# Example GitHub Actions workflow
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      # Regular tests (always run)
      - run: npm test
      
      # GitHub integration tests (conditional)
      - run: npm run int:gh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GIT_REMOTE: ${{ github.repositoryUrl }}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify `GITHUB_TOKEN` has repository access
   - Check token permissions and expiration
   - Ensure repository URL is correct

2. **Network Timeouts**
   - Integration tests have extended timeouts (30-90 seconds)
   - Check network connectivity to GitHub
   - Consider firewall/proxy settings

3. **Permission Errors**
   - Verify token has write access to repository
   - Check if repository exists and is accessible
   - Ensure branch protection rules don't block throwaway branches

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=github-provider npm run int:gh
```

## Security

- **Token Safety**: Tokens are only used via environment variables
- **No Persistence**: No credentials stored in code or config files
- **Limited Scope**: Operations limited to throwaway branches only
- **Audit Trail**: All operations logged for debugging

## Future Enhancements

- **Batch Operations**: Support for multiple fabrics in single test run
- **Performance Metrics**: Track operation timing and success rates
- **Advanced Cleanup**: Automatic cleanup of old throwaway branches
- **Webhook Integration**: Trigger tests via GitHub webhooks