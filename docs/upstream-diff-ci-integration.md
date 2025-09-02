# UP-WATCH CI Integration Guide

The UP-WATCH upstream diff detector (`tools/upstream-diff.mjs`) provides automated change detection for upstream githedgehog repositories. This guide covers CI/CD integration patterns and best practices.

## Overview

UP-WATCH monitors upstream repositories by comparing pinned commits in `upstream.json` with current HEAD commits in `.upstream/` repositories. It detects:

- **CRD Changes**: Schema modifications, new/removed CRDs, version changes, breaking changes
- **Switch Profile Changes**: Configuration updates in switch profiles  
- **Example Changes**: New/modified/removed example files

## Exit Codes

The tool uses specific exit codes for CI integration:

- `0` - No changes detected
- `1` - Changes detected (requires action)
- `2` - Breaking changes detected (requires manual intervention)
- `3` - Tool error/failure

## CI Workflow Examples

### GitHub Actions

```yaml
name: Upstream Change Detection

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  upstream-diff:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Sync upstream repositories
        run: npm run upstream:sync
        
      - name: Check for upstream changes
        id: diff
        run: |
          npm run upstream:diff > diff-output.txt 2>&1
          echo "exit_code=$?" >> $GITHUB_OUTPUT
        continue-on-error: true
        
      - name: Create issue on changes
        if: steps.diff.outputs.exit_code != '0'
        run: npm run upstream:diff:issue
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Upload diff report
        if: steps.diff.outputs.exit_code != '0'
        uses: actions/upload-artifact@v4
        with:
          name: upstream-diff-report
          path: upstream-diff-report.md
          
      - name: Fail on breaking changes
        if: steps.diff.outputs.exit_code == '2'
        run: |
          echo "::error::Breaking changes detected in upstream repositories"
          exit 1
```

### GitLab CI

```yaml
upstream-diff:
  image: node:18-alpine
  stage: monitor
  before_script:
    - npm ci
    - npm run upstream:sync
  script:
    - npm run upstream:diff
  after_script:
    - |
      if [ $CI_JOB_STATUS != "success" ]; then
        npm run upstream:diff:issue
      fi
  artifacts:
    when: on_failure
    paths:
      - upstream-diff-report.md
    expire_in: 1 week
  only:
    - schedules
  variables:
    GITHUB_TOKEN: $CI_GITHUB_TOKEN
```

### Jenkins Pipeline

```groovy
pipeline {
  agent any
  
  triggers {
    cron('H */6 * * *')
  }
  
  environment {
    GITHUB_TOKEN = credentials('github-token')
  }
  
  stages {
    stage('Setup') {
      steps {
        sh 'npm ci'
        sh 'npm run upstream:sync'
      }
    }
    
    stage('Diff Check') {
      steps {
        script {
          def exitCode = sh(
            script: 'npm run upstream:diff',
            returnStatus: true
          )
          
          if (exitCode != 0) {
            sh 'npm run upstream:diff:issue'
            
            if (exitCode == 2) {
              error("Breaking changes detected!")
            } else {
              unstable("Upstream changes detected")
            }
          }
        }
      }
    }
  }
  
  post {
    failure {
      archiveArtifacts artifacts: 'upstream-diff-report.md', fingerprint: true
    }
  }
}
```

## Integration Patterns

### 1. Scheduled Monitoring

Run diff detection on a schedule to catch upstream changes:

```bash
# Every 6 hours
0 */6 * * * cd /path/to/hnc && npm run upstream:diff:issue

# Daily at 9 AM
0 9 * * * cd /path/to/hnc && npm run upstream:diff:verbose
```

### 2. Pre-Release Checks

Include upstream diff in release preparation:

```yaml
pre-release:
  script:
    - npm run upstream:sync
    - npm run upstream:diff
    - |
      if [ $? -eq 2 ]; then
        echo "❌ Breaking changes detected - cannot release"
        exit 1
      elif [ $? -eq 1 ]; then
        echo "⚠️ Non-breaking changes detected - consider updating"
      fi
    - npm run upstream:extract
    - npm run build
    - npm test
```

### 3. Pull Request Automation

Create PRs for upstream changes:

