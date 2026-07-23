// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { getOctokit } from '@actions/github';
import type { context as GitHubContext } from '@actions/github';

type Octokit = ReturnType<typeof getOctokit>;
type Context = typeof GitHubContext;

/**
 * Returns the list of .calm.json files changed in the current PR (not removed).
 * Returns an empty array when running outside a pull_request context.
 */
export async function getChangedCalmFiles(
  octokit: Octokit,
  context: Context
): Promise<string[]> {
  const prNumber = context.payload.pull_request?.number;

  // Not running in PR context — skip
  if (prNumber === undefined) {
    return [];
  }

  const { owner, repo } = context.repo;
  const response = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100
  });

  return response.data
    .filter((f) => f.status !== 'removed' && f.filename.endsWith('.calm.json'))
    .map((f) => f.filename);
}
