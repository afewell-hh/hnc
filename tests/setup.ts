import { vi } from 'vitest'
import '@testing-library/jest-dom'
import '@testing-library/jest-dom/vitest'
import { TextEncoder, TextDecoder } from 'util'
import { webcrypto } from 'crypto'

// Test taxonomy tags for categorization
export const TEST_TAGS = {
  CORE: '@core',
  INTEGRATION: '@integration', 
  FLAKY: '@flaky'
} as const;

// Helper to check if test should be in core suite
export const isCoreTest = (filePath: string): boolean => {
  // Core tests: unit tests, property tests, storybook play tests, golden-path E2E
  const corePatterns = [
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /property.*test/,
    /\.stories\.test/,
    /golden.*path/,
    /smoke.*storybook/
  ];
  
  const integrationPatterns = [
    /integration/,
    /github/,
    /k8s/,
    /drift/,
    /features/
  ];
  
  // Exclude integration patterns from core
  if (integrationPatterns.some(pattern => pattern.test(filePath))) {
    return false;
  }
  
  return corePatterns.some(pattern => pattern.test(filePath));
};

// Polyfills for jsdom environment
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? ResizeObserver;
(globalThis as any).TextEncoder ??= TextEncoder;
(globalThis as any).TextDecoder ??= TextDecoder as any;
(globalThis as any).crypto ??= webcrypto;

// Mock localStorage for tests
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
  writable: true
})

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Global test utilities
(global as any).testUtils = {
  createMockEndpointProfile: () => ({
    id: 'test-profile',
    name: 'Test Profile',
    endpointCount: 48,
    uplinksPerEndpoint: 2
  }),
  
  createMockFabricConfig: () => ({
    name: 'test-fabric',
    spineModelId: 'DS3000',
    leafModelId: 'DS2000',
    uplinksPerLeaf: 2,
    endpointProfile: {
      id: 'test-profile',
      name: 'Test Profile', 
      endpointCount: 48,
      uplinksPerEndpoint: 2
    }
  })
}