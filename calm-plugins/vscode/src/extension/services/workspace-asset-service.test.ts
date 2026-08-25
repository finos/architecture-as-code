import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    WorkspaceAssetService,
    frontMatterControlsToMap,
} from './workspace-asset-service';

const encode = (s: string) => new TextEncoder().encode(s);

describe('frontMatterControlsToMap', () => {
    it('converts a front-matter controls array into the CALM control map', () => {
        const map = frontMatterControlsToMap(
            [
                {
                    id: 'app-id',
                    name: 'Application ID',
                    metadata: {
                        validation: {
                            pattern: '^AP\\d+$',
                            example: 'AP187183',
                        },
                    },
                },
            ],
            'standards/application-software-delivery/STD100002.md'
        );
        expect(Object.keys(map)).toEqual(['app-id']);
        expect(map['app-id']).toEqual({
            description: 'Application ID',
            requirements: [
                {
                    'requirement-url':
                        'standards/application-software-delivery/STD100002.md',
                    config: {},
                },
            ],
            metadata: {
                validation: { pattern: '^AP\\d+$', example: 'AP187183' },
            },
        });
    });

    it('falls back to the control name as id and omits metadata when absent', () => {
        const map = frontMatterControlsToMap(
            [{ name: 'Encryption' }],
            'standards/x.md'
        );
        expect(map['Encryption']).toEqual({
            description: 'Encryption',
            requirements: [{ 'requirement-url': 'standards/x.md', config: {} }],
        });
    });

    it('returns an empty map for non-array / missing controls', () => {
        expect(frontMatterControlsToMap(undefined, 'x')).toEqual({});
        expect(frontMatterControlsToMap({}, 'x')).toEqual({});
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
