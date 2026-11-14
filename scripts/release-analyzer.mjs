import { analyzeCommits as analyze } from '@semantic-release/commit-analyzer';
import { expandForkMerges, listedCommitsOnMain } from './release-notes.mjs';

// Analyze only the commits that the release notes list.
export async function analyzeCommits(pluginConfig, context) {
    const listed = listedCommitsOnMain(pluginConfig.paths);
    return analyze(pluginConfig, { ...context, commits: expandForkMerges(context.commits.filter(commit => listed.has(commit.hash))) });
}
