// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CalmArchitecture } from '@calmstudio/calm-core';

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const sampleArch: CalmArchitecture = {
  nodes: [
    { 'unique-id': 'node-1', 'node-type': 'system', name: 'Frontend', description: 'User-facing frontend' },
    { 'unique-id': 'node-2', 'node-type': 'service', name: 'API', description: 'REST API service' }
  ],
  relationships: [
    { 'unique-id': 'rel-1', 'relationship-type': 'connects', source: 'node-1', destination: 'node-2' }
  ]
};

// ---------------------------------------------------------------------------
// Mock Octokit factory
// ---------------------------------------------------------------------------

function makeMockOctokit(overrides: Record<string, unknown> = {}) {
  return {
    rest: {
      pulls: {
        listFiles: vi.fn().mockResolvedValue({ data: [] })
      },
      issues: {
        listComments: vi.fn().mockResolvedValue({ data: [] }),
        createComment: vi.fn().mockResolvedValue({ data: { id: 1, html_url: 'https://github.com/owner/repo/issues/1#comment-1' } }),
        updateComment: vi.fn().mockResolvedValue({ data: { id: 1, html_url: 'https://github.com/owner/repo/issues/1#comment-1' } })
      },
      repos: {
        createOrUpdateFileContents: vi.fn().mockResolvedValue({ data: {} })
      }
    },
    ...overrides
  };
}

function makeMockContext(prNumber?: number) {
  return {
    repo: { owner: 'owner', repo: 'repo' },
    payload: prNumber !== undefined ? { pull_request: { number: prNumber } } : {}
  };
}

// ---------------------------------------------------------------------------
// changed-files.ts tests
// ---------------------------------------------------------------------------

describe('getChangedCalmFiles', () => {
  it('filters Octokit response to only .calm.json files, excludes removed', async () => {
    const { getChangedCalmFiles } = await import('../changed-files.js');
    const octokit = makeMockOctokit();
    (octokit.rest.pulls.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { filename: 'arch/api.calm.json', status: 'modified' },
        { filename: 'arch/db.calm.json', status: 'added' },
        { filename: 'arch/old.calm.json', status: 'removed' },
        { filename: 'src/main.ts', status: 'modified' },
        { filename: 'README.md', status: 'modified' }
      ]
    });
    const context = makeMockContext(42);

    const result = await getChangedCalmFiles(octokit as never, context as never);

    expect(result).toEqual(['arch/api.calm.json', 'arch/db.calm.json']);
  });

  it('returns empty array when no .calm.json files changed', async () => {
    const { getChangedCalmFiles } = await import('../changed-files.js');
    const octokit = makeMockOctokit();
    (octokit.rest.pulls.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { filename: 'src/main.ts', status: 'modified' },
        { filename: 'README.md', status: 'added' }
      ]
    });
    const context = makeMockContext(42);

    const result = await getChangedCalmFiles(octokit as never, context as never);

    expect(result).toEqual([]);
  });

  it('returns empty array when PR number is undefined (non-PR context)', async () => {
    const { getChangedCalmFiles } = await import('../changed-files.js');
    const octokit = makeMockOctokit();
    const context = makeMockContext(undefined);

    const result = await getChangedCalmFiles(octokit as never, context as never);

    expect(result).toEqual([]);
    expect(octokit.rest.pulls.listFiles).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// render.ts tests
// ---------------------------------------------------------------------------

const tmpFile = join(tmpdir(), `gh-action-render-test-${Date.now()}.calm.json`);

describe('renderCalmFile', () => {
  beforeEach(() => {
    writeFileSync(tmpFile, JSON.stringify(sampleArch, null, 2), 'utf-8');
  });

  it('returns { svg, issues } object for valid CALM JSON content', async () => {
    const { renderCalmFile } = await import('../render.js');
    const result = await renderCalmFile(tmpFile);

    expect(result.fileName).toBe(tmpFile.split('/').pop());
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('</svg>');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('returns error SVG and validation errors for invalid JSON', async () => {
    const { renderCalmFile } = await import('../render.js');
    const badFile = join(tmpdir(), `gh-action-bad-test-${Date.now()}.calm.json`);
    writeFileSync(badFile, 'not valid json', 'utf-8');

    const result = await renderCalmFile(badFile);

    expect(result.svg).toContain('<svg');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]?.severity).toBe('error');

    if (existsSync(badFile)) unlinkSync(badFile);
  });
});

// ---------------------------------------------------------------------------
// comment.ts tests
// ---------------------------------------------------------------------------

describe('MARKER', () => {
  it('is exactly <!-- calmstudio-diagram-comment -->', async () => {
    const { MARKER } = await import('../comment.js');
    expect(MARKER).toBe('<!-- calmstudio-diagram-comment -->');
  });
});

describe('buildCommentBody', () => {
  it('includes MARKER, file heading, and validation summary', async () => {
    const { buildCommentBody, MARKER } = await import('../comment.js');
    const renders = [
      {
        fileName: 'arch/api.calm.json',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>API</text></svg>',
        issues: []
      }
    ];
    const octokit = makeMockOctokit();
    const context = makeMockContext(1);

    const body = await buildCommentBody(renders, octokit as never, context as never);

    expect(body).toContain(MARKER);
    expect(body).toContain('arch/api.calm.json');
    expect(body).toContain('CALM Architecture Diagrams');
  });

  it('shows validation errors and warnings inline with each diagram', async () => {
    const { buildCommentBody } = await import('../comment.js');
    const renders = [
      {
        fileName: 'arch/broken.calm.json',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Error</text></svg>',
        issues: [
          { severity: 'error' as const, message: 'Missing required field: unique-id' },
          { severity: 'warning' as const, message: 'Node has no description' }
        ]
      }
    ];
    const octokit = makeMockOctokit();
    const context = makeMockContext(1);

    const body = await buildCommentBody(renders, octokit as never, context as never);

    expect(body).toContain('Missing required field: unique-id');
    expect(body).toContain('Node has no description');
    expect(body).toContain('error');
  });
});

describe('upsertComment', () => {
  it('creates new comment when no existing comment with MARKER found', async () => {
    const { upsertComment, MARKER } = await import('../comment.js');
    const octokit = makeMockOctokit();
    (octokit.rest.issues.listComments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    const context = makeMockContext(42);

    const url = await upsertComment(octokit as never, context as never, `${MARKER}\nHello`);

    expect(octokit.rest.issues.createComment).toHaveBeenCalledOnce();
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
    expect(url).toContain('github.com');
  });

  it('updates existing comment when MARKER comment already exists', async () => {
    const { upsertComment, MARKER } = await import('../comment.js');
    const octokit = makeMockOctokit();
    (octokit.rest.issues.listComments as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { id: 99, body: `${MARKER}\nOld content` },
        { id: 100, body: 'Some other comment' }
      ]
    });
    const context = makeMockContext(42);

    const url = await upsertComment(octokit as never, context as never, `${MARKER}\nNew content`);

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 })
    );
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(url).toContain('github.com');
  });
});
