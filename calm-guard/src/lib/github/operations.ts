import { githubFetch } from './client';

/**
 * GitHub API operations for PR creation — server-side only.
 *
 * All functions use githubFetch and require a valid GITHUB_TOKEN with 'repo' scope.
 * Error messages are descriptive to help diagnose auth / permissions issues.
 */

/**
 * Get the SHA of the HEAD commit on a branch.
 *
 * @param owner - Repository owner (user or org)
 * @param repo - Repository name
 * @param branch - Branch name (e.g. "main")
 * @param token - GitHub personal access token with repo scope
 * @returns The commit SHA of the HEAD of the branch
 */
export async function getHeadSha(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<string> {
  const res = await githubFetch(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { token },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to get HEAD SHA for ${owner}/${repo}@${branch} (${res.status}): ${body}`,
    );
  }

  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

/**
 * Create a new branch from a given commit SHA.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branchName - New branch name (e.g. "calmguard/pipeline-1234567890")
 * @param sha - Commit SHA to branch from
 * @param token - GitHub personal access token with repo scope
 */
export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  sha: string,
  token: string,
): Promise<void> {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    token,
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to create branch ${branchName} in ${owner}/${repo} (${res.status}): ${body}`,
    );
  }
}

/**
 * Commit multiple files atomically to a branch using the Git Data API.
 *
 * Creates blobs, a tree, a commit, and updates the branch ref in a single logical operation.
 * All files are committed in one commit — not one commit per file.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to commit to
 * @param files - Array of { path, content } objects (content is raw UTF-8 string)
 * @param commitMessage - Commit message
 * @param headSha - The current HEAD SHA of the branch (used as parent)
 * @param token - GitHub personal access token with repo scope
 * @returns The new commit SHA
 */
export async function commitMultipleFiles(
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  commitMessage: string,
  headSha: string,
  token: string,
): Promise<string> {
  // Step 1: Create blobs in parallel (base64-encoded)
  const blobShas = await Promise.all(
    files.map(async (file) => {
      const res = await githubFetch(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Failed to create blob for ${file.path} (${res.status}): ${body}`,
        );
      }

      const data = (await res.json()) as { sha: string };
      return { path: file.path, blobSha: data.sha };
    }),
  );

  // Step 2: Create tree with all blobs
  const treeRes = await githubFetch(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      base_tree: headSha,
      tree: blobShas.map(({ path, blobSha }) => ({
        path,
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      })),
    }),
  });

  if (!treeRes.ok) {
    const body = await treeRes.text();
    throw new Error(`Failed to create tree in ${owner}/${repo} (${treeRes.status}): ${body}`);
  }

  const treeData = (await treeRes.json()) as { sha: string };
  const treeSha = treeData.sha;

  // Step 3: Create commit
  const commitRes = await githubFetch(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      message: commitMessage,
      tree: treeSha,
      parents: [headSha],
    }),
  });

  if (!commitRes.ok) {
    const body = await commitRes.text();
    throw new Error(
      `Failed to create commit in ${owner}/${repo} (${commitRes.status}): ${body}`,
    );
  }

  const commitData = (await commitRes.json()) as { sha: string };
  const commitSha = commitData.sha;

  // Step 4: Update branch ref to point at new commit
  // URL-encode the branch name — it may contain '/' (e.g. "calmguard/pipeline-123")
  const refRes = await githubFetch(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ sha: commitSha }),
    },
  );

  if (!refRes.ok) {
    const body = await refRes.text();
    throw new Error(
      `Failed to update ref for ${branch} in ${owner}/${repo} (${refRes.status}): ${body}`,
    );
  }

  return commitSha;
}

/**
 * Create a pull request.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param head - Head branch (source branch with changes)
 * @param base - Base branch (target branch to merge into)
 * @param title - PR title
 * @param body - PR description (Markdown)
 * @param token - GitHub personal access token with repo scope
 * @returns The PR URL and number
 */
/**
 * Create a label in a repository, ignoring 422 (already exists).
 * Labels are cosmetic — failure is non-critical.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param name - Label name (e.g. "ci/cd")
 * @param color - Hex color without '#' (e.g. "0075ca")
 * @param description - Short label description
 * @param token - GitHub personal access token with repo scope
 */
export async function ensureLabel(
  owner: string,
  repo: string,
  name: string,
  color: string,
  description: string,
  token: string,
): Promise<void> {
  const res = await githubFetch(`/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name, color, description }),
  });
  // 201 = created, 422 = already exists — both are fine
  if (!res.ok && res.status !== 422) {
    console.warn(`Failed to ensure label "${name}" (${res.status})`);
  }
}

/**
 * Add labels to a PR (PRs are issues in GitHub's data model).
 * Label failures are non-critical — log but don't throw.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param labels - Array of label names to add
 * @param token - GitHub personal access token with repo scope
 */
export async function addLabelToPR(
  owner: string,
  repo: string,
  prNumber: number,
  labels: string[],
  token: string,
): Promise<void> {
  const res = await githubFetch(`/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    token,
    body: JSON.stringify({ labels }),
  });
  if (!res.ok) {
    console.warn(`Failed to add labels to PR #${prNumber}: ${res.status}`);
  }
}

export async function createPR(
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
  token: string,
): Promise<{ html_url: string; number: number }> {
  const res = await githubFetch(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    token,
    body: JSON.stringify({ title, body, head, base }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Failed to create PR in ${owner}/${repo} (${res.status}): ${errorBody}`,
    );
  }

  const data = (await res.json()) as { html_url: string; number: number };
  return { html_url: data.html_url, number: data.number };
}
