import { releaseConfig } from '../scripts/release-notes.mjs';

export default releaseConfig({
    product: 'CALM CLI',
    tagFormat: 'cli-v${version}',
    scopes: ['cli', 'shared', 'calm-models', 'calm-ai', 'calm-widgets'],
});
