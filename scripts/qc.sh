#!/usr/bin/env bash
set -euo pipefail
echo "== Type check =="
npx tsc --noEmit
echo "== Build =="
npm run -s build
echo "== Structure =="
test -f src/app.state.ts && test -f src/app.machine.ts && test -f src/app.view.tsx || (echo "Layout mismatch" && exit 1)
echo "== LOC caps =="
state=$(wc -l < src/app.state.ts); [ "$state" -le 120 ] || (echo "app.state.ts too long: $state" && exit 1)
machine=$(wc -l < src/app.machine.ts); [ "$machine" -le 180 ] || (echo "app.machine.ts too long: $machine" && exit 1)
view=$(wc -l < src/app.view.tsx); [ "$view" -le 200 ] || (echo "app.view.tsx too long: $view" && exit 1)
echo "== No service imports in view =="
! grep -q "services/" src/app.view.tsx || (echo "View imports services" && exit 1)
echo "== Unit tests =="
npm test -- --run
echo "== Storybook build =="
npm run -s build-storybook
echo "== Storybook test =="
npm run -s test-storybook
echo "== E2E =="
npx playwright install --with-deps
npm run -s e2e
echo "✅ QC OK"