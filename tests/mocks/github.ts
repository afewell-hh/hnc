/**
 * Shared GitHub API mocking infrastructure using MSW
 * @core tag: Used by core tests for deterministic GitHub responses
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export interface MockGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface MockGitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  base: { ref: string };
  head: { ref: string; sha: string };
  user: { login: string };
  created_at: string;
  updated_at: string;
}

// Default mock data
export const mockRepo: MockGitHubRepo = {
  id: 123,
  name: 'test-repo',
  full_name: 'test-owner/test-repo',
  owner: { login: 'test-owner' },
  default_branch: 'main',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

export const mockPR: MockGitHubPR = {
  number: 1,
  title: 'Test PR',
  state: 'open',
  base: { ref: 'main' },
  head: { ref: 'feature-branch', sha: 'abc123' },
  user: { login: 'test-user' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

// MSW handlers for GitHub API
export const githubHandlers = [
  // Repository endpoints
  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    return HttpResponse.json({
      ...mockRepo,
      name: params.repo,
      full_name: `${params.owner}/${params.repo}`,
      owner: { login: params.owner as string }
    });
  }),

  // Pull requests endpoints
  http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return HttpResponse.json([mockPR]);
  }),

  http.post('https://api.github.com/repos/:owner/:repo/pulls', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...mockPR,
      title: body.title,
      base: { ref: body.base },
      head: { ref: body.head, sha: 'new-sha-123' }
    }, { status: 201 });
  }),

  // Issues endpoints
  http.get('https://api.github.com/repos/:owner/:repo/issues', () => {
    return HttpResponse.json([]);
  }),

  // Commits endpoints
  http.get('https://api.github.com/repos/:owner/:repo/commits', () => {
    return HttpResponse.json([
      {
        sha: 'abc123',
        commit: {
          message: 'Test commit',
          author: { name: 'Test User', email: 'test@example.com', date: '2024-01-01T00:00:00Z' }
        },
        author: { login: 'test-user' }
      }
    ]);
  }),

  // Contents endpoints for file operations
  http.get('https://api.github.com/repos/:owner/:repo/contents/:path*', ({ params }) => {
    const path = params.path as string;
    if (path?.endsWith('.yaml') || path?.endsWith('.yml')) {
      return HttpResponse.json({
        name: path.split('/').pop(),
        path,
        sha: 'file-sha-123',
        size: 1024,
        type: 'file',
        content: Buffer.from('test: yaml content').toString('base64'),
        encoding: 'base64'
      });
    }
    return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
  }),

  // Error simulation handlers
  http.get('https://api.github.com/repos/error-test/*', () => {
    return HttpResponse.json({ message: 'API rate limit exceeded' }, { status: 403 });
  })
];

// Test server instance
export const mockGitHubServer = setupServer(...githubHandlers);

// Test utilities
export const setupGitHubMocks = () => {
  beforeAll(() => mockGitHubServer.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => mockGitHubServer.resetHandlers());
  afterAll(() => mockGitHubServer.close());
};

export const createMockOctokit = () => ({
  rest: {
    repos: {
      get: vi.fn().mockResolvedValue({ data: mockRepo }),
      createInOrgRepo: vi.fn().mockResolvedValue({ data: mockRepo }),
      getContent: vi.fn().mockResolvedValue({ 
        data: { 
          content: Buffer.from('test: content').toString('base64'),
          encoding: 'base64' 
        } 
      })
    },
    pulls: {
      list: vi.fn().mockResolvedValue({ data: [mockPR] }),
      create: vi.fn().mockResolvedValue({ data: { ...mockPR, number: 42 } }),
      get: vi.fn().mockResolvedValue({ data: mockPR })
    },
    issues: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ data: { number: 1 } })
    }
  }
});

// Deterministic sorting utility for diff tests
export const deterministicSort = <T extends Record<string, any>>(
  items: T[], 
  key: keyof T = 'id' as keyof T
): T[] => {
  return [...items].sort((a, b) => {
    const aVal = String(a[key]);
    const bVal = String(b[key]);
    return aVal.localeCompare(bVal);
  });
};