```yaml
upstream-sync-pr:
  runs-on: ubuntu-latest
  if: github.event.schedule || github.event_name == 'workflow_dispatch'
  steps:
    - uses: actions/checkout@v4
      
    - name: Setup and sync
      run: |
        npm ci
        npm run upstream:sync
        
    - name: Check for changes
      id: diff
      run: |
        npm run upstream:diff:json > diff.json
        if [ $? -ne 0 ]; then
          echo "has_changes=true" >> $GITHUB_OUTPUT
        fi
        
    - name: Update extraction
      if: steps.diff.outputs.has_changes == 'true'
      run: npm run upstream:extract
      
    - name: Create Pull Request
      if: steps.diff.outputs.has_changes == 'true'
      uses: peter-evans/create-pull-request@v5
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        commit-message: 'chore: sync upstream changes'
        title: 'Upstream Changes Detected'
        body-path: upstream-diff-report.md
        branch: upstream-sync-${{ github.run_number }}
```

## Configuration Options

### Environment Variables

- `GITHUB_TOKEN` - Required for GitHub issue creation
- `CI` - Detected automatically, enables CI-friendly output
- `GITHUB_REPOSITORY` - Auto-detected in GitHub Actions

### Command Line Options

```bash
# Basic usage
npm run upstream:diff

# Verbose output for debugging
npm run upstream:diff:verbose

# JSON output for parsing
npm run upstream:diff:json

# Dry run (no files created)
npm run upstream:diff:dry-run

# Create GitHub issue on changes
npm run upstream:diff:issue

# Combined options
node tools/upstream-diff.mjs --verbose --dry-run --format=json
```

### Output Formats

#### Markdown (default)
- Human-readable reports
- Suitable for GitHub issues and PRs
- Includes actionable recommendations

#### JSON
- Machine-parseable format
- Suitable for automation and webhooks
- Structured change data

## Monitoring and Alerting

### Slack Integration

```bash
#!/bin/bash
# slack-notify.sh

npm run upstream:diff:json > diff.json
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  CHANGES=$(cat diff.json | jq -r '.summary.totalChanges')
  BREAKING=$(cat diff.json | jq -r '.summary.breakingChanges')
  
  MESSAGE="🔍 Upstream changes detected: $CHANGES total"
  if [ $BREAKING -gt 0 ]; then
    MESSAGE="$MESSAGE, ⚠️ $BREAKING breaking changes"
  fi
  
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$MESSAGE\"}" \
    $SLACK_WEBHOOK_URL
fi
```

### Email Notifications

```bash
#!/bin/bash
# email-notify.sh

npm run upstream:diff > report.md
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  SUBJECT="🚨 Breaking Changes Detected in Upstream"
elif [ $EXIT_CODE -eq 1 ]; then
  SUBJECT="📧 Upstream Changes Available"
else
  exit 0  # No changes, no email
fi

mail -s "$SUBJECT" -a report.md devteam@company.com < report.md
```

## Best Practices

### 1. Frequency
- **Development**: Every 2-4 hours during active development
- **Production**: Every 6-12 hours for stability
- **Release Prep**: Always before releases

### 2. Response Strategy
- **No Changes (exit 0)**: Continue normal operations
- **Changes (exit 1)**: Schedule update in next sprint
- **Breaking Changes (exit 2)**: Immediate team notification and planning

### 3. Automation Levels
- **Level 1**: Detection and notification only
- **Level 2**: Auto-create issues/PRs for review
- **Level 3**: Auto-extract non-breaking changes

### 4. Error Handling
- Always use `continue-on-error: true` in CI
- Capture and archive diff reports on failures
- Set up fallback notifications if primary methods fail

## Troubleshooting

### Common Issues

1. **Git Authentication Failures**
   ```bash
   # Ensure upstream repositories are accessible
   npm run upstream:sync:verbose
   ```

2. **Missing Snapshot File**
   ```bash
   # Generate initial snapshot
   npm run upstream:extract
   ```

3. **Permission Issues**
   ```bash
   # Ensure tools are executable
   chmod +x tools/upstream-diff.mjs
   ```

4. **GitHub API Rate Limits**
   - Use personal access tokens with higher limits
   - Implement exponential backoff for retries

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
npm run upstream:diff:verbose -- --dry-run
```

### Testing

Validate CI configuration with the test suite:

```bash
npm run test:upstream-diff:verbose
```

## Integration Checklist

- [ ] UP-WATCH tool installed and executable
- [ ] npm scripts configured
- [ ] CI pipeline configured with appropriate triggers
- [ ] GitHub token configured (if using issue creation)
- [ ] Notification channels set up (Slack, email, etc.)
- [ ] Error handling and fallback strategies implemented
- [ ] Test runs completed successfully
- [ ] Team trained on responding to upstream change alerts
- [ ] Documentation updated with team-specific procedures

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the test suite: `npm run test:upstream-diff`
3. Review logs with: `npm run upstream:diff:verbose --dry-run`
4. File an issue with the full output and configuration details