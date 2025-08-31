import { vi } from 'vitest'

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