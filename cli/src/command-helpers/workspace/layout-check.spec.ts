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
        it('extracts type segment from namespace $id URLs', () => {
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

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/timelines/t1/versions/1.0.0'
                )
            ).toBe('timelines');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/adrs/adr1/versions/1.0.0'
                )
            ).toBe('adrs');

            expect(
                extractTypeSegmentFromDocumentId(
                    'https://example.com/calm/namespaces/finos/decorators/eval1/versions/1.0.0'
                )
            ).toBe('decorators');
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

        it('returns undefined for non-CALM-Hub IDs', () => {
            expect(extractTypeSegmentFromDocumentId('my-architecture')).toBeUndefined();
            expect(extractTypeSegmentFromDocumentId('https://example.com/schemas/my-schema.json')).toBeUndefined();
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

        it('warns when a file is placed in another known directory of different type', async () => {
            const patDir = path.join(testDir, 'patterns');
            await mkdir(patDir, { recursive: true });
            const misplacedArch = path.join(patDir, 'misplaced-arch.json');
            await writeFile(
                misplacedArch,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/arch-in-patterns/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'misplaced-arch': {
                    path: path.relative(bundlePath, misplacedArch),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].expectedDirectory).toBe('architectures');
            expect(warnings[0].actualDirectory).toBe('patterns');
            expect(warnings[0].message).toContain('has $id type \'architectures\' but is in \'patterns/\'');
            expect(warnings[0].message).toContain('CALM Hub GitHub mode will read it as a pattern');
        });

        it('warns when a file is placed in an unknown directory', async () => {
            const draftDir = path.join(testDir, 'drafts');
            await mkdir(draftDir, { recursive: true });
            const draftArch = path.join(draftDir, 'draft-arch.json');
            await writeFile(
                draftArch,
                JSON.stringify({
                    $id: 'https://example.com/calm/namespaces/finos/architectures/draft-arch/versions/1.0.0',
                })
            );

            const manifest: WorkspaceManifest = {
                'draft-arch': {
                    path: path.relative(bundlePath, draftArch),
                    type: 'architecture',
                },
            };
            await saveManifest(bundlePath, manifest);

            const warnings = await checkWorkspaceLayout(bundlePath, manifest);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('has $id type \'architectures\' but is not in an \'architectures/\' directory');
            expect(warnings[0].message).toContain('CALM Hub GitHub mode will not read it as its type');
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
            expect(warnings[0].message).toContain('has $id type \'architectures\' but is not in an \'architectures/\' directory');
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
            expect(warnings[0].message).toContain('inside \'.calm-workspace/\' which is ignored by git');
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
            expect(warnings[0].message).toContain('has type \'flow\' but is not in an \'flows/\' directory');
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
                expect(warnings[0].message).toContain('is outside the repository');
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
