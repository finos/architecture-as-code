import { generateNotes as generate } from '@semantic-release/release-notes-generator';
import { expandForkMerges } from './release-notes.mjs';

// List each commit of a fork merge, as the analyzer reads them.
export async function generateNotes(pluginConfig, context) {
    return generate(pluginConfig, { ...context, commits: expandForkMerges(context.commits) });
}
