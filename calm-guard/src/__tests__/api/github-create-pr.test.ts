/**
 * API Route Contract Tests: POST /api/github/create-pr
 *
 * The route writes to the GitHub API with the server's token, so input that could
 * move a request to another API endpoint must be rejected before any call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const githubFetch = vi.fn();
vi.mock('@/lib/github/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/github/client')>()),
  githubFetch: (...args: unknown[]) => githubFetch(...args),
}));

const getHeadSha = vi.fn();
vi.mock('@/lib/github/operations', () => ({
  getHeadSha: (...args: unknown[]) => getHeadSha(...args),
  createBranch: vi.fn().mockResolvedValue(undefined),
  commitMultipleFiles: vi.fn(),
  createPR: vi.fn().mockResolvedValue({ html_url: 'https://github.com/finos/repo/pull/1', number: 1 }),
  ensureLabel: vi.fn().mockResolvedValue(undefined),
  addLabelToPR: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/agents/calm-remediator', () => ({
  remediateCalm: vi.fn().mockResolvedValue({ success: true, data: { changes: [], summary: 'none' } }),
}));
vi.mock('@/lib/agents/remediation-merge', () => ({
  applyChangesToCalm: (calm: unknown) => calm,
}));

import { POST } from '@/app/api/github/create-pr/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/github/create-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  type: 'remediation',
  owner: 'finos',
  repo: 'my.repo',
  filePath: 'arch.json',
  fileSha: 'abc',
  defaultBranch: 'main',
};

describe('POST /api/github/create-pr', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN', 'secret');
    githubFetch.mockReset();
    getHeadSha.mockReset();
    globalThis.__lastCalmDocument = { nodes: [], relationships: [] } as unknown as typeof globalThis.__lastCalmDocument;
    globalThis.__lastAnalysisResult = { compliance: {}, risk: {} } as unknown as typeof globalThis.__lastAnalysisResult;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.__lastCalmDocument = undefined;
    globalThis.__lastAnalysisResult = undefined;
  });

  it.each([
    { owner: 'finos/architecture-as-code' },
    { repo: '..' },
    { repo: 'repo?x=1' },
    { filePath: '../../../user/a.json' },
    { filePath: 'docs/./a.json' },
  ])('returns 400 and does not call GitHub for %o', async (override) => {
    const res = await POST(makeRequest({ ...validBody, ...override }));

    expect(res.status).toBe(400);
    expect(getHeadSha).not.toHaveBeenCalled();
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it('encodes each file path segment in the remediation contents PUT', async () => {
    getHeadSha.mockResolvedValue('head-sha');
    githubFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await POST(makeRequest({ ...validBody, filePath: 'docs/%2e%2e/a b?.json' }));
    const events = await res.text();

    expect(events).toContain('"type":"done"');
    expect(githubFetch).toHaveBeenCalledWith(
      '/repos/finos/my.repo/contents/docs/%252e%252e/a%20b%3F.json',
      expect.objectContaining({ method: 'PUT', token: 'secret' }),
    );
  });
});
