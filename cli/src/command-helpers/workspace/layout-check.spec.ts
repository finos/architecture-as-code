import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import {
    checkWorkspaceLayout,
    expectedDirectoryForDocument,
    extractTypeSegmentFromDocumentId,
} from './layout-check';
import { saveManifest, type WorkspaceManifest } from './bundle';

describe('layout-check', () => {
    describe('extractTypeSegmentFromDocumentId', () => {
        it('extracts type segment from conformant namespace $id URLs', () => {
            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/architectures/payment-svc/versions/1.0.0'
                )
            ).toBe('architectures');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/patterns/web-app/versions/2.0.0'
                )
            ).toBe('patterns');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/standards/pci/versions/1.0.0'
                )
            ).toBe('standards');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/flows/checkout/versions/1.0.0'
                )
            ).toBe('flows');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/interfaces/api/versions/1.0.0'
                )
            ).toBe('interfaces');
        });

        it('returns controls for domain control requirement and configuration $id URLs', () => {
            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/domains/security/controls/ac-1/requirement/versions/1.0.0'
                )
            ).toBe('controls');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/domains/security/controls/ac-1/configurations/strict/versions/1.0.0'
                )
            ).toBe('controls');
        });

        it('returns undefined for non-conformant or non-CALM-Hub IDs', () => {
            expect(extractTypeSegmentFromDocumentId('my-architecture')).toBeUndefined();
            expect(extractTypeSegmentFromDocumentId('https://example.com/schemas/my-schema.json')).toBeUndefined();
            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/adrs/adr1/versions/1.0.0'
                )
            ).toBeUndefined();
            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/architectures/arch/versions/1.0.0/extra'
                )
            ).toBeUndefined();
            expect(extractTypeSegmentFromDocumentId('')).toBeUndefined();
            expect(extractTypeSegmentFromDocumentId(null as unknown as string)).toBeUndefined();
        });
    });

    describe('expectedDirectoryForDocument', () => {
        it('resolves expected directory from $id URL', () => {
            expect(
                expectedDirectoryForDocument(
                    'https://example.com/calm/namespaces/finos/architectures/arch/versions/1.0.0'
                )
            ).toBe('architectures');
            expect(
                expectedDirectoryForDocument(
                    'https://example.com/calm/domains/sec/controls/c1/requirement/versions/1.0.0'
                )
            ).toBe('controls');
        });

        it('falls back to manifest type when $id has no URL segment', () => {
            expect(expectedDirectoryForDocument('local-arch', 'architecture')).toBe('architectures');
            expect(expectedDirectoryForDocument('local-pattern', 'pattern')).toBe('patterns');
            expect(expectedDirectoryForDocument('local-schema', 'schema')).toBe('standards');
            expect(expectedDirectoryForDocument('local-flow', 'flow')).toBe('flows');
            expect(expectedDirectoryForDocument('local-interface', 'interface')).toBe('interfaces');
            expect(expectedDirectoryForDocument('local-ctrl', 'control')).toBe('controls');
            expect(expectedDirectoryForDocument('local-timeline', 'timeline')).toBe('timelines');
            expect(expectedDirectoryForDocument('local-adr', 'adr')).toBe('adrs');
        });

        it('returns undefined when neither $id nor type resolves', () => {
            expect(expectedDirectoryForDocument('local-doc', 'unknown')).toBeUndefined();
            expect(expectedDirectoryForDocument('local-doc')).toBeUndefined();
        });
    });

    describe('checkWorkspaceLayout', () => {
        let testDir: string;
        let bundlePath: string;

        beforeEach(async () => {
            testDir = path.join(process.cwd(), 'temp-test-workspace-layout-' + Date.now());
            bundlePath = path.join(testDir, '.calm-workspace', 'bundles', 'default');
            await mkdir(bundlePath, { recursive: true });
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('produces no warnings when files are in their canonical directories', async () => {
            const archDir = path.join(testDir, 'architectures');
            await mkdir(archDir, { recursive: true });
            const archFile = path.join(archDir, 'arch.json');
            await writeFile(
                archFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/arch/versions/1.0.0',
                    nodes: [],
                })
            );

            const manifest: WorkspaceManifest = {
                'arch-id': {
                    path: path.relative(bundlePath, archFile),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('accepts standard-nodes alias for standards', async () => {
            const stdNodesDir = path.join(testDir, 'standard-nodes');
            await mkdir(stdNodesDir, { recursive: true });
            const stdFile = path.join(stdNodesDir, 'rate-limit.json');
            await writeFile(
                stdFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/standards/rate-limit/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'rate-limit': {
                    path: path.relative(bundlePath, stdFile),
                    type: 'schema',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('accepts files in nested subdirectories matching a known directory', async () => {
            const nestedDir = path.join(testDir, 'src', 'calm', 'patterns', 'sub');
            await mkdir(nestedDir, { recursive: true });
            const patFile = path.join(nestedDir, 'pat.json');
            await writeFile(
                patFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/patterns/pat/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                pat: {
                    path: path.relative(bundlePath, patFile),
                    type: 'pattern',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('does not warn when content sets the type in a directory that is not its type directory (rules 1 and 3)', async () => {
            const specsDir = path.join(testDir, 'specs');
            await mkdir(specsDir, { recursive: true });

            const flowFile = path.join(specsDir, 'payment-flow.json');
            await writeFile(
                flowFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/flows/payment-flow/versions/1.0.0',
                    $schema: 'https://calm.finos.org/release/1.2/meta/flow.json',
                    name: 'Payment Flow',
                })
            );

            const interfaceFile = path.join(specsDir, 'payment-api.json');
            await writeFile(
                interfaceFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/interfaces/payment-api/versions/1.0.0',
                    $schema: 'https://calm.finos.org/release/1.2/meta/interface.json',
                })
            );

            const controlFile = path.join(specsDir, 'tls-control.json');
            await writeFile(
                controlFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/domains/security/controls/tls/requirement/versions/1.0.0',
                    $schema: 'https://calm.finos.org/release/1.2/meta/control.json',
                })
            );

            const timelineMomentsFile = path.join(specsDir, 'roadmap-moments.json');
            await writeFile(
                timelineMomentsFile,
                JSON.stringify({
                    moments: [{ date: '2026-01-01' }],
                })
            );

            const timelineSchemaFile = path.join(specsDir, 'roadmap-schema.json');
            await writeFile(
                timelineSchemaFile,
                JSON.stringify({
                    $schema: 'https://calm.finos.org/release/1.3/meta/calm-timeline.json',
                })
            );

            const manifest: WorkspaceManifest = {
                'payment-flow': {
                    path: path.relative(bundlePath, flowFile),
                    type: 'flow',
                },
                'payment-api': {
                    path: path.relative(bundlePath, interfaceFile),
                    type: 'interface',
                },
                'tls-control': {
                    path: path.relative(bundlePath, controlFile),
                    type: 'control',
                },
                'roadmap-moments': {
                    path: path.relative(bundlePath, timelineMomentsFile),
                    type: 'timeline',
                },
                'roadmap-schema': {
                    path: path.relative(bundlePath, timelineSchemaFile),
                    type: 'timeline',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('warns when a file is placed in another known directory of different type', async () => {
            const patDir = path.join(testDir, 'patterns');
            const adrDir = path.join(testDir, 'adrs');
            await mkdir(patDir, { recursive: true });
            await mkdir(adrDir, { recursive: true });

            const misplacedInPatterns = path.join(patDir, 'misplaced-arch.json');
            await writeFile(
                misplacedInPatterns,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/arch-in-patterns/versions/1.0.0',
                })
            );

            const misplacedInAdrs = path.join(adrDir, 'misplaced-arch.json');
            await writeFile(
                misplacedInAdrs,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/arch-in-adrs/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'misplaced-in-patterns': {
                    path: path.relative(bundlePath, misplacedInPatterns),
                    type: 'architecture',
                },
                'misplaced-in-adrs': {
                    path: path.relative(bundlePath, misplacedInAdrs),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(2);
            expect(warnings[0].expectedDirectory).toBe('architectures');
            expect(warnings[0].actualDirectory).toBe('patterns');
            expect(warnings[0].message).toBe(
                'Tracked file \'patterns/misplaced-arch.json\' has $id type \'architectures\' but is in \'patterns/\'; expected directory \'architectures/\'. CALM Hub GitHub mode will read it as a pattern.'
            );
            expect(warnings[1].expectedDirectory).toBe('architectures');
            expect(warnings[1].actualDirectory).toBe('adrs');
            expect(warnings[1].message).toBe(
                'Tracked file \'adrs/misplaced-arch.json\' has $id type \'architectures\' but is in \'adrs/\'; expected directory \'architectures/\'. CALM Hub GitHub mode will read it as an adr.'
            );
        });

        it('states that CALM Hub will not import an architecture with nodes in controls/', async () => {
            const controlsDir = path.join(testDir, 'controls');
            await mkdir(controlsDir, { recursive: true });
            const misplacedArch = path.join(controlsDir, 'arch-with-nodes.json');
            await writeFile(
                misplacedArch,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/arch-with-nodes/versions/1.0.0',
                    nodes: [],
                })
            );

            const manifest: WorkspaceManifest = {
                'arch-with-nodes': {
                    path: path.relative(bundlePath, misplacedArch),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].expectedDirectory).toBe('architectures');
            expect(warnings[0].actualDirectory).toBe('controls');
            expect(warnings[0].message).toBe(
                'Tracked file \'controls/arch-with-nodes.json\' has $id type \'architectures\' but is in \'controls/\'; expected directory \'architectures/\'. CALM Hub GitHub mode will not import the file.'
            );
        });

        it('warns when a file is placed in an unknown directory, including one starting with ..', async () => {
            const draftDir = path.join(testDir, 'drafts');
            const dotDotDraftDir = path.join(testDir, '..drafts');
            await mkdir(draftDir, { recursive: true });
            await mkdir(dotDotDraftDir, { recursive: true });

            const draftArch = path.join(draftDir, 'draft-arch.json');
            await writeFile(
                draftArch,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/draft-arch/versions/1.0.0',
                })
            );

            const dotDotDraftArch = path.join(dotDotDraftDir, 'draft-arch.json');
            await writeFile(
                dotDotDraftArch,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/dotdot-arch/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'draft-arch': {
                    path: path.relative(bundlePath, draftArch),
                    type: 'architecture',
                },
                'dotdot-arch': {
                    path: path.relative(bundlePath, dotDotDraftArch),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(2);
            expect(warnings[0].message).toBe(
                'Tracked file \'drafts/draft-arch.json\' has $id type \'architectures\' but is not in an \'architectures/\' directory. CALM Hub GitHub mode will not import the file.'
            );
            expect(warnings[1].message).toBe(
                'Tracked file \'..drafts/draft-arch.json\' has $id type \'architectures\' but is not in an \'architectures/\' directory. CALM Hub GitHub mode will not import the file.'
            );
        });

        it('warns when a file is in the project root with no directory', async () => {
            const rootFile = path.join(testDir, 'root-arch.json');
            await writeFile(
                rootFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/root-arch/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'root-arch': {
                    path: path.relative(bundlePath, rootFile),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toBe(
                'Tracked file \'root-arch.json\' has $id type \'architectures\' but is not in an \'architectures/\' directory. CALM Hub GitHub mode will not import the file.'
            );
        });

        it('warns when a file is inside .calm-workspace directory', async () => {
            const filesDir = path.join(bundlePath, 'files');
            await mkdir(filesDir, { recursive: true });
            const copiedFile = path.join(filesDir, 'copied.json');
            await writeFile(
                copiedFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/copied/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                copied: {
                    path: 'files/copied.json',
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toBe(
                'Tracked file \'.calm-workspace/bundles/default/files/copied.json\' is inside \'.calm-workspace/\' which is ignored by git. CALM Hub GitHub mode will not find it.'
            );
        });

        it('skips narrative documents like sad and knowledge', async () => {
            const docsDir = path.join(testDir, 'docs');
            await mkdir(docsDir, { recursive: true });
            const docFile = path.join(docsDir, 'sad.md');
            await writeFile(docFile, '# System Architecture Document');

            const manifest: WorkspaceManifest = {
                sad: {
                    path: path.relative(bundlePath, docFile),
                    type: 'sad',
                    version: '1.0.0',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('uses manifest type when $id has no URL pattern', async () => {
            const miscDir = path.join(testDir, 'misc');
            await mkdir(miscDir, { recursive: true });
            const flowFile = path.join(miscDir, 'flow.json');
            await writeFile(flowFile, JSON.stringify({ name: 'my-flow' }));

            const manifest: WorkspaceManifest = {
                'flow-1': {
                    path: path.relative(bundlePath, flowFile),
                    type: 'flow',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].expectedDirectory).toBe('flows');
            expect(warnings[0].message).toBe(
                'Tracked file \'misc/flow.json\' has type \'flow\' but is not in a \'flows/\' directory. CALM Hub GitHub mode will not import the file.'
            );
        });

        it('skips tracked files that do not exist on disk', async () => {
            const manifest: WorkspaceManifest = {
                'missing-doc': {
                    path: '../../nonexistent/arch.json',
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('skips documents with unknown manifest type and no URL $id', async () => {
            const miscDir = path.join(testDir, 'misc');
            await mkdir(miscDir, { recursive: true });
            const unknownFile = path.join(miscDir, 'unknown.json');
            await writeFile(unknownFile, JSON.stringify({ custom: 'data' }));

            const manifest: WorkspaceManifest = {
                'unknown-doc': {
                    path: path.relative(bundlePath, unknownFile),
                    type: 'unknown',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(0);
        });

        it('warns when a tracked file is located outside the repository', async () => {
            const outsideDir = path.join(process.cwd(), 'temp-outside-repo-' + Date.now());
            await mkdir(outsideDir, { recursive: true });
            const outsideFile = path.join(outsideDir, 'arch.json');
            await writeFile(
                outsideFile,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/outside/versions/1.0.0',
                })
            );

            try {
                const manifest: WorkspaceManifest = {
                    outside: {
                        path: path.relative(bundlePath, outsideFile),
                        type: 'architecture',
                    },
                };
                await saveManifest(bundlePath, manifest);

                const warnings = await checkWorkspaceLayout(bundlePath, manifest);
                expect(warnings).toHaveLength(1);
                expect(warnings[0].message).toBe(
                    `Tracked file '${outsideFile}' is outside the repository. CALM Hub GitHub mode will not find it.`
                );
            } finally {
                await rm(outsideDir, { recursive: true, force: true });
            }
        });

        it('loads manifest from bundlePath when manifest argument is omitted', async () => {
            const warnings = await checkWorkspaceLayout(bundlePath);
            expect(warnings).toEqual([]);
        });
    });
});

