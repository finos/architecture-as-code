import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubService, GitHubTreeResponse } from './github';

// Mock fetch globally
global.fetch = vi.fn();

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('creates service without token', () => {
      const svc = new GitHubService();
      expect(svc).toBeInstanceOf(GitHubService);
    });

    it('creates service with token', () => {
      const svc = new GitHubService('test-token');
      expect(svc).toBeInstanceOf(GitHubService);
    });
  });

  describe('getRepoTree', () => {
    it('fetches repo tree successfully', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      };

      const mockTreeResponse = {
        ok: true,
        json: async () => ({
          tree: [
            {
              path: 'test.json',
              type: 'blob',
              sha: 'abc123',
              size: 1024,
              url: 'https://api.github.com/test',
            },
            {
              path: 'other.txt',
              type: 'blob',
              sha: 'def456',
              size: 512,
              url: 'https://api.github.com/other',
            },
            {
              path: 'data.json',
              type: 'blob',
              sha: 'ghi789',
              size: 2048,
              url: 'https://api.github.com/data',
            },
          ],
          truncated: false,
        } as GitHubTreeResponse),
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockTreeResponse);

      const result = await service.getRepoTree('owner', 'repo');

      expect(result).toHaveLength(2); // Only .json files
      expect(result[0].path).toBe('test.json');
      expect(result[1].path).toBe('data.json');
      expect(result[0].sha).toBe('abc123');
      expect(result[1].sha).toBe('ghi789');
    });

    it('includes authorization header when token is provided', async () => {
      const serviceWithToken = new GitHubService('my-token');

      const mockRepoResponse = {
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      };

      const mockTreeResponse = {
        ok: true,
        json: async () => ({ tree: [], truncated: false }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockTreeResponse);

      await serviceWithToken.getRepoTree('owner', 'repo');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('retries with master branch when main fails', async () => {
      const mockFailedResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      const mockSuccessRepoResponse = {
        ok: true,
        json: async () => ({ default_branch: 'master' }),
      };

      const mockTreeResponse = {
        ok: true,
        json: async () => ({ tree: [], truncated: false }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockFailedResponse)
        .mockResolvedValueOnce(mockSuccessRepoResponse)
        .mockResolvedValueOnce(mockTreeResponse);

      await service.getRepoTree('owner', 'repo', 'main');

      // Should make 3 calls: first attempt, then retry with master
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('throws user-friendly error for 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        service.getRepoTree('owner', 'repo', 'master')
      ).rejects.toThrow('Repository "owner/repo" not found');
    });

    it('throws user-friendly error for 403', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        service.getRepoTree('owner', 'repo', 'master')
      ).rejects.toThrow('Access denied to "owner/repo"');
    });

    it('throws user-friendly error for 401', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        service.getRepoTree('owner', 'repo', 'master')
      ).rejects.toThrow('Authentication failed');
    });

    it('throws error when tree fetch fails', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ default_branch: 'main' }),
      };

      const mockTreeResponse = {
        ok: false,
        statusText: 'Internal Server Error',
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockTreeResponse);

      await expect(
        service.getRepoTree('owner', 'repo')
      ).rejects.toThrow('Failed to fetch file tree');
    });
  });

  describe('getFileContent', () => {
    it('fetches and decodes file content successfully', async () => {
      const originalContent = '{"test": "data"}';
      const encodedContent = btoa(originalContent);

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          content: encodedContent,
        }),
        text: async () => '',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await service.getFileContent('owner', 'repo', 'test.json');

      expect(result).toBe(originalContent);
    });

    it('handles base64 content with newlines', async () => {
      const originalContent = '{"test": "data with multiple lines"}';
      const encodedContent = btoa(originalContent);
      // Add newlines to simulate GitHub's response format
      const encodedWithNewlines = encodedContent.match(/.{1,60}/g)?.join('\n') || encodedContent;

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          content: encodedWithNewlines,
        }),
        text: async () => '',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await service.getFileContent('owner', 'repo', 'test.json');

      expect(result).toBe(originalContent);
    });

    it('includes authorization header when token is provided', async () => {
      const serviceWithToken = new GitHubService('my-token');

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          content: btoa('test'),
        }),
        text: async () => '',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await serviceWithToken.getFileContent('owner', 'repo', 'test.json');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/contents/test.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('throws error when response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        service.getFileContent('owner', 'repo', 'missing.json')
      ).rejects.toThrow('Failed to fetch file');
    });

    it('throws error when content is missing', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          // No content field
          sha: 'abc123',
        }),
        text: async () => '',
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        service.getFileContent('owner', 'repo', 'test.json')
      ).rejects.toThrow('No content found in response');
    });
  });

  describe('isCALMFile', () => {
    it('identifies file with nodes as CALM', () => {
      const content = JSON.stringify({
        nodes: [{ id: 'node1' }],
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });

    it('identifies file with relationships as CALM', () => {
      const content = JSON.stringify({
        relationships: [{ id: 'rel1' }],
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });

    it('identifies file with CALM schema as CALM', () => {
      const content = JSON.stringify({
        $schema: 'https://calm.finos.org/schema.json',
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });

    it('identifies file with metadata.name as CALM', () => {
      const content = JSON.stringify({
        metadata: {
          name: 'My Architecture',
        },
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });

    it('rejects file without CALM properties', () => {
      const content = JSON.stringify({
        data: 'some other data',
      });

      expect(GitHubService.isCALMFile(content)).toBe(false);
    });

    it('rejects invalid JSON', () => {
      const content = 'not valid json';

      expect(GitHubService.isCALMFile(content)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(GitHubService.isCALMFile('')).toBe(false);
    });

    it('handles file with both nodes and relationships', () => {
      const content = JSON.stringify({
        nodes: [{ id: 'node1' }],
        relationships: [{ id: 'rel1' }],
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });

    it('handles complex CALM file', () => {
      const content = JSON.stringify({
        $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
        metadata: {
          name: 'Test Architecture',
          version: '1.0.0',
        },
        nodes: [
          {
            'unique-id': 'service-1',
            'node-type': 'service',
            name: 'API Service',
          },
        ],
        relationships: [
          {
            'unique-id': 'rel-1',
            'relationship-type': {
              connects: {
                source: { node: 'service-1' },
                destination: { node: 'service-2' },
              },
            },
          },
        ],
      });

      expect(GitHubService.isCALMFile(content)).toBe(true);
    });
  });
});
