import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    WorkspaceAssetService,
} from './workspace-asset-service';

const encode = (s: string) => new TextEncoder().encode(s);

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

describe('WorkspaceAssetService.scanStandardNodes', () => {
    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/ws') },
        ];
        (vscode.workspace as any).getConfiguration = () => ({
            get: () => undefined,
        });
    });

    it('discovers JSON Schema node Standards under standards/ and reads default node template', async () => {
        (vscode.workspace as any).findFiles = vi.fn(
            async (glob: { base: { fsPath: string }; pattern: string }) => {
                if (glob.pattern === 'standards/**/*.json') {
                    return [
                        vscode.Uri.file('/ws/standards/networking/api-gateway.json'),
                    ];
                }
                return [];
            }
        );
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () =>
                encode(
                    JSON.stringify({
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        title: 'API Gateway',
                        description: 'Edge gateway standard',
                        allOf: [
                            { $ref: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node' },
                        ],
                        default: {
                            'unique-id': 'standard-node-api-gateway',
                            'node-type': 'service',
                            name: 'API Gateway',
                            description: 'Edge gateway standard',
                            controls: {
                                tls: { requirements: [{ 'requirement-url': 'controls/tls.json' }] },
                            },
                        },
                    })
                )
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanStandardNodes();
        const nodes = svc.getStandardNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
            id: 'api-gateway',
            name: 'API Gateway',
            description: 'Edge gateway standard',
            nodeType: 'service',
            category: 'Networking',
            controls: {
                tls: { requirements: [{ 'requirement-url': 'controls/tls.json' }] },
            },
        });
        expect(nodes[0].defaultNode).toMatchObject({
            'unique-id': 'standard-node-api-gateway',
            'node-type': 'service',
            name: 'API Gateway',
        });
    });

    it('skips non-node JSON schemas under standards/', async () => {
        (vscode.workspace as any).findFiles = vi.fn(async () => [
            vscode.Uri.file('/ws/standards/arch-standard.json'),
        ]);
        (vscode.workspace as any).fs = {
            readFile: vi.fn(async () =>
                encode(
                    JSON.stringify({
                        $schema: 'https://json-schema.org/draft/2020-12/schema',
                        title: 'Architecture Standard',
                        allOf: [
                            { $ref: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/architecture' },
                        ],
                    })
                )
            ),
        };

        const svc = new WorkspaceAssetService('/ws');
        await (svc as any).scanStandardNodes();
        expect(svc.getStandardNodes()).toHaveLength(0);
    });
});

describe('WorkspaceAssetService.stem', () => {
    const svc = new WorkspaceAssetService('/ws');
    const stem = (filePath: string): string =>
        (svc as any).stem(vscode.Uri.file(filePath));

    it('strips .json and .standard.json suffixes', () => {
        expect(stem('/ws/standards/payment-service.json')).toBe('payment-service');
        expect(stem('/ws/standards/checkout.standard.json')).toBe('checkout');
    });

    it('does not strip non-json suffixes', () => {
        expect(stem('/ws/standards/readme.md')).toBe('readme.md');
    });
});
