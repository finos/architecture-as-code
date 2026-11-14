import { releaseConfig } from '../scripts/release-notes.mjs';

// The paths that the docker-publish-calm-hub*.yml workflows build from, so that a dependency fix
// (`fix(deps)`) releases CALM Hub only when it changes the image.
export default releaseConfig({
    product: 'CALM Hub',
    tagFormat: 'calm-hub-v${version}',
    scopes: ['calm-hub', 'calm-hub-ui', 'deps'],
    paths: [
        ':(top)calm-hub',
        ':(top,exclude)calm-hub/ec2',
        ':(top)calm-hub-ui',
        ':(top)package.json',
        ':(top)package-lock.json',
        ':(top)calm-models',
        ':(top)scripts/copy-calm-schemas.mjs',
    ],
    npmPackage: false,
});
