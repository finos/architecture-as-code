import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    WorkspaceAssetService,
    frontMatterControlsToMap,
    type LocalControlDef,
} from './workspace-asset-service';

const encode = (s: string) => new TextEncoder().encode(s);

const localControls: LocalControlDef[] = [
    {
        id: 'micro-segmentation',
        controlId: 'security-001',
        name: 'Micro-segmentation',
        description: 'Prevent lateral movement',
        filePath: '/ws/controls/micro-segmentation.requirement.json',
        relativePath: 'controls/micro-segmentation.requirement.json',
    },
];

describe('frontMatterControlsToMap', () => {
    it('resolves a local control-ref, seeding identity constants into config', () => {
        const { controls, warnings } = frontMatterControlsToMap(
            ['controls/micro-segmentation.requirement.json'],
            [],
            localControls
        );
        expect(warnings).toEqual([]);
        expect(controls['micro-segmentation']).toEqual({
            description: 'Prevent lateral movement',
            requirements: [
                {
                    'requirement-url': 'controls/micro-segmentation.requirement.json',
                    config: {
                        'control-id': 'security-001',
                        name: 'Micro-segmentation',
                        description: 'Prevent lateral movement',
                    },
                },
            ],
        });
    });

    it('eagerly seeds identity when a Hub CURIE slug matches a local control', () => {
        const { controls, warnings } = frontMatterControlsToMap(
            ['security:controls:micro-segmentation@1.0.0'],
            [],
            localControls
        );
        expect(warnings).toEqual([]);
        expect(controls['security--micro-segmentation']).toEqual({
            description: 'Prevent lateral movement',
            requirements: [
                {
                    'requirement-url': 'security:controls:micro-segmentation@1.0.0',
                    config: {
                        'control-id': 'security-001',
                        name: 'Micro-segmentation',
                        description: 'Prevent lateral movement',
                    },
                },
            ],
        });
    });

    it('stores a Hub CURIE ref with an empty config when no local match', () => {
        const { controls } = frontMatterControlsToMap(
            ['security:controls:micro-segmentation@1.0.0'],
            [],
            []
        );
        expect(controls['security--micro-segmentation']).toEqual({
            description: 'micro-segmentation',
            requirements: [
                { 'requirement-url': 'security:controls:micro-segmentation@1.0.0', config: {} },
            ],
        });
    });

    it('warns and skips a missing local ref', () => {
        const { controls, warnings } = frontMatterControlsToMap(
            ['controls/does-not-exist.requirement.json'],
            [],
            localControls
        );
        expect(controls).toEqual({});
        expect(warnings[0]).toContain('Local control not found');
    });

    it('lets a control-ref take precedence over a colliding legacy entry', () => {
        const { controls } = frontMatterControlsToMap(
            ['controls/micro-segmentation.requirement.json'],
            [{ id: 'micro-segmentation', name: 'Old Inline', description: 'legacy' }],
            localControls
        );
        // ref-derived entry wins
        expect(controls['micro-segmentation']).toMatchObject({
            description: 'Prevent lateral movement',
        });
    });

    it('parses a deprecated legacy inline control using the standard URL', () => {
        const { controls } = frontMatterControlsToMap(
            [],
            [{ id: 'app-id', name: 'Application ID', metadata: { validation: { pattern: '^AP\\d+$' } } }],
            [],
            'standards/STD100002.md'
        );
        expect(controls['app-id']).toEqual({
            description: 'Application ID',
            requirements: [{ 'requirement-url': 'standards/STD100002.md', config: {} }],
            metadata: { validation: { pattern: '^AP\\d+$' } },
        });
    });

    it('eagerly seeds identity for a CURIE from any domain when slug matches locally', () => {
        const { controls, warnings } = frontMatterControlsToMap(
            ['privacy:controls:micro-segmentation@2.0.0'],
            [],
            localControls
        );
        expect(warnings).toEqual([]);
        expect(controls['privacy--micro-segmentation']).toEqual({
            description: 'Prevent lateral movement',
            requirements: [
                {
                    'requirement-url': 'privacy:controls:micro-segmentation@2.0.0',
                    config: {
                        'control-id': 'security-001',
                        name: 'Micro-segmentation',
                        description: 'Prevent lateral movement',
                    },
                },
            ],
        });
    });

    it('eagerly seeds identity for a canonical URL when slug matches locally', () => {
        const { controls, warnings } = frontMatterControlsToMap(
            ['https://hub.example.com/calm/domains/security/controls/micro-segmentation/requirement/versions/1.0.0'],
            [],
            localControls
        );
        expect(warnings).toEqual([]);
        expect(controls['security--micro-segmentation']).toEqual({
            description: 'Prevent lateral movement',
            requirements: [
                {
                    'requirement-url': 'https://hub.example.com/calm/domains/security/controls/micro-segmentation/requirement/versions/1.0.0',
                    config: {
                        'control-id': 'security-001',
                        name: 'Micro-segmentation',
                        description: 'Prevent lateral movement',
                    },
                },
            ],
        });
    });

    it('falls through to lazy resolution when CURIE slug has no local match', () => {
        const { controls } = frontMatterControlsToMap(
            ['security:controls:unknown-control@1.0.0'],
            [],
            localControls
        );
        expect(controls['security--unknown-control']).toEqual({
            description: 'unknown-control',
            requirements: [
                { 'requirement-url': 'security:controls:unknown-control@1.0.0', config: {} },
            ],
        });
    });

    it('warns on duplicate ref keys (last wins)', () => {
        const { warnings } = frontMatterControlsToMap(
            [
                'security:controls:micro-segmentation@1.0.0',
                'security:controls:micro-segmentation@2.0.0',
            ],
            [],
            []
        );
        expect(warnings.some((w) => w.includes('Duplicate control ref key'))).toBe(true);
    });

    it('returns an empty map for no refs and no legacy controls', () => {
        expect(frontMatterControlsToMap([], [], [])).toEqual({ controls: {}, warnings: [] });
    });
});

