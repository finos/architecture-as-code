import * as vscode from 'vscode';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class HubStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private _state: ConnectionState = 'disconnected';
    private namespaceCount = 0;
    private updatesCount = 0;
    private hubUrl: string | undefined;
    private namespaceNames: string[] = [];
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

    setNamespaceNames(names: string[]): void {
        this.namespaceNames = names;
        this.update();
    }

    setAvailableAndSelected(available: string[], selected: string[]): void {
        this.availableNamespaces = available;
        this.selectedNamespaces = selected;
        this.namespaceCount = available.length;
        this.update();
    }

    setUpdatesAvailable(count: number): void {
        this.updatesCount = count;
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
                const countLabel = `${selCount}/${availCount}`;
                this.statusBarItem.text = this.updatesCount > 0
                    ? `$(cloud) CALM Hub (${countLabel}) · ${this.updatesCount} updates`
                    : `$(cloud) CALM Hub (${countLabel})`;

                const nsList = this.availableNamespaces.map((ns) =>
                    this.selectedNamespaces.includes(ns) ? `  ✓ ${ns}` : `  ○ ${ns}`
                ).join('\n');
                this.statusBarItem.tooltip = (this.hubUrl ? `${this.hubUrl}\n\n` : '') +
                    `Namespaces (${selCount} selected / ${availCount} available):\n` +
                    nsList +
                    (this.updatesCount > 0 ? `\n\n${this.updatesCount} update(s) available` : '') +
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
