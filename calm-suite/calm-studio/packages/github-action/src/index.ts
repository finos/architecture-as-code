// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as core from '@actions/core';
import * as github from '@actions/github';
import { getChangedCalmFiles } from './changed-files.js';
import { renderCalmFile } from './render.js';
import { buildCommentBody, upsertComment } from './comment.js';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;

    // 1. Detect changed .calm.json files
    const changedFiles = await getChangedCalmFiles(octokit, context);
    if (changedFiles.length === 0) {
      core.info('No .calm.json files changed in this PR — skipping');
      return;
    }
    core.info(`Found ${changedFiles.length} changed CALM file(s): ${changedFiles.join(', ')}`);

    // 2. Render each file to SVG + validate
    const renders = await Promise.all(changedFiles.map((f) => renderCalmFile(f)));

    // 3. Commit SVGs to gh-diagrams branch and build comment body
    const body = await buildCommentBody(renders, octokit, context);

    // 4. Create or update PR comment
    const commentUrl = await upsertComment(octokit, context, body);
    if (commentUrl) {
      core.setOutput('comment-url', commentUrl);
    }

    // Log summary
    const totalErrors = renders.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === 'error').length,
      0
    );
    if (totalErrors > 0) {
      core.warning(
        `${totalErrors} validation error(s) found across ${changedFiles.length} CALM file(s)`
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