describe('WorkspaceAssetService.resolveStandardProse', () => {
    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/ws') },
        ];
        (vscode.workspace as any).getConfiguration = () => ({
            get: () => undefined,
        });
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () => {
                throw new Error('ENOENT');
            }),
        };
    });

    it('returns the markdown contents from a workspace root', async () => {
        (vscode.workspace as any).fs.readFile = vi.fn(
            async (uri: { fsPath: string }) => {
                if (uri.fsPath === '/ws/standards/tls-policy.md')
                    return encode('# TLS Policy');
                throw new Error('ENOENT');
            }
        );

        const svc = new WorkspaceAssetService('/ws');
        expect(await svc.resolveStandardProse('standards/tls-policy.md')).toBe(
            '# TLS Policy'
        );
    });

    it('falls through to the configured external assets path', async () => {
        (vscode.workspace as any).getConfiguration = () => ({
            get: () => '/ext',
        });
        (vscode.workspace as any).fs.readFile = vi.fn(
            async (uri: { fsPath: string }) => {
                if (uri.fsPath === '/ext/standards/x.md')
                    return encode('external prose');
                throw new Error('ENOENT');
            }
        );

        const svc = new WorkspaceAssetService('/ws');
        expect(await svc.resolveStandardProse('standards/x.md')).toBe(
            'external prose'
        );
    });

    it('returns null when no root contains the file', async () => {
        const svc = new WorkspaceAssetService('/ws');
        expect(
            await svc.resolveStandardProse('standards/missing.md')
        ).toBeNull();
    });
});

describe('WorkspaceAssetService.scanPatterns', () => {
    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/ws') },
        ];
    });

    it('discovers .pattern.json files from the configured external assets path', async () => {
        (vscode.workspace as any).getConfiguration = () => ({
            get: (key: string) =>
                key === 'externalAssetsPath' ? '/ext' : undefined,
        });
        // Only the external root contains a pattern file — the workspace root has none.
        (vscode.workspace as any).findFiles = vi.fn(
            async (glob: { base: { fsPath: string }; pattern: string }) => {
                if (
                    glob?.base?.fsPath === '/ext' &&
                    glob.pattern.startsWith('patterns/')
                ) {
                    return [
                        vscode.Uri.file(
                            '/ext/patterns/microservice.pattern.json'
                        ),
                    ];
                }
                return [];
            }
        );
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async (uri: { fsPath: string }) => {
                if (uri.fsPath === '/ext/patterns/microservice.pattern.json') {
                    return encode(
                        JSON.stringify({
                            title: 'Microservice',
                            description: 'A microservice pattern',
                            category: 'core',
                        })
                    );
                }
                throw new Error('ENOENT');
            }),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanPatterns();
        const patterns = svc.getPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0]).toMatchObject({
            id: 'microservice',
            name: 'Microservice',
            description: 'A microservice pattern',
            category: 'core',
        });
    });
});

