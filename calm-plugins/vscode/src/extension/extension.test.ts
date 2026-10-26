import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { activate, disconnectFromHub, hubMenuItems } from './extension';

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
        get: <T>(key: string, defaultValue?: T): T | undefined =>
            key === 'url'
                ? ('https://calmhub.example.com' as unknown as T)
                : defaultValue,
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
