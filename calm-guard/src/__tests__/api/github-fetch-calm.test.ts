/**
 * API Route Contract Tests: POST /api/github/fetch-calm
 *
 * The route calls the GitHub API with the server's token, so input that could
 * move the request to another API endpoint must be rejected before any call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const githubFetch = vi.fn();
vi.mock('@/lib/github/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/github/client')>()),
  githubFetch: (...args: unknown[]) => githubFetch(...args),
}));

import { POST } from '@/app/api/github/fetch-calm/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/github/fetch-calm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/github/fetch-calm', () => {
  beforeEach(() => {
    githubFetch.mockReset();
  });

  it.each([
    { owner: 'finos/architecture-as-code', repo: 'x', filePath: 'a.json' },
    { owner: 'finos', repo: '..', filePath: 'a.json' },
    { owner: 'finos', repo: 'repo?x=1', filePath: 'a.json' },
    { owner: 'finos', repo: 'repo', filePath: '../../../user/a.json' },
    { owner: 'finos', repo: 'repo', filePath: 'docs/./a.json' },
  ])('returns 400 and does not call GitHub for %o', async (body) => {
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(400);
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it('encodes each file path segment in the contents request', async () => {
    githubFetch
      .mockResolvedValueOnce(Response.json({ default_branch: 'main', full_name: 'finos/repo' }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }));

    const res = await POST(
      makeRequest({ owner: 'finos', repo: 'my.repo', filePath: 'docs/%2e%2e/a b?.json' }),
    );

    expect(res.status).toBe(404);
    expect(githubFetch).toHaveBeenNthCalledWith(1, '/repos/finos/my.repo', expect.anything());
    expect(githubFetch).toHaveBeenNthCalledWith(
      2,
      '/repos/finos/my.repo/contents/docs/%252e%252e/a%20b%3F.json',
      expect.anything(),
    );
  });
});
