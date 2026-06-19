/**
 * API Route test: POST /api/github/create-pr — remediation validation gate.
 *
 * Verifies that a remediated CALM document is validated BEFORE any GitHub
 * mutation: an invalid document (or a validator that fails to run) aborts the
 * stream and never reaches githubFetch (no branch/commit/PR), while a valid
 * document is allowed through the gate. The gate validates the MERGED output.
 *
 * All external dependencies (the CLI validator, the LLM remediation agent, and
 * the GitHub client) are mocked, so no API keys / network are required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks (declared before the handler import) ----
vi.mock('@/lib/calm/cli-validator', () => ({
  validateWithCalmCli: vi.fn(),
}));
vi.mock('@/lib/github/client', () => ({
  githubFetch: vi.fn(),
}));
// remediateCalm is the LLM agent — fully mocked so no provider/API key is touched.
vi.mock('@/lib/agents/calm-remediator', () => ({
  remediateCalm: vi.fn(),
}));

// ---- Import handler AFTER mocks ----
import { POST } from '@/app/api/github/create-pr/route';
import { validateWithCalmCli } from '@/lib/calm/cli-validator';
import { githubFetch } from '@/lib/github/client';
import { remediateCalm } from '@/lib/agents/calm-remediator';

const REMEDIATION_BODY = {
  type: 'remediation',
  owner: 'o',
  repo: 'r',
  filePath: 'arch.json',
  fileSha: 'abc',
  defaultBranch: 'main',
};

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/github/create-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) out += decoder.decode(chunk.value, { stream: !done });
  }
  return out;
}

describe('POST /api/github/create-pr — remediation validation gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token'; // route returns 503 without it
    globalThis.__lastCalmDocument = { nodes: [], relationships: [] };
    globalThis.__lastAnalysisResult = {
      compliance: {},
      risk: {},
    } as unknown as typeof globalThis.__lastAnalysisResult;
    // Default: a no-op remediation (overridden where a real change is needed).
    vi.mocked(remediateCalm).mockResolvedValue({
      agentName: 'calm-remediator',
      success: true,
      data: { changes: [], summary: 'mock' },
      duration: 1,
    });
  });

  it('aborts and never commits when the remediated CALM fails validation', async () => {
    vi.mocked(validateWithCalmCli).mockResolvedValue({
      valid: false,
      errors: [{ message: 'controls/foo: invalid control key' }],
    });

    const out = await readStream(await POST(makeReq(REMEDIATION_BODY)));

    expect(out).toContain('"type":"error"');
    expect(out).toContain('failed validation');
    // The specific validation error must be forwarded so the user sees WHY.
    expect(out).toContain('controls/foo: invalid control key');
    // The core guarantee: no GitHub mutation happened (no branch/commit/PR).
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it('aborts and never commits when the validator itself fails to run', async () => {
    // Infra failure (e.g. CLI not resolvable / child_process unavailable):
    // validateWithCalmCli throws → must still fail-closed with no GitHub write.
    vi.mocked(validateWithCalmCli).mockRejectedValue(new Error('ENOENT: calm cli not found'));

    const out = await readStream(await POST(makeReq(REMEDIATION_BODY)));

    expect(out).toContain('"type":"error"');
    expect(out).toContain('Could not validate');
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it('validates the MERGED output (not the original input) and proceeds when valid', async () => {
    // A control-added change for an unmatched id lands in top-level `controls`,
    // so the merged doc gains a `controls` key the empty input never had.
    vi.mocked(remediateCalm).mockResolvedValue({
      agentName: 'calm-remediator',
      success: true,
      data: {
        changes: [
          {
            nodeOrRelationshipId: 'unmatched',
            changeType: 'control-added',
            description: 'add MFA control',
            rationale: 'MFA required',
            before: '',
            after: 'mfa-control',
          },
        ],
        summary: 'mock',
      },
      duration: 1,
    });
    vi.mocked(validateWithCalmCli).mockResolvedValue({ valid: true, errors: [] });

    await readStream(await POST(makeReq(REMEDIATION_BODY)));

    // Gate validated the post-merge document (has `controls`), not the raw input.
    expect(vi.mocked(validateWithCalmCli)).toHaveBeenCalledWith(
      expect.objectContaining({
        controls: expect.objectContaining({ 'mfa-control': expect.anything() }),
      }),
    );
    // A valid document is NOT blocked — the flow proceeds to the GitHub calls.
    expect(githubFetch).toHaveBeenCalled();
  });
});
