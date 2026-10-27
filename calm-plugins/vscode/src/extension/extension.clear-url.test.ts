import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { activate, disconnectFromHub } from './extension';

/**
 * Regression test for #3523: after "Clear URL" the saved `calm.hub.url` is
 * gone, so the status bar must forget it too. Before the fix the tooltip kept
 * saying "Disconnected from <old URL> / Click to reconnect" while the click
 * opened an empty URL box.
 */

interface ConfigUpdate {
    section: string;
    key: string;
    value: unknown;
}

type CommandCallback = (...args: unknown[]) => unknown;

const HUB_URL = 'https://calmhub.example.com';

const registeredCommands = new Map<string, CommandCallback>();
const configUpdates: ConfigUpdate[] = [];
let statusBarItem: vscode.StatusBarItem;

function context(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/tmp/extension'),
        secrets: {
            // Reading the stored token fails, so connecting ends in the error
            // state without any network access.
            get: async () => {
                throw new Error('secret storage unavailable');
            },
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

    (vscode.window as unknown as { createStatusBarItem: unknown }).createStatusBarItem = () => {
        statusBarItem = {
            text: '',
            tooltip: undefined,
            command: undefined,
            backgroundColor: undefined,
            show: () => {},
            hide: () => {},
            dispose: () => {},
        } as unknown as vscode.StatusBarItem;
        return statusBarItem;
    };

    (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = (
        section?: string
    ) => ({
        get: <T>(key: string, defaultValue?: T): T | undefined => {
            if (key === 'url') return HUB_URL as unknown as T;
            if (key === 'autoConnect') return false as unknown as T;
            return defaultValue;
        },
        update: async (key: string, value: unknown) => {
            configUpdates.push({ section: section ?? '', key, value });
        },
    });

    activate(context());
});

async function failToConnect(): Promise<void> {
    const connect = registeredCommands.get('calm.connectToHub');
    expect(connect).toBeDefined();
    await connect!();
    expect(statusBarItem.text).toBe('$(cloud) CALM Hub (error)');
    expect(statusBarItem.tooltip).toBe(`Failed to connect to ${HUB_URL}\nClick to retry`);
}

describe('clearing the Hub URL after a failed connection', () => {
    it('makes the status bar forget the URL along with the setting', async () => {
        await failToConnect();

        await disconnectFromHub({ clearUrl: true });

        expect(configUpdates).toEqual([{ section: 'calm.hub', key: 'url', value: undefined }]);
        expect(statusBarItem.text).toBe('$(cloud) CALM Hub');
        expect(statusBarItem.tooltip).toBe('Click to connect to CalmHub');
    });

    it('keeps the URL on a plain disconnect so "Click to reconnect" still works', async () => {
        await failToConnect();

        const disconnect = registeredCommands.get('calm.disconnectFromHub');
        expect(disconnect).toBeDefined();
        await disconnect!();

        expect(configUpdates).toEqual([]);
        expect(statusBarItem.tooltip).toBe(`Disconnected from ${HUB_URL}\nClick to reconnect`);
    });
});
