#!/usr/bin/env bash
set -euo pipefail

# GitHub Integration Script - Handle GitHub-specific integrations with environment checks
# This script manages GitHub repository integrations, PR automation, and CI workflows

echo "🐙 GitHub Integration Script"
echo "============================="

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install GitHub CLI first."
    echo "   Visit: https://cli.github.com/"
    exit 1
fi

# Environment variable checks
echo "🔍 Checking environment configuration..."

# Check GitHub token
if [ -z "${GITHUB_TOKEN:-}" ] && [ -z "${GH_TOKEN:-}" ]; then
    echo "⚠️  No GitHub token found in GITHUB_TOKEN or GH_TOKEN"
    echo "💡 Please set a GitHub token for API access"
    echo "   export GITHUB_TOKEN=your_token_here"
    echo "   OR: gh auth login"
    if [ "${CI:-false}" = "true" ]; then
        echo "❌ GitHub token required in CI environment"
        exit 1
    else
        echo "🔄 Attempting GitHub CLI authentication check..."
        if ! gh auth status &> /dev/null; then
            echo "❌ Not authenticated with GitHub CLI. Run 'gh auth login' first."
            exit 1
        fi
        echo "✅ Authenticated with GitHub CLI"
    fi
else
    echo "✅ GitHub token configured"
fi

# Check repository context
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "❌ Not inside a Git repository"
    exit 1
fi

# Get repository information
REPO_REMOTE=$(git config --get remote.origin.url || echo "")
if [ -z "$REPO_REMOTE" ]; then
    echo "❌ No origin remote configured"
    exit 1
fi

echo "✅ Repository context validated"
echo "📍 Repository: $REPO_REMOTE"
echo ""

# Integration operations
echo "🚀 Running GitHub integrations..."

# 1. Repository sync check
echo "1️⃣ Checking repository sync status..."
BRANCH=$(git branch --show-current)
if git ls-remote --exit-code origin "$BRANCH" &> /dev/null; then
    BEHIND=$(git rev-list --count HEAD..origin/"$BRANCH" 2>/dev/null || echo "0")
    AHEAD=$(git rev-list --count origin/"$BRANCH"..HEAD 2>/dev/null || echo "0")
    
    if [ "$BEHIND" -gt 0 ]; then
        echo "⚠️  Branch is $BEHIND commits behind origin/$BRANCH"
        if [ "${AUTO_PULL:-false}" = "true" ]; then
            echo "🔄 Auto-pulling changes..."
            git pull origin "$BRANCH"
        else
            echo "💡 Consider running: git pull origin $BRANCH"
        fi
    fi
    
    if [ "$AHEAD" -gt 0 ]; then
        echo "📤 Branch is $AHEAD commits ahead of origin/$BRANCH"
        if [ "${AUTO_PUSH:-false}" = "true" ]; then
            echo "📤 Auto-pushing changes..."
            git push origin "$BRANCH"
        else
            echo "💡 Consider running: git push origin $BRANCH"
        fi
    fi
    
    if [ "$BEHIND" -eq 0 ] && [ "$AHEAD" -eq 0 ]; then
        echo "✅ Branch is up to date with origin/$BRANCH"
    fi
else
    echo "📝 Branch '$BRANCH' not found on remote (new branch)"
    if [ "${AUTO_PUSH:-false}" = "true" ]; then
        echo "📤 Auto-pushing new branch..."
        git push -u origin "$BRANCH"
    fi
fi
echo ""

# 2. Pull Request checks
echo "2️⃣ Checking Pull Request status..."
if PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null); then
    echo "📋 Active PR #$PR_NUMBER for branch '$BRANCH'"
    
    # Get PR status
    PR_STATE=$(gh pr view "$PR_NUMBER" --json state --jq '.state')
    PR_CHECKS=$(gh pr view "$PR_NUMBER" --json statusCheckRollup --jq '.statusCheckRollup[] | select(.conclusion != "SUCCESS" and .conclusion != null) | .conclusion' | wc -l || echo "0")
    
    echo "   State: $PR_STATE"
    if [ "$PR_CHECKS" -gt 0 ]; then
        echo "   ⚠️  $PR_CHECKS failing checks"
        gh pr checks "$PR_NUMBER" --watch=false || true
    else
        echo "   ✅ All checks passing"
    fi
    
    # Auto-merge if configured and conditions are met
    if [ "${AUTO_MERGE:-false}" = "true" ] && [ "$PR_STATE" = "OPEN" ] && [ "$PR_CHECKS" -eq 0 ]; then
        echo "🔄 Auto-merge conditions met, merging PR..."
        gh pr merge "$PR_NUMBER" --auto --squash || echo "⚠️  Auto-merge failed (may need manual review)"
    fi
else
    echo "📝 No active PR for branch '$BRANCH'"
    
    # Auto-create PR if configured
    if [ "${AUTO_PR:-false}" = "true" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
        echo "🔄 Auto-creating PR..."
        COMMIT_MSG=$(git log -1 --pretty=%s)
        gh pr create --title "$COMMIT_MSG" --body "Auto-generated PR from $BRANCH" --head "$BRANCH" --base main || {
            echo "⚠️  Failed to create PR (may already exist or need manual intervention)"
        }
    fi
fi
echo ""

# 3. Issue tracking
echo "3️⃣ Checking related issues..."
ISSUE_REFS=$(git log --oneline -10 | grep -E "(fix|fixes|close|closes|resolve|resolves) #[0-9]+" | head -3 || echo "")
if [ -n "$ISSUE_REFS" ]; then
    echo "🔗 Recent commits reference issues:"
    echo "$ISSUE_REFS" | sed 's/^/   /'
else
    echo "📝 No recent issue references found"
fi
echo ""

# 4. GitHub Actions workflow status
echo "4️⃣ Checking GitHub Actions workflows..."
if gh run list --limit 5 --json status,conclusion,name,headBranch | jq -r '.[] | select(.headBranch == "'"$BRANCH"'") | "\(.name): \(.status) (\(.conclusion // "running"))"' | head -3; then
    echo "✅ Workflow status retrieved"
else
    echo "📝 No recent workflow runs for this branch"
fi
echo ""

# 5. Repository insights (if enabled)
if [ "${REPO_INSIGHTS:-false}" = "true" ]; then
    echo "5️⃣ Repository insights..."
    echo "📊 Recent activity:"
    gh pr list --state merged --limit 3 --json number,title,mergedAt | jq -r '.[] | "   #\(.number): \(.title) (merged \(.mergedAt | split("T")[0]))"' || echo "   No recent merged PRs"
    
    echo "📈 Open issues: $(gh issue list --state open --json number | jq length)"
    echo "📋 Open PRs: $(gh pr list --state open --json number | jq length)"
    echo ""
fi

echo "============================="
echo "✅ GitHub integration complete"
echo "============================="
echo ""
echo "Summary:"
echo "  ✅ Repository sync checked"
echo "  ✅ Pull Request status verified"
echo "  ✅ Issue tracking reviewed"
echo "  ✅ GitHub Actions status checked"
if [ "${REPO_INSIGHTS:-false}" = "true" ]; then
    echo "  ✅ Repository insights generated"
fi
echo ""
echo "🔧 Configuration options:"
echo "  AUTO_PULL=true     - Automatically pull remote changes"
echo "  AUTO_PUSH=true     - Automatically push local changes"
echo "  AUTO_PR=true       - Auto-create PRs for feature branches"
echo "  AUTO_MERGE=true    - Auto-merge PRs when checks pass"
echo "  REPO_INSIGHTS=true - Show additional repository insights"