describe('WorkspaceAssetService.scanControls', () => {
    const requirement = (id: string) =>
        JSON.stringify({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            properties: {
                'control-id': { const: `${id}-001` },
                name: { const: `${id} control` },
                description: { const: `${id} description` },
                'permit-ingress': { type: 'boolean' },
            },
            required: ['control-id', 'name', 'description'],
        });

    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/ws') },
        ];
        (vscode.workspace as any).getConfiguration = () => ({
            get: () => undefined,
        });
    });

    it('discovers and parses .requirement.json files', async () => {
        (vscode.workspace as any).findFiles = vi.fn(
            async (glob: { base: { fsPath: string }; pattern: string }) => {
                if (glob.pattern.startsWith('controls/')) {
                    return [
                        vscode.Uri.file('/ws/controls/micro-segmentation.requirement.json'),
                    ];
                }
                return [];
            }
        );
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async (uri: { fsPath: string }) => {
                if (uri.fsPath.endsWith('micro-segmentation.requirement.json')) {
                    return encode(requirement('micro'));
                }
                throw new Error('ENOENT');
            }),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        const controls = svc.getControls();
        expect(controls).toHaveLength(1);
        expect(controls[0]).toEqual({
            id: 'micro-segmentation',
            controlId: 'micro-001',
            name: 'micro control',
            description: 'micro description',
            filePath: '/ws/controls/micro-segmentation.requirement.json',
            relativePath: 'controls/micro-segmentation.requirement.json',
        });
    });

    it('skips malformed requirement files', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/controls/broken.requirement.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () => encode('{ not json')),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        expect(svc.getControls()).toHaveLength(0);
    });

    it('discovers a plain .json control file (stem has no .requirement)', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/controls/tls.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () => encode(requirement('tls'))),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        const controls = svc.getControls();
        expect(controls).toHaveLength(1);
        expect(controls[0].id).toBe('tls');
        expect(controls[0].relativePath).toBe('controls/tls.json');
    });

    it('skips a non-requirement .json under controls/', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/controls/index.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () =>
                encode(JSON.stringify({ some: 'unrelated config' }))
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        expect(svc.getControls()).toHaveLength(0);
    });

    it('accepts requirements missing identity constants using fallback identity from filename', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/controls/no-identity.requirement.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () =>
                encode(JSON.stringify({ properties: { foo: { type: 'string' } } }))
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        expect(svc.getControls()).toHaveLength(1);
        expect(svc.getControls()[0].id).toBe('no-identity');
        expect(svc.getControls()[0].controlId).toBe('no-identity');
    });

    it('uses schema title and description for fallback identity', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/controls/platform/resiliency-tier.requirement.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () =>
                encode(JSON.stringify({
                    title: 'Resiliency Tier',
                    description: 'Select the appropriate tier',
                    type: 'object',
                    properties: { value: { type: 'string', enum: ['Tier 1', 'Tier 2'] } },
                    required: ['value'],
                }))
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        expect(svc.getControls()).toHaveLength(1);
        const ctrl = svc.getControls()[0];
        expect(ctrl.id).toBe('resiliency-tier');
        expect(ctrl.name).toBe('Resiliency Tier');
        expect(ctrl.description).toBe('Select the appropriate tier');
        expect(ctrl.domain).toBe('platform');
    });

    it('deduplicates by relative path across roots (first root wins)', async () => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/ws') },
        ];
        (vscode.workspace as any).getConfiguration = () => ({
            get: (key: string) => (key === 'externalAssetsPath' ? '/ext' : undefined),
        });
        (vscode.workspace as any).findFiles = vi.fn(
            async (glob: { base: { fsPath: string } }) => {
                if (glob.base.fsPath === '/ws') {
                    return [vscode.Uri.file('/ws/controls/dup.requirement.json')];
                }
                if (glob.base.fsPath === '/ext') {
                    return [vscode.Uri.file('/ext/controls/dup.requirement.json')];
                }
                return [];
            }
        );
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async (uri: { fsPath: string }) =>
                encode(requirement(uri.fsPath.startsWith('/ws') ? 'ws' : 'ext'))
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanControls();
        const controls = svc.getControls();
        expect(controls).toHaveLength(1);
        expect(controls[0].controlId).toBe('ws-001');
        expect(controls[0].filePath).toBe('/ws/controls/dup.requirement.json');
    });
});
