import { HOME_DIR, type Lesson, type LessonState } from '../types';
import { fileText, filledAdr, linkedAdrs, validatedEditorFile } from '../checks';
import { INTERMEDIATE_09 } from '../intermediate-09/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = INTERMEDIATE_09.editorFile;
const BASE_FILE = endFiles(INTERMEDIATE_09)[EDITOR_FILE];

const ADR_1 = `${HOME_DIR}/docs/adr/0001-use-message-queue-for-async-processing.md`;
const ADR_2 = `${HOME_DIR}/docs/adr/0002-use-oauth2-for-api-authentication.md`;

// Seeded as MADR templates: the headings a learner must fill are present, each with a TODO
// placeholder body, so every step starts false.
const ADR_1_SEED = `# 1. Use Message Queue for Asynchronous Order Processing

Date: 2024-12-15

## Status
TODO: state whether this decision is proposed, accepted, deprecated or superseded.

## Context
TODO: describe the situation and the problem this decision addresses.

## Decision
TODO: describe what was decided and the key technical details.

## Consequences
TODO: describe the positive and negative consequences.
`;

const ADR_2_SEED = `# 2. Use OAuth2 for API Authentication

Date: 2024-12-15

## Status
TODO: state whether this decision is proposed, accepted, deprecated or superseded.

## Context
TODO: describe the situation and the problem this decision addresses.

## Decision
TODO: describe what was decided and the key technical details.

## Consequences
TODO: describe the positive and negative consequences.
`;

// Paste-safe hints: each is the complete target file, building on the previous step.
const ADR_1_FILLED = `# 1. Use Message Queue for Asynchronous Order Processing

Date: 2024-12-15

## Status
Accepted

## Context
Order Service calls Payment Service directly today. A slow or briefly unavailable payment
processor blocks order submission, and a failed payment has no retry path.

## Decision
Introduce a RabbitMQ message broker between Order Service and Payment Service. Order Service
publishes an order-placed event; Payment Service consumes it and processes payment asynchronously,
retrying on failure.

## Consequences
Order submission no longer waits on payment processing, and the two services scale independently.
Order status becomes eventually consistent, and the queue needs monitoring for backlog.
`;

const ADR_2_FILLED = `# 2. Use OAuth2 for API Authentication

Date: 2024-12-15

## Status
Accepted

## Context
The API Gateway serves web, mobile and third-party clients. Each needs a standard way to prove
its identity without the gateway managing per-client credentials.

## Decision
Authenticate every client at the API Gateway with OAuth2, issuing short-lived JWT access tokens
and longer-lived refresh tokens.

## Consequences
Clients share one well-understood authentication flow, and the gateway stays stateless. Clients
must implement token refresh, and revoking a token before it expires needs extra infrastructure.
`;

const STEP_3_TARGET_FILE = BASE_FILE.replace(
    '"$schema": "https://calm.finos.org/release/1.2/meta/calm.json",\n    "metadata": {',
    '"$schema": "https://calm.finos.org/release/1.2/meta/calm.json",\n    "adrs": [\n' +
        '        "docs/adr/0001-use-message-queue-for-async-processing.md",\n' +
        '        "docs/adr/0002-use-oauth2-for-api-authentication.md"\n' +
        '    ],\n    "metadata": {',
);

const adrsLinked = (state: LessonState) => {
    const linked = linkedAdrs(state);
    return linked.length >= 2 && linked.every((path) => filledAdr(fileText(state, path)));
};

export const INTERMEDIATE_10: Lesson = {
    id: 'intermediate-10',
    title: 'Link architecture decision records',
    tutorial: { title: 'Link Architecture Decision Records', url: 'https://calm.finos.org/tutorials/intermediate/10-adr-linking/' },
    chainsFrom: 'intermediate-09',
    editorFile: EDITOR_FILE,
    editableFiles: [EDITOR_FILE, ADR_1, ADR_2],
    seedFiles: { ...endFiles(INTERMEDIATE_09), [ADR_1]: ADR_1_SEED, [ADR_2]: ADR_2_SEED },
    steps: [
        {
            id: 'adr-queue',
            title: 'Fill in the message queue ADR',
            body:
                'Open `docs/adr/0001-use-message-queue-for-async-processing.md` from the File selector. Replace each ' +
                '`TODO` under `## Status`, `## Context`, `## Decision` and `## Consequences` with real content for ' +
                'introducing a message queue between Order Service and Payment Service. Save your change.',
            hint: { kind: 'file', path: ADR_1, content: ADR_1_FILLED },
            check: (state) => filledAdr(fileText(state, ADR_1)),
        },
        {
            id: 'adr-oauth',
            title: 'Fill in the OAuth2 ADR',
            body:
                'Open `docs/adr/0002-use-oauth2-for-api-authentication.md`. Replace each `TODO` under `## Status`, ' +
                '`## Context`, `## Decision` and `## Consequences` with real content for authenticating API clients ' +
                'with OAuth2. Save your change.',
            hint: { kind: 'file', path: ADR_2, content: ADR_2_FILLED },
            check: (state) => filledAdr(fileText(state, ADR_2)),
        },
        {
            id: 'link-adrs',
            title: 'Link both ADRs to the architecture',
            body:
                'Switch back to `architectures/ecommerce-platform.json`. Add a top-level `adrs` array with the two ' +
                'ADRs\' relative paths, `docs/adr/0001-use-message-queue-for-async-processing.md` and ' +
                '`docs/adr/0002-use-oauth2-for-api-authentication.md`. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => adrsLinked(state) && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate the architecture',
            body: 'Run `calm validate -a architectures/ecommerce-platform.json -f pretty`. The summary should report 0 errors.',
            hint: { kind: 'commands', commands: ['calm validate -a architectures/ecommerce-platform.json -f pretty'] },
            check: (state) => validatedEditorFile(state) && adrsLinked(state) && state.validation.ok,
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You linked architecture decision records to your architecture. The `adrs` array traces each significant ' +
            'decision back to the architecture it shaped, whether the record lives in your workspace or an external tool.',
        links: [],
    },
};
