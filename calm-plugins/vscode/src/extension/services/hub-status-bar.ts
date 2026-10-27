import * as vscode from 'vscode';
import { resolveSelectedNamespaces } from './namespace-selection';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class HubStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private _state: ConnectionState = 'disconnected';
    private namespaceCount = 0;
    private hubUrl: string | undefined;
    private availableNamespaces: string[] = [];
    private selectedNamespaces: string[] = [];

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            0
        );
        this.statusBarItem.command = 'calm.connectToHub';
        this.update();
        this.statusBarItem.show();
    }

    get state(): ConnectionState {
        return this._state;
    }

    setState(state: ConnectionState, namespaceCount?: number, hubUrl?: string): void {
        this._state = state;
        if (namespaceCount !== undefined) {
            this.namespaceCount = namespaceCount;
        }
        if (hubUrl !== undefined) {
            this.hubUrl = hubUrl;
        }
        this.update();
    }

    setAvailableAndSelected(available: string[], selected: string[]): void {
        this.availableNamespaces = available;
        this.selectedNamespaces = selected;
        this.namespaceCount = available.length;
        this.update();
    }

    private update(): void {
        switch (this._state) {
            case 'disconnected':
                this.statusBarItem.text = '$(cloud) CALM Hub';
                this.statusBarItem.tooltip = this.hubUrl
                    ? `Disconnected from ${this.hubUrl}\nClick to reconnect`
                    : 'Click to connect to CalmHub';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'connecting':
                this.statusBarItem.text = '$(sync~spin) CALM Hub';
                this.statusBarItem.tooltip = this.hubUrl
                    ? `Connecting to ${this.hubUrl}...`
                    : 'Connecting...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'connected': {
                const selCount = this.selectedNamespaces.length;
                const availCount = this.availableNamespaces.length || this.namespaceCount;
                const countLabel = selCount > 0 ? `${selCount}/${availCount}` : `${availCount}`;
                this.statusBarItem.text = `$(cloud) CALM Hub (${countLabel})`;

                // An empty selection means "all namespaces", so the tooltip resolves it (#3493).
                const selected = resolveSelectedNamespaces(this.availableNamespaces, this.selectedNamespaces);
                const nsList = this.availableNamespaces.map((ns) =>
                    selected.includes(ns) ? `  ✓ ${ns}` : `  ○ ${ns}`
                ).join('\n');
                this.statusBarItem.tooltip = (this.hubUrl ? `${this.hubUrl}\n\n` : '') +
                    `Namespaces (${selected.length} selected / ${availCount} available):\n` +
                    nsList +
                    '\n\nClick to manage';
                this.statusBarItem.backgroundColor = undefined;
                break;
            }
            case 'error':
                this.statusBarItem.text = '$(cloud) CALM Hub (error)';
                this.statusBarItem.tooltip = this.hubUrl
                    ? `Failed to connect to ${this.hubUrl}\nClick to retry`
                    : 'Connection error — click to retry';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
