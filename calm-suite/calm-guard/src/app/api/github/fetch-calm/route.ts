import { NextResponse } from 'next/server';
import { githubFetch } from '@/lib/github/client';
import {
  githubFetchInputSchema,
  githubContentsResponseSchema,
  githubRepoResponseSchema,
} from '@/lib/github/types';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  // GITHUB_TOKEN is optional — public repos work without auth (lower rate limits)
  const token = process.env.GITHUB_TOKEN;
  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const inputResult = githubFetchInputSchema.safeParse(body);
  if (!inputResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request parameters',
        issues: inputResult.error.issues.map((i) => i.message),
      },
      { status: 400 },
    );
  }

  const { owner, repo, filePath } = inputResult.data;

  // Step 1: Fetch repo metadata to get default branch
  let defaultBranch: string;
  try {
    const repoRes = await githubFetch(`/repos/${owner}/${repo}`, { token: token ?? undefined });

    if (repoRes.status === 404) {
      return NextResponse.json(
        { error: `Repository '${owner}/${repo}' not found. Check that the owner and repo name are correct.` },
        { status: 404 },
      );
    }
    if (repoRes.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token is invalid or expired. Please update GITHUB_TOKEN.' },
        { status: 401 },
      );
    }
    if (repoRes.status === 403) {
      return NextResponse.json(
        { error: 'GitHub API rate limit exceeded or token lacks repo access. Try again later.' },
        { status: 403 },
      );
    }
    if (!repoRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${repoRes.status} ${repoRes.statusText}` },
        { status: repoRes.status },
      );
    }

    const repoData = await repoRes.json() as unknown;
    const repoResult = githubRepoResponseSchema.safeParse(repoData);
    if (!repoResult.success) {
      return NextResponse.json(
        { error: 'Unexpected GitHub API response format for repository metadata.' },
        { status: 502 },
      );
    }
    defaultBranch = repoResult.data.default_branch;
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to connect to GitHub API: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 },
    );
  }

  // Step 2: Fetch the CALM file contents
  let fileSha: string;
  let rawContent: string;
  try {
    const contentsRes = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, { token: token ?? undefined });

    if (contentsRes.status === 404) {
      return NextResponse.json(
        { error: `File '${filePath}' not found in ${owner}/${repo}. Check the file path.` },
        { status: 404 },
      );
    }
    if (contentsRes.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token is invalid or expired. Please update GITHUB_TOKEN.' },
        { status: 401 },
      );
    }
    if (contentsRes.status === 403) {
      return NextResponse.json(
        { error: 'GitHub API rate limit exceeded or insufficient token permissions.' },
        { status: 403 },
      );
    }
    if (!contentsRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${contentsRes.status} ${contentsRes.statusText}` },
        { status: contentsRes.status },
      );
    }

    const contentsData = await contentsRes.json() as unknown;
    const contentsResult = githubContentsResponseSchema.safeParse(contentsData);
    if (!contentsResult.success) {
      return NextResponse.json(
        {
          error:
            'Unexpected GitHub Contents API response. The path may point to a directory or the file encoding is unsupported.',
        },
        { status: 422 },
      );
    }

    fileSha = contentsResult.data.sha;
    // Decode base64 content — GitHub returns it with newlines embedded
    rawContent = Buffer.from(contentsResult.data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch file from GitHub: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 },
    );
  }

  // Step 3: Parse the decoded JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    return NextResponse.json(
      { error: `File '${filePath}' is not valid JSON. Ensure it is a valid CALM JSON file.` },
      { status: 422 },
    );
  }

  // Step 4: Validate as CALM document
  const calmResult = parseCalm(parsedJson);
  if (!calmResult.success) {
    return NextResponse.json(
      {
        error: `File '${filePath}' is not a valid CALM document: ${calmResult.error.message}`,
        issues: calmResult.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  // Step 5: Extract analysis input
  const analysisInput = extractAnalysisInput(calmResult.data);

  return NextResponse.json({
    calm: calmResult.data,
    analysisInput,
    fileSha,
    defaultBranch,
    version: calmResult.version,
  });
}
