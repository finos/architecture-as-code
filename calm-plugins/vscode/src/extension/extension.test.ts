import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate, disconnectFromHub } from './extension';

vi.mock('./services/hub-auth-service', () => ({
    HubAuthService: class {
        async initialize(): Promise<void> {}
        async discoverAndAuthenticate(): Promise<boolean> {
            return false;
        }
    },
}));

type CommandCallback = (...args: unknown[]) => unknown;

const commands = new Map<string, CommandCallback>();
const configUpdates: Array<{ key: string; value: unknown }> = [];
let hubUrl: string | undefined;
let statusBarItem: vscode.StatusBarItem;
let inputValue: string | undefined;

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
    commands.clear();
    configUpdates.length = 0;
    hubUrl = 'https://calmhub.example.com';
    inputValue = undefined;

    (vscode.commands as unknown as { registerCommand: unknown }).registerCommand = (
        command: string,
        callback: CommandCallback
    ) => {
        commands.set(command, callback);
        return { dispose: () => {} };
    };

    (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = (
        section?: string
    ) => ({
        get: <T>(key: string, defaultValue?: T): T | undefined => {
            if (section === 'calm.hub' && key === 'url') return hubUrl as T | undefined;
            if (section === 'calm.hub' && key === 'autoConnect') return false as T;
            return defaultValue;
        },
        update: async (key: string, value: unknown) => {
            configUpdates.push({ key, value });
            if (section === 'calm.hub' && key === 'url') {
                hubUrl = value as string | undefined;
            }
        },
    });

    const window = vscode.window as unknown as {
        createStatusBarItem: () => vscode.StatusBarItem;
        showQuickPick: (items: Array<{ label: string }>) => Promise<unknown>;
        showInputBox: (options: { value?: string }) => Promise<string | undefined>;
    };
    window.createStatusBarItem = () => {
        statusBarItem = {
            text: '',
            tooltip: undefined,
            command: undefined,
            backgroundColor: undefined,
            show: () => {},
            hide: () => {},
            dispose: () => {},
        };
        return statusBarItem;
    };
    window.showQuickPick = async (items) => items.find((item) => item.label.includes('Clear URL'));
    window.showInputBox = async (options) => {
        inputValue = options.value;
        return undefined;
    };

    activate(context());
});

describe('CALM Hub Clear URL', () => {
    it('forgets the status bar URL and opens an empty reconnect prompt', async () => {
        const connect = commands.get('calm.connectToHub');
        expect(connect).toBeDefined();

        await connect!();
        expect(statusBarItem.tooltip).toContain('Failed to connect to https://calmhub.example.com');

        await connect!();

        expect(hubUrl).toBeUndefined();
        expect(configUpdates).toEqual([{ key: 'url', value: undefined }]);
        expect(statusBarItem.tooltip).toBe('Click to connect to CalmHub');

        await connect!();

        expect(inputValue).toBe('');
    });

    it('keeps the saved URL when Disconnect runs', async () => {
        const connect = commands.get('calm.connectToHub');
        expect(connect).toBeDefined();

        await connect!();
        await disconnectFromHub();

        expect(hubUrl).toBe('https://calmhub.example.com');
        expect(configUpdates).toEqual([]);
        expect(statusBarItem.tooltip).toBe(
            'Disconnected from https://calmhub.example.com\nClick to reconnect'
        );
    });
});
