import { releaseConfig } from '../scripts/release-notes.mjs';

export default releaseConfig({
    product: 'CALM Server',
    tagFormat: 'calm-server-v${version}',
    scopes: ['calm-server', 'shared', 'calm-models', 'calm-widgets'],
});
