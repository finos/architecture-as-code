import { analyzeCommits as analyze } from '@semantic-release/commit-analyzer';
import { listed } from './release.config.mjs';

// Analyze only the commits that the release notes list.
export async function analyzeCommits(pluginConfig, context) {
    return analyze(pluginConfig, { ...context, commits: context.commits.filter(commit => listed.has(commit.hash)) });
}
