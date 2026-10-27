import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { HubStatusBar } from './hub-status-bar';

describe('HubStatusBar', () => {
    let statusBar: HubStatusBar;
    let mockItem: vscode.StatusBarItem;

    beforeEach(() => {
        // Capture the created status bar item
        const createSpy = vi.fn(() => {
            mockItem = {
                text: '',
                tooltip: undefined,
                command: undefined,
                backgroundColor: undefined,
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn(),
            } as unknown as vscode.StatusBarItem;
            return mockItem;
        });
        (vscode.window as any).createStatusBarItem = createSpy;

        statusBar = new HubStatusBar();
    });

    it('creates a status bar item aligned to the left', () => {
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
            vscode.StatusBarAlignment.Left,
            0
        );
    });

    it('shows the status bar item on creation', () => {
        expect(mockItem.show).toHaveBeenCalled();
    });

    it('sets the command to calm.connectToHub', () => {
        expect(mockItem.command).toBe('calm.connectToHub');
    });

    it('starts in disconnected state', () => {
        expect(statusBar.state).toBe('disconnected');
        expect(mockItem.text).toBe('$(cloud) CALM Hub');
        expect(mockItem.tooltip).toBe('Click to connect to CalmHub');
    });

    describe('setState', () => {
        it('updates to connecting state', () => {
            statusBar.setState('connecting');
            expect(statusBar.state).toBe('connecting');
            expect(mockItem.text).toBe('$(sync~spin) CALM Hub');
            expect(mockItem.tooltip).toBe('Connecting...');
            expect(mockItem.backgroundColor).toBeUndefined();
        });

        it('updates to connected state with namespace count', () => {
            statusBar.setState('connected', 5);
            expect(statusBar.state).toBe('connected');
            expect(mockItem.text).toBe('$(cloud) CALM Hub (5)');
            expect(mockItem.backgroundColor).toBeUndefined();
        });

        it('updates to error state with error background', () => {
            statusBar.setState('error');
            expect(statusBar.state).toBe('error');
            expect(mockItem.text).toBe('$(cloud) CALM Hub (error)');
            expect(mockItem.backgroundColor).toBeInstanceOf(
                vscode.ThemeColor
            );
        });

        it('preserves namespace count when not provided', () => {
            statusBar.setState('connected', 3);
            expect(mockItem.text).toBe('$(cloud) CALM Hub (3)');

            statusBar.setState('error');
            statusBar.setState('connected');
            expect(mockItem.text).toBe('$(cloud) CALM Hub (3)');
        });

        it('updates namespace count when provided', () => {
            statusBar.setState('connected', 2);
            expect(mockItem.text).toBe('$(cloud) CALM Hub (2)');

            statusBar.setState('connected', 7);
            expect(mockItem.text).toBe('$(cloud) CALM Hub (7)');
        });

        it('shows selected vs available with setAvailableAndSelected', () => {
            statusBar.setState('connected', 3);
            statusBar.setAvailableAndSelected(['ns1', 'ns2', 'ns3'], ['ns1', 'ns3']);
            expect(mockItem.text).toBe('$(cloud) CALM Hub (2/3)');
            expect(mockItem.tooltip).toContain('✓ ns1');
            expect(mockItem.tooltip).toContain('○ ns2');
            expect(mockItem.tooltip).toContain('✓ ns3');
        });

        it('marks every namespace as selected when the selection is empty', () => {
            statusBar.setState('connected', 2);
            statusBar.setAvailableAndSelected(['alpha', 'beta'], []);
            expect(mockItem.text).toBe('$(cloud) CALM Hub (2)');
            expect(mockItem.tooltip).toContain('Namespaces (2 selected / 2 available)');
            expect(mockItem.tooltip).toContain('✓ alpha');
            expect(mockItem.tooltip).toContain('✓ beta');
        });
    });

    describe('clearHubUrl', () => {
        it('keeps the URL on a plain disconnect so the tooltip offers to reconnect', () => {
            statusBar.setState('error', undefined, 'https://calmhub.example.com');
            expect(mockItem.tooltip).toBe(
                'Failed to connect to https://calmhub.example.com\nClick to retry'
            );

            statusBar.setState('disconnected');
            expect(mockItem.tooltip).toBe(
                'Disconnected from https://calmhub.example.com\nClick to reconnect'
            );
        });

        it('forgets the URL so the tooltip offers to connect', () => {
            statusBar.setState('error', undefined, 'https://calmhub.example.com');
            statusBar.setState('disconnected');

            statusBar.clearHubUrl();

            expect(statusBar.state).toBe('disconnected');
            expect(mockItem.text).toBe('$(cloud) CALM Hub');
            expect(mockItem.tooltip).toBe('Click to connect to CalmHub');
        });

        it('does not bring the URL back on the next state change', () => {
            statusBar.setState('error', undefined, 'https://calmhub.example.com');
            statusBar.clearHubUrl();

            statusBar.setState('connecting');
            expect(mockItem.tooltip).toBe('Connecting...');
        });
    });

    describe('dispose', () => {
        it('disposes the underlying status bar item', () => {
            statusBar.dispose();
            expect(mockItem.dispose).toHaveBeenCalled();
        });
    });
});
