import {describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import Terminal from './Terminal';

function deferred() {
    let settle;
    const promise = new Promise((resolve, reject) => {
        settle = {resolve, reject};
    });
    return {promise, ...settle};
}

function renderTerminal(onRun) {
    render(<Terminal cwd="/workspace" onRun={onRun} />);
    return screen.getByLabelText('Terminal input');
}

function type(input, value) {
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
});
