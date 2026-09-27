import { ranFailed, ranOk } from '../lessons/checks';
import { HOME_DIR, type Lesson } from '../lessons/types';
import PATTERN from '../cli/fixtures/web-app-pattern.json?raw';
import BROKEN from '../cli/fixtures/broken-webapp.json?raw';
import OK from '../cli/fixtures/ok.json?raw';

const GENERATED = `${HOME_DIR}/architectures/generated-webapp.json`;
const BROKEN_FILE = `${HOME_DIR}/architectures/broken-webapp.json`;
const VALIDATE_BROKEN = 'calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json';

/**
 * Not registered: the invariants spec runs it with the real lessons, so it proves that a lesson can
 * list a file `calm generate` creates and a hint can expect `calm validate` to fail.
 */
export const PATTERN_LESSON: Lesson = {
    id: 'invariants-pattern-fixture',
    title: 'Pattern fixture',
    editorFile: `${HOME_DIR}/architectures/ok.json`,
    editableFiles: [`${HOME_DIR}/architectures/ok.json`, GENERATED],
    seedFiles: {
        [`${HOME_DIR}/patterns/web-app-pattern.json`]: PATTERN,
        [BROKEN_FILE]: BROKEN,
        [`${HOME_DIR}/architectures/ok.json`]: OK,
    },
    steps: [
        {
            id: 'generate',
            title: 'Generate',
            body: 'Run `calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json`.',
            hint: { kind: 'commands', commands: ['calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json'] },
            check: (state) => ranOk(state, 'generate', { output: GENERATED }),
        },
        {
            id: 'fail',
            title: 'See it fail',
            body: `Run \`${VALIDATE_BROKEN}\`. It fails.`,
            hint: { kind: 'commands', commands: [{ run: VALIDATE_BROKEN, expect: 'failure' }] },
            check: (state) => ranFailed(state, 'validate', { architecture: BROKEN_FILE }),
        },
    ],
    completion: { heading: 'Done', message: 'Done.', links: [] },
};
