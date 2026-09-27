import {describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import Terminal from './Terminal';
import type {Line} from '../shell';

function deferred() {
    let settle!: {resolve: (lines: Line[]) => void; reject: (reason: unknown) => void};
    const promise = new Promise<Line[]>((resolve, reject) => {
        settle = {resolve, reject};
    });
    return {promise, ...settle};
}

function renderTerminal(onRun: (input: string) => Promise<Line[] | undefined> | Line[] | undefined) {
    render(<Terminal cwd="/workspace" onRun={onRun} />);
    return screen.getByLabelText('Terminal input');
}

function type(input: HTMLElement, value: string) {
    fireEvent.change(input, {target: {value}});
    fireEvent.keyDown(input, {key: 'Enter'});
}

describe('Terminal', () => {
    it('shows a pending line while the command runs and replaces it on resolve', async () => {
        const pending = deferred();
        const input = renderTerminal(() => pending.promise);
        type(input, 'ls');

        expect(screen.getByText('…')).toBeInTheDocument();
        expect(input).toBeDisabled();

        await act(async () => {
            pending.resolve([{text: 'a.json', kind: 'out'}]);
        });

        expect(screen.queryByText('…')).not.toBeInTheDocument();
        expect(screen.getByText('a.json')).toBeInTheDocument();
    });

    it('ignores Enter while a command is still running', async () => {
        const pending = deferred();
        const onRun = vi.fn(() => pending.promise);
        const input = renderTerminal(onRun);
        type(input, 'ls');
        fireEvent.keyDown(input, {key: 'Enter'});

        expect(onRun).toHaveBeenCalledTimes(1);

        await act(async () => {
            pending.resolve([]);
        });
    });

    it('clears the scrollback when a pending clear resolves', async () => {
        const pending = deferred();
        const input = renderTerminal(() => pending.promise);
        type(input, 'clear');
        expect(screen.getByText(/type `help` to get started/)).toBeInTheDocument();

        await act(async () => {
            pending.resolve([{text: '', kind: 'clear'}]);
        });

        expect(screen.queryByText(/type `help` to get started/)).not.toBeInTheDocument();
        expect(screen.queryByText('…')).not.toBeInTheDocument();
    });

    it('replaces the pending line with an error when the command rejects', async () => {
        const pending = deferred();
        const input = renderTerminal(() => pending.promise);
        type(input, 'calm validate a.json');

        await act(async () => {
            pending.reject(new Error('engine unavailable'));
        });

        expect(screen.queryByText('…')).not.toBeInTheDocument();
        expect(screen.getByText('error: engine unavailable')).toBeInTheDocument();
        expect(input).not.toBeDisabled();
    });

    it('leaves focus alone if it moved outside the terminal while the command ran', async () => {
        const pending = deferred();
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        const input = renderTerminal(() => pending.promise);
        type(input, 'ls');
        outside.focus();

        await act(async () => {
            pending.resolve([]);
        });

        expect(document.activeElement).toBe(outside);
        outside.remove();
    });

    it('restores focus to the input once the command completes', async () => {
        const pending = deferred();
        const input = renderTerminal(() => pending.promise);
        type(input, 'ls');
        expect(document.activeElement).not.toBe(input);

        await act(async () => {
            pending.resolve([]);
        });

        expect(document.activeElement).toBe(input);
    });

    it('runs each pasted line in order, like a shell', async () => {
        const onRun = vi.fn<(command: string) => Promise<Line[]>>(async () => []);
        const input = renderTerminal(onRun);
        await act(async () => {
            fireEvent.paste(input, {clipboardData: {getData: () => 'ls\ncat a.json\ncalm validate -a a.json\n'}});
        });

        expect(onRun.mock.calls.map(([command]) => command)).toEqual(['ls', 'cat a.json', 'calm validate -a a.json']);
        expect(input).toHaveValue('');
    });

    it('leaves the text after the last newline in the prompt', async () => {
        const onRun = vi.fn<(command: string) => Promise<Line[]>>(async () => []);
        const input = renderTerminal(onRun);
        await act(async () => {
            fireEvent.paste(input, {clipboardData: {getData: () => 'ls\ncat a.json'}});
        });

        expect(onRun.mock.calls.map(([command]) => command)).toEqual(['ls']);
        expect(input).toHaveValue('cat a.json');
    });

    it('waits for each pasted command before running the next', async () => {
        const first = deferred();
        const onRun = vi.fn((command: string) => (command === 'ls' ? first.promise : []));
        const input = renderTerminal(onRun);
        await act(async () => {
            fireEvent.paste(input, {clipboardData: {getData: () => 'ls\npwd\n'}});
        });
        expect(onRun).toHaveBeenCalledTimes(1);

        await act(async () => {
            first.resolve([]);
        });
        expect(onRun.mock.calls.map(([command]) => command)).toEqual(['ls', 'pwd']);
    });

    it('stops a pasted batch when the terminal unmounts (Reset lesson)', async () => {
        const first = deferred();
        const onRun = vi.fn((command: string) => (command === 'ls' ? first.promise : []));
        const {unmount} = render(<Terminal cwd="/workspace" onRun={onRun} />);
        const input = screen.getByLabelText('Terminal input');
        await act(async () => {
            fireEvent.paste(input, {clipboardData: {getData: () => 'ls\npwd\n'}});
        });
        unmount();
        await act(async () => {
            first.resolve([]);
        });

        expect(onRun.mock.calls.map(([command]) => command)).toEqual(['ls']);
    });

    it('pastes a single line into the prompt without running it', () => {
        const onRun = vi.fn();
        const input = renderTerminal(onRun);
        fireEvent.paste(input, {clipboardData: {getData: () => 'ls'}});

        expect(onRun).not.toHaveBeenCalled();
    });
});
