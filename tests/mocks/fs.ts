/**
 * Shared filesystem mocking infrastructure using memfs
 * @core tag: Used by core tests for deterministic file operations
 */

import { vol, fs } from 'memfs';
import * as path from 'path';
import { vi } from 'vitest';

export interface MockFGDContent {
  version: string;
  metadata: {
    name: string;
    created: string;
    updated: string;
  };
  topology: {
    spines: number;
    leaves: number;
    endpoints: number;
  };
  allocation?: {
    leafMaps: any[];
    spineUtilization: number[];
  };
}

// Default mock FGD content
export const mockFGDContent: MockFGDContent = {
  version: 'v0.4.0',
  metadata: {
    name: 'test-fabric',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z'
  },
  topology: {
    spines: 2,
    leaves: 4,
    endpoints: 96
  },
  allocation: {
    leafMaps: [
      { leafId: 0, uplinks: [{ port: 'E1/49', toSpine: 0 }, { port: 'E1/50', toSpine: 1 }] },
      { leafId: 1, uplinks: [{ port: 'E1/49', toSpine: 0 }, { port: 'E1/50', toSpine: 1 }] }
    ],
    spineUtilization: [4, 4]
  }
};

// OS-normalized error messages for cross-platform compatibility
export const normalizePathError = (error: Error): string => {
  const message = error.message;
  // Normalize common filesystem errors across OS
  if (message.includes('ENOENT') || message.includes('no such file')) {
    return 'File not found';
  }
  if (message.includes('EEXIST') || message.includes('file already exists')) {
    return 'File already exists';
  }
  if (message.includes('EACCES') || message.includes('permission denied')) {
    return 'Permission denied';
  }
  return message;
};

// Setup mock filesystem
export const setupMockFS = () => {
  beforeEach(() => {
    // Clear the mock filesystem
    vol.reset();
    
    // Setup default directory structure
    vol.mkdirSync('/tmp/hnc-test', { recursive: true });
    vol.mkdirSync('/tmp/hnc-test/fabrics', { recursive: true });
    
    // Create default mock files
    vol.writeFileSync('/tmp/hnc-test/fabrics/test-fabric.yaml', 
      JSON.stringify(mockFGDContent, null, 2));
  });
  
  afterEach(() => {
    vol.reset();
  });
};

// Mock node:fs module
export const mockNodeFS = () => {
  vi.mock('node:fs', () => ({
    default: fs,
    promises: fs.promises,
    readFileSync: fs.readFileSync.bind(fs),
    writeFileSync: fs.writeFileSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    readdirSync: fs.readdirSync.bind(fs),
    statSync: fs.statSync.bind(fs)
  }));
  
  vi.mock('fs', () => ({
    default: fs,
    promises: fs.promises,
    readFileSync: fs.readFileSync.bind(fs),
    writeFileSync: fs.writeFileSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    readdirSync: fs.readdirSync.bind(fs),
    statSync: fs.statSync.bind(fs)
  }));
};

// File operation utilities
export const createMockFabricFile = (name: string, content?: Partial<MockFGDContent>) => {
  const filePath = path.join('/tmp/hnc-test/fabrics', `${name}.yaml`);
  const fileContent = {
    ...mockFGDContent,
    metadata: {
      ...mockFGDContent.metadata,
      name,
      ...content?.metadata
    },
    ...content
  };
  
  vol.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  return { path: filePath, content: fileContent };
};

export const mockFileExists = (path: string): boolean => {
  try {
    vol.statSync(path);
    return true;
  } catch {
    return false;
  }
};

export const mockReadFile = (path: string): string => {
  try {
    return vol.readFileSync(path, 'utf8') as string;
  } catch (error) {
    throw new Error(normalizePathError(error as Error));
  }
};

export const mockWriteFile = (path: string, content: string): void => {
  try {
    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    vol.mkdirSync(dir, { recursive: true });
    vol.writeFileSync(path, content, 'utf8');
  } catch (error) {
    throw new Error(normalizePathError(error as Error));
  }
};

// Test data generators
export const createMockYAMLContent = (overrides: Partial<MockFGDContent> = {}): string => {
  const content = { ...mockFGDContent, ...overrides };
  return JSON.stringify(content, null, 2);
};

export const createMockDirectoryStructure = (fabrics: string[] = ['fabric-1', 'fabric-2']) => {
  fabrics.forEach(fabricName => {
    createMockFabricFile(fabricName);
  });
  return fabrics.map(name => `/tmp/hnc-test/fabrics/${name}.yaml`);
};

// Error simulation utilities
export const simulateFileError = (path: string, errorType: 'ENOENT' | 'EACCES' | 'EEXIST' = 'ENOENT') => {
  const errorMap = {
    ENOENT: () => { throw new Error(`ENOENT: no such file or directory, open '${path}'`); },
    EACCES: () => { throw new Error(`EACCES: permission denied, open '${path}'`); },
    EEXIST: () => { throw new Error(`EEXIST: file already exists, open '${path}'`); }
  };
  return errorMap[errorType];
};

// Async file operations with proper error handling
export const mockAsyncFileOps = {
  readFile: async (path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const content = mockReadFile(path);
        resolve(content);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  writeFile: async (path: string, content: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        mockWriteFile(path, content);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
  
  exists: async (path: string): Promise<boolean> => {
    return Promise.resolve(mockFileExists(path));
  }
};