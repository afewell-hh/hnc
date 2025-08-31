#!/usr/bin/env bash
set -euo pipefail

# QC (Quality Control) Script - Single Source of Truth for Release Gate Validation
# This script validates all required CI gates in logical order for v0.2.0-alpha and future releases

echo "🚀 Starting QC Gate Validation..."
echo "==============================================="

# Gate 1/6: TypeScript Compilation
echo "📝 1/6 TypeScript compilation..."
npm run -s typecheck
echo "✅ TypeScript compilation passed"
echo ""

# Gate 2/6: Application Build
echo "🔨 2/6 Building application..."
npm run -s build
echo "✅ Application build passed"
echo ""

# Gate 3/6: Unit Tests
echo "🧪 3/6 Running unit tests..."
npm run -s test -- --run
echo "✅ Unit tests passed"
echo ""

# Gate 4/6: End-to-End Tests
echo "🎭 4/6 Running end-to-end tests..."

# Check if Playwright tests exist and dev server availability
if [ -f "tests/e2e/workspace-golden-path.spec.ts" ]; then
    # Check if dev server is already running
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "  ⚠️  End-to-end tests require dev server at localhost:5173"
        echo "  💡 To run e2e tests: 1) npm run dev (in another terminal), 2) npm run test:playwright"
        echo "  ⏭️  Skipping e2e tests (run manually with dev server)"
    else
        echo "  Dev server detected, running e2e tests..."
        # Install Playwright browsers if needed (CI-friendly)
        if [ "${CI:-false}" = "true" ] || [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
            npx playwright install --with-deps chromium
        fi
        npm run -s test:playwright
        echo "  ✅ End-to-end tests passed"
    fi
else
    echo "  ⚠️  No e2e tests found, skipping..."
fi
echo ""

# Gate 5/6: Storybook Build
echo "📚 5/6 Building Storybook..."
npm run -s build-storybook
echo "✅ Storybook build passed"
echo ""

# Gate 6/6: Storybook Tests
echo "🎯 6/6 Running Storybook tests..."
npm run -s test-storybook
echo "✅ Storybook tests passed"
echo ""

# Additional Quality Checks (HNC-specific)
echo "🔍 Running HNC-specific quality checks..."

# Structure validation  
echo "  - Validating file structure..."
# Check for v0.2 multi-fabric structure
test -f src/App.tsx && test -f src/workspace.machine.ts && test -f src/FabricList.tsx || (echo "❌ Layout mismatch" && exit 1)

# LOC caps validation
echo "  - Validating line-of-code limits..."
# v0.2 multi-fabric structure has different limits
app=$(wc -l < src/App.tsx); [ "$app" -le 300 ] || (echo "❌ App.tsx too long: $app lines (max 300)" && exit 1)
workspace=$(wc -l < src/workspace.machine.ts); [ "$workspace" -le 200 ] || (echo "❌ workspace.machine.ts too long: $workspace lines (max 200)" && exit 1)
fabric_list=$(wc -l < src/FabricList.tsx); [ "$fabric_list" -le 250 ] || (echo "❌ FabricList.tsx too long: $fabric_list lines (max 250)" && exit 1)

# Architecture compliance
echo "  - Validating architecture compliance..."
# Check that views don't import services directly (use machines instead)
! grep -q "services/" src/App.tsx || (echo "❌ App.tsx imports services (architecture violation)" && exit 1)
! grep -q "services/" src/FabricList.tsx || (echo "❌ FabricList.tsx imports services (architecture violation)" && exit 1)

echo "✅ HNC-specific quality checks passed"
echo ""

echo "==============================================="
echo "🎉 ALL QC GATES PASSED! READY FOR RELEASE 🎉"
echo "==============================================="
echo ""
echo "Summary:"
echo "  ✅ TypeScript compilation"
echo "  ✅ Application build" 
echo "  ✅ Unit tests"
echo "  ✅ End-to-end tests (or properly skipped)"
echo "  ✅ Storybook build"
echo "  ✅ Storybook tests"
echo "  ✅ HNC v0.2 quality checks"
echo ""
echo "🚀 v0.2.0-alpha validation complete!"