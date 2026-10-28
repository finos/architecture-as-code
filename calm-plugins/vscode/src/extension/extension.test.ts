import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    activate,
    CALM_FILE_SUFFIXES,
    disconnectFromHub,
    hubMenuItems,
    isCalmFile,
} from './extension';

interface ConfigUpdate {
    section: string;
    key: string;
    value: unknown;
}

type CommandCallback = (...args: unknown[]) => unknown;

const registeredCommands = new Map<string, CommandCallback>();
const configUpdates: ConfigUpdate[] = [];

function context(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/tmp/extension'),
        secrets: {
            get: async () => undefined,
            store: async () => {},
            delete: async () => {},
            onDidChange: () => ({ dispose: () => {} }),
        },
    } as unknown as vscode.ExtensionContext;
}

beforeEach(() => {
    registeredCommands.clear();
    configUpdates.length = 0;

    (vscode.commands as unknown as { registerCommand: unknown }).registerCommand = (
        command: string,
        callback: CommandCallback
    ) => {
        registeredCommands.set(command, callback);
        return { dispose: () => {} };
    };

    (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = (
        section?: string
    ) => ({
        get: <T>(key: string, defaultValue?: T): T | undefined => {
            if (key === 'url') return 'https://calmhub.example.com' as unknown as T;
            // Keep activate() from starting a real connectToHub in every test.
            if (key === 'autoConnect') return false as unknown as T;
            return defaultValue;
        },
        update: async (key: string, value: unknown) => {
            configUpdates.push({ section: section ?? '', key, value });
        },
    });

    activate(context());
});

describe('disconnecting from CALM Hub', () => {
    it('keeps the saved URL so the status bar can reconnect', async () => {
        await disconnectFromHub();

        expect(configUpdates).toEqual([]);
    });

    it('keeps the saved URL when the disconnect command runs', async () => {
        const disconnect = registeredCommands.get('calm.disconnectFromHub');
        expect(disconnect).toBeDefined();

        await disconnect!();

        expect(configUpdates).toEqual([]);
    });

    it('forgets the saved URL only for Clear URL', async () => {
        await disconnectFromHub({ clearUrl: true });

        expect(configUpdates).toEqual([
            { section: 'calm.hub', key: 'url', value: undefined },
        ]);
    });
});

describe('CALM Hub menu', () => {
    it('offers Disconnect, and no Clear URL, while connected', () => {
        expect(hubMenuItems('connected').map((item) => item.action)).toEqual([
            'namespaces',
            'refresh',
            'change',
            'disconnect',
        ]);
    });

    it('offers Clear URL, and no Disconnect, after a failed connection', () => {
        expect(hubMenuItems('error').map((item) => item.action)).toEqual([
            'change',
            'retry',
            'clearUrl',
        ]);
    });
});

describe('the Clear URL menu item', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not connect while autoConnect is off', async () => {
        const fetchStub = vi.fn();
        vi.stubGlobal('fetch', fetchStub);

        // The stub in beforeEach reports autoConnect: false, so activating the
        // extension must not send a request of its own.
        activate(context());
        // activate() starts auto-connect without awaiting it, so give that path
        // the chance to reach the network before asserting it never did.
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(fetchStub).not.toHaveBeenCalled();
    });

    it('forgets the saved URL when the status bar is in its error state', async () => {
        // A failed connection leaves the status bar in its error state, which is
        // the only state that offers "Clear URL".
        const fetchStub = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('fetch', fetchStub);

        const connect = registeredCommands.get('calm.connectToHub');
        expect(connect).toBeDefined();

        await connect!();
        expect(fetchStub).toHaveBeenCalled();

        const placeholders: string[] = [];
        (vscode.window as unknown as { showQuickPick: unknown }).showQuickPick = async (
            items: vscode.QuickPickItem[] & { action?: string }[],
            options?: vscode.QuickPickOptions
        ) => {
            placeholders.push(options?.placeHolder ?? '');
            return (items as unknown as { action: string }[]).find(
                (item) => item.action === 'clearUrl'
            );
        };

        await connect!();

        expect(placeholders[0]).toContain('Failed to connect');
        expect(configUpdates).toEqual([
            { section: 'calm.hub', key: 'url', value: undefined },
        ]);
    });
});

describe('CALM_FILE_SUFFIXES and isCalmFile', () => {
    it('supports only .calm.json and .architecture.json suffixes', () => {
        expect(CALM_FILE_SUFFIXES).toEqual(['.calm.json', '.architecture.json']);
        expect(isCalmFile('/workspace/my-service.calm.json')).toBe(true);
        expect(isCalmFile('/workspace/my-system.architecture.json')).toBe(true);
    });

    it('rejects legacy suffixes (.template.json, .solution.json, .standard.json, .guideline.json)', () => {
        expect(isCalmFile('/workspace/legacy.template.json')).toBe(false);
        expect(isCalmFile('/workspace/legacy.solution.json')).toBe(false);
        expect(isCalmFile('/workspace/legacy.standard.json')).toBe(false);
        expect(isCalmFile('/workspace/legacy.guideline.json')).toBe(false);
        expect(isCalmFile('/workspace/pattern.pattern.json')).toBe(false);
    });
});
