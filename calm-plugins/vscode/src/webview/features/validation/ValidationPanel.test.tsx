// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationPanel } from './ValidationPanel';

describe('ValidationPanel', () => {
    let container: HTMLDivElement;
    let root: Root;

    afterEach(async () => {
        if (root) await act(async () => root.unmount());
        container?.remove();
    });

    it('exposes issue rows as keyboard-focusable buttons and dispatches activation', async () => {
        const issue = { severity: 'error' as const, message: 'Missing node', nodeId: 'service-1' };
        const onIssueClick = vi.fn();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        await act(async () => root.render(
            <ValidationPanel issues={[issue]} onClose={vi.fn()} onIssueClick={onIssueClick} />,
        ));

        const row = container.querySelector<HTMLButtonElement>('button[ type="button" ]')
            ?? container.querySelector<HTMLButtonElement>('button[type="button"]');
        expect(row).not.toBeNull();
        expect(row?.tabIndex).toBe(0);
        expect(row?.textContent).toContain('Missing node');
        await act(async () => row?.click());
        expect(onIssueClick).toHaveBeenCalledWith(issue);
    });
});