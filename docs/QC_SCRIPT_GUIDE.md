# QC Script Guide - Single Source of Truth for Release Validation

## Overview

The `scripts/qc.sh` script serves as the **single source of truth** for release gate validation in HNC v0.2.0-alpha and future releases. It validates all required CI gates in a logical sequence, ensuring comprehensive quality control before any release.

## Required CI Gates

The QC script validates 6 critical gates:

1. **📝 TypeScript Compilation** (`npm run typecheck`)
2. **🔨 Application Build** (`npm run build`) 
3. **🧪 Unit Tests** (`npm run test -- --run`)
4. **🎭 End-to-End Tests** (`npm run test:playwright`)
5. **📚 Storybook Build** (`npm run build-storybook`)
6. **🎯 Storybook Tests** (`npm run test-storybook`)

## Usage

### Basic Execution

```bash
# Run full QC validation
./scripts/qc.sh

# Or using npm (if added to package.json scripts)
npm run qc
```

### Prerequisites

#### Local Development
- Node.js and npm installed
- Dependencies installed (`npm install`)
- For e2e tests: Dev server running at `localhost:5173`

#### CI Environment
- Set `CI=true` environment variable
- Playwright browsers auto-install if needed
- All dependencies pre-installed

### Running with End-to-End Tests

E2E tests require a development server. Two approaches:

#### Option 1: Manual Dev Server
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run QC script (will detect running server)
./scripts/qc.sh
```

#### Option 2: Individual E2E Testing
```bash
# Run all gates except e2e
./scripts/qc.sh  # (skips e2e if no dev server)

# Then manually run e2e
npm run dev &     # Start dev server
npm run test:playwright  # Run e2e tests
```

## Script Features

### ✅ Fail-Fast Behavior
- Stops immediately on any gate failure
- Uses `set -euo pipefail` for robust error handling
- Clear error reporting with gate identification

### 🎯 Intelligent E2E Handling
- Auto-detects if dev server is running
- Provides helpful guidance if server unavailable  
- Graceful skip with clear instructions
- CI-friendly browser installation

### 📊 Clear Progress Reporting
- Gate-by-gate progress indicators
- Success confirmation for each gate
- Comprehensive final summary
- HNC-specific quality checks

### 🔧 CI Integration Ready
- Environment detection (`CI` variable)
- Silent execution modes (`-s` flags)
- Browser auto-installation for Playwright
- Exit codes for automation

## Gate Details

### Gate 1: TypeScript Compilation
```bash
npm run typecheck  # tsc --noEmit
```
- Validates all TypeScript files
- Ensures type safety across codebase
- No compilation output, just validation

### Gate 2: Application Build  
```bash
npm run build  # vite build
```
- Creates production build in `dist/`
- Validates build configuration
- Checks for build-time errors

### Gate 3: Unit Tests
```bash
npm run test -- --run  # vitest --run
```
- Runs all Vitest unit tests
- Validates business logic
- Ensures test coverage goals

### Gate 4: End-to-End Tests
```bash
npm run test:playwright  # playwright test
```
- Runs Playwright browser tests
- Validates full user workflows
- Requires dev server at localhost:5173

### Gate 5: Storybook Build
```bash
npm run build-storybook  # storybook build --test
```
- Builds static Storybook site
- Validates component stories
- Ensures Storybook configuration

### Gate 6: Storybook Tests
```bash
npm run test-storybook  # test-storybook --maxWorkers=1
```
- Runs Storybook play tests
- Validates interactive component behavior
- Uses `--maxWorkers=1` for stability

## HNC-Specific Quality Checks

After the 6 main gates, additional HNC validations:

### File Structure Validation
```bash
test -f src/app.state.ts && test -f src/app.machine.ts && test -f src/app.view.tsx
```

### Line-of-Code Limits
- `app.state.ts`: ≤ 120 lines
- `app.machine.ts`: ≤ 180 lines  
- `app.view.tsx`: ≤ 200 lines

### Architecture Compliance
```bash
! grep -q "services/" src/app.view.tsx  # No service imports in view
```

## CI Integration

### GitHub Actions Example
```yaml
name: QC Validation
on: [push, pull_request]
jobs:
  qc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run dev &  # Start dev server for e2e
      - run: sleep 10      # Wait for server
      - run: ./scripts/qc.sh
        env:
          CI: true
```

### Local Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit
./scripts/qc.sh
```

## Expected Output

### Success (All Gates Pass)
```
🚀 Starting QC Gate Validation...
===============================================
📝 1/6 TypeScript compilation...
✅ TypeScript compilation passed

🔨 2/6 Building application...
✅ Application build passed

🧪 3/6 Running unit tests...
✅ Unit tests passed

🎭 4/6 Running end-to-end tests...
  Dev server detected, running e2e tests...
  ✅ End-to-end tests passed

📚 5/6 Building Storybook...
✅ Storybook build passed

🎯 6/6 Running Storybook tests...
✅ Storybook tests passed

🔍 Running HNC-specific quality checks...
  - Validating file structure...
  - Validating line-of-code limits...
  - Validating architecture compliance...
✅ HNC-specific quality checks passed

===============================================
🎉 ALL QC GATES PASSED! READY FOR RELEASE 🎉
===============================================

Summary:
  ✅ TypeScript compilation
  ✅ Application build
  ✅ Unit tests
  ✅ End-to-end tests
  ✅ Storybook build
  ✅ Storybook tests
  ✅ HNC quality checks

🚀 v0.2.0-alpha validation complete!
```

### Partial Success (E2E Skipped)
```
🎭 4/6 Running end-to-end tests...
  ⚠️  End-to-end tests require dev server at localhost:5173
  💡 To run e2e tests: 1) npm run dev (in another terminal), 2) npm run test:playwright
  ⏭️  Skipping e2e tests (run manually with dev server)
```

### Failure Example
```
🧪 3/6 Running unit tests...
FAIL src/components/Button.test.tsx
❌ Unit tests failed - see output above
```

## Troubleshooting

### Common Issues

#### "Dev server failed to start"
- **Cause**: Port 5173 already in use
- **Solution**: Kill existing processes or use different port

#### "TypeScript compilation failed"  
- **Cause**: Type errors in code
- **Solution**: Fix reported TypeScript errors

#### "Storybook tests timeout"
- **Cause**: Stories loading too slowly
- **Solution**: Already using `--maxWorkers=1`, check story complexity

#### "Permission denied: ./scripts/qc.sh"
- **Cause**: Script not executable
- **Solution**: `chmod +x scripts/qc.sh`

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CI` | Enable CI mode | `false` |
| `PLAYWRIGHT_BROWSERS_PATH` | Playwright browser location | auto |

### Performance Optimization

- **Parallel Gates**: Cannot parallelize due to dependencies
- **Cache Usage**: Leverages npm/vite caching automatically  
- **Browser Installation**: Only when needed in CI
- **Build Artifacts**: Reused between gates where possible

## Version History

- **v0.2.0-alpha**: Initial comprehensive QC script
  - All 6 CI gates implemented
  - HNC-specific validations
  - CI/CD integration ready
  - Storybook test validation with `--maxWorkers=1`

## Maintenance

### Adding New Gates
1. Add gate logic in sequential order
2. Update gate counter in echo statements
3. Add gate to final summary
4. Update this documentation

### Modifying Validation Logic
- Keep gates atomic and independent
- Maintain fail-fast behavior
- Preserve clear error messages
- Test in both local and CI environments

---

**Remember**: The QC script is the authoritative release gate. All changes must pass through this validation before any deployment or release tagging.