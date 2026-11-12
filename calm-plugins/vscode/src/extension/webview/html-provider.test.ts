import { describe, expect, it, vi } from 'vitest';

const featureConfiguration = vi.hoisted(() => ({ inspect: vi.fn((): Record<string, unknown> => ({})) }));

vi.mock('vscode', () => ({
    Uri: {
        joinPath: (...parts: Array<{ fsPath: string } | string>) => {
            const fsPath = parts
                .map((part) => (typeof part === 'string' ? part : part.fsPath))
                .join('/')
                .replace(/\/+/g, '/');
            return { fsPath };
        },
    },
    workspace: {
        getConfiguration: () => ({
            get: (_key: string, defaultValue?: unknown) => defaultValue ?? [],
            inspect: featureConfiguration.inspect,
        }),
    },
}));

import { getWebviewHtml } from './html-provider';

describe('getWebviewHtml', () => {
    function renderWithConfiguration(configuration: Record<string, unknown>) {
        featureConfiguration.inspect.mockReturnValue(configuration);
        return getWebviewHtml(
            { asWebviewUri: () => 'webview://bundle', cspSource: 'vscode-resource:' } as any,
            { extensionUri: { fsPath: '/ext' } } as any,
            { getText: () => '{"nodes":[]}' } as any,
        );
    }

    it('ignores the implicit empty-array default so bundled features load', () => {
        expect(renderWithConfiguration({ defaultValue: [] }))
            .toContain('window.__CALM_ENABLED_FEATURES__ = undefined;');
    });

    it('preserves an explicitly empty feature list', () => {
        expect(renderWithConfiguration({ globalValue: [] }))
            .toContain('window.__CALM_ENABLED_FEATURES__ = [];');
    });

    it('prefers folder configuration over workspace and user configuration', () => {
        expect(renderWithConfiguration({
            globalValue: ['user-feature'],
            workspaceValue: ['workspace-feature'],
            workspaceFolderValue: ['folder-feature'],
        })).toContain('window.__CALM_ENABLED_FEATURES__ = ["folder-feature"];');
    });

    it('targets the built webview bundle under dist/webview', () => {
        featureConfiguration.inspect.mockReturnValue({});
        const html = getWebviewHtml(
            {
                asWebviewUri: (uri: { fsPath: string }) => `webview://${uri.fsPath}`,
                cspSource: 'vscode-resource:',
            } as any,
            {
                extensionUri: { fsPath: '/ext' },
            } as any,
            {
                getText: () => '{"nodes":[]}',
            } as any,
        );

        expect(html).toContain('webview:///ext/dist/webview/index.js');
        expect(html).toContain('webview:///ext/dist/webview/index.css');
        expect(html).toContain('window.__INITIAL_CALM_JSON__ =');
        expect(html).toContain('window.__CALM_ENABLED_FEATURES__ = undefined;');
    });
});