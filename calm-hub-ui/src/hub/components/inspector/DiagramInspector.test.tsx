import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CalmNodeSchema } from '@finos/calm-models/types';
import type { Data } from '../../../model/calm.js';
import type { ExtensionContext, ExtensionSummary } from '../../../model/extensions.js';
import { ExtensionsContext } from '../../../extensions/ExtensionsContext.js';
import { ExtensionService } from '../../../service/extension-service.js';
import { fakeExtension, fakeExtensions } from '../../../test-support/fake-extensions.js';
import { DiagramInspector, MobileInspector } from './DiagramInspector.js';
import type { InspectorTab } from './inspectorIds.js';

const data = {
    id: 'trading',
    version: '1.0.0',
    calmType: 'Architectures',
    name: 'finos',
    data: { nodes: [{ 'unique-id': 'api' }], relationships: [] },
} as unknown as Data;
const resource: ExtensionContext = {
    namespace: 'finos',
    resource: 'architectures/trading',
    resourceType: 'architectures',
    resourceId: 'trading',
    version: '1.0.0',
};
const api = { 'unique-id': 'api', name: 'API', 'node-type': 'service' } as CalmNodeSchema;

// One extension with each contribution that the inspector shows.
const scanner: ExtensionSummary = {
    id: 'scanner',
    name: 'Scanner',
    hubApi: 0,
    routes: [
        { id: 'run', method: 'POST', path: '/run', scope: 'authenticated', readOnly: false },
        { id: 'scan', method: 'POST', path: '/scan/{selectedElement}', scope: 'authenticated', readOnly: false },
        { id: 'summary', method: 'GET', path: '/summary', scope: 'authenticated', readOnly: true },
        { id: 'findings', method: 'GET', path: '/findings/{selectedElement}', scope: 'authenticated', readOnly: true },
        { id: 'broken', method: 'GET', path: '/broken', scope: 'authenticated', readOnly: true },
    ],
    contributes: {
        action: [
            { id: 'run', title: 'Run all', route: 'run' },
            { id: 'scan', title: 'Scan node', route: 'scan' },
        ],
        'designer-tab': [
            { id: 'summary', title: 'Summary', route: 'summary' },
            { id: 'broken', title: 'Broken', route: 'broken' },
        ],
        'detail-panel': [{ id: 'findings', title: 'Findings', route: 'findings' }],
    },
};

// A stat tile that filters a table, as #3801 adds. Its filter state lives in the slot, not in the blocks.
const reviews: ExtensionSummary = {
    id: 'reviews',
    name: 'Reviews',
    hubApi: 0,
    routes: [{ id: 'data', method: 'GET', path: '/data', scope: 'authenticated', readOnly: true }],
    contributes: { 'designer-tab': [{ id: 'table', title: 'Open reviews', route: 'data' }] },
};
const reviewBlocks = [
    { type: 'stats', items: [{ label: 'Needs review', value: 1, filter: { table: 'reviews', id: 'needs', column: 'Status', value: 'Needs review' } }] },
    { type: 'table', id: 'reviews', columns: ['Name', 'Status'], rows: [['API', 'Needs review'], ['Ledger', 'Approved']] },
];
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').length - 1;
const selector = () => screen.getByRole('button', { name: /^Inspector view:/ });
const chooseView = (title: string, extension?: string) => {
    fireEvent.click(selector());
    const group = extension ? screen.getByRole('group', { name: extension }) : screen.getByRole('menu');
    fireEvent.click(within(group).getByRole('menuitemradio', { name: title }));
};

interface HarnessProps {
    extensions: ExtensionSummary[];
    open?: boolean;
    selected?: CalmNodeSchema;
    initialTab?: InspectorTab;
    initialExtension?: string;
}

// Holds the tab and the extension as Hub does, so the inspector's own controls change them.
function Harness({ extensions, open = true, selected, initialTab = 'extensions', initialExtension }: HarnessProps) {
    const [state, setState] = useState<{ tab: InspectorTab; extension?: string }>({ tab: initialTab, extension: initialExtension });
    return (
        <ExtensionsContext.Provider value={extensions}>
            <DiagramInspector
                data={data}
                selected={selected}
                context={{ ...resource, selectedElement: selected?.['unique-id'] }}
                open={open}
                tab={state.tab}
                extensionId={state.extension}
                focusOnOpen={false}
                onFocused={() => {}}
                onSelectTab={(tab, extension) => setState((current) => ({ tab, extension: extension ?? current.extension }))}
                onClose={() => {}}
                onClearSelection={() => {}}
            />
        </ExtensionsContext.Provider>
    );
}

describe('DiagramInspector', () => {
    let call: MockInstance<ExtensionService['call']>;
    beforeEach(() => {
        call = vi.spyOn(ExtensionService.prototype, 'call').mockImplementation(async (extensionId, route, context) => {
            if (route.id === 'broken') throw new Error('down');
            if (extensionId === 'reviews') return { hubApi: 0, blocks: reviewBlocks };
            return { hubApi: 0, blocks: [{ type: 'markdown', text: `${extensionId} ${route.id} ${context.selectedElement ?? 'resource'}` }] };
        });
    });
    afterEach(() => call.mockRestore());

    const callsTo = (extensionId: string) => call.mock.calls.filter(([id]) => id === extensionId);

    it('shows the actions, views and detail panels of an extension for the resource, with no node selected', async () => {
        render(<Harness extensions={[scanner]} />);

        expect(screen.getByRole('button', { name: 'Run all' })).toHaveAttribute('aria-disabled', 'false');
        expect(screen.getByRole('button', { name: 'Scan node' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('button', { name: 'Scan node' })).toHaveAccessibleDescription('Select a node on the diagram to use the other actions.');
        expect(await screen.findByText('scanner summary resource')).toBeInTheDocument();
        expect(call.mock.calls.find(([, route]) => route.id === 'summary')?.[2]).toEqual({ ...resource, selectedElement: undefined });
        chooseView('Findings');
        expect(within(screen.getByRole('region', { name: 'Findings' })).getByText('Select a node on the diagram to see this view.')).toBeInTheDocument();
    });

    it('fills the detail panels for a selected node, and keeps a failed view to its own section', async () => {
        render(<Harness extensions={[scanner]} selected={api} />);

        expect(await screen.findByText('scanner summary api')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Scan node' })).toHaveAttribute('aria-disabled', 'false');
        chooseView('Findings');
        expect(await screen.findByText('scanner findings api')).toBeVisible();
        expect(screen.getByText('scanner summary api')).not.toBeVisible();
        chooseView('Broken');
        await screen.findByRole('alert');
        expect(within(screen.getByRole('region', { name: 'Broken' })).getByRole('alert')).toHaveTextContent('Extension request failed.');
        chooseView('Summary');
        expect(within(screen.getByRole('region', { name: 'Summary' })).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('chooses an extension from the menu, with a filter for a long list, and keeps an extension it left mounted but quiet', async () => {
        const many = fakeExtensions(6, ['designer-tab']);
        const view = render(<Harness extensions={many} />);
        expect(await screen.findByText('ext-1 data resource')).toBeInTheDocument();
        expect(selector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');

        fireEvent.click(selector());
        fireEvent.change(screen.getByRole('searchbox', { name: 'Filter inspector views' }), { target: { value: '6' } });
        expect(within(screen.getByRole('menu')).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Details', 'designer-tab 6']);
        fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Filter inspector views' }), { key: 'Enter' });

        expect(selector()).toHaveAccessibleName('Inspector view: Extension 6 — designer-tab 6');
        expect(await screen.findByText('ext-6 data resource')).toBeInTheDocument();
        const left = screen.getAllByTestId('inspector-extension').find((section) => section.dataset.extension === 'ext-1');
        expect(left).not.toBeVisible();

        // A new selection reloads only the extension on show.
        view.rerender(<Harness extensions={many} selected={api} />);
        expect(await screen.findByText('ext-6 data api')).toBeInTheDocument();
        expect(callsTo('ext-1')).toHaveLength(1);

        chooseView('designer-tab 1', 'Extension 1');
        expect(await screen.findByText('ext-1 data api')).toBeInTheDocument();
        expect(callsTo('ext-1')).toHaveLength(2);
    });

    it('keeps the table filters of an extension while another extension shows and while it is closed, for the same selection', async () => {
        const extensions = [reviews, fakeExtension(2, ['designer-tab'])];
        const view = render(<Harness extensions={extensions} initialExtension="reviews" />);
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        expect(tableRows()).toBe(1);

        chooseView('designer-tab 2', 'Extension 2');
        expect(await screen.findByText('ext-2 data resource')).toBeInTheDocument();
        chooseView('Open reviews', 'Reviews');
        expect(screen.getByRole('button', { name: /Needs review/ })).toHaveAttribute('aria-pressed', 'true');
        expect(tableRows()).toBe(1);

        view.rerender(<Harness extensions={extensions} initialExtension="reviews" open={false} />);
        view.rerender(<Harness extensions={extensions} initialExtension="reviews" />);
        expect(tableRows()).toBe(1);
        expect(callsTo('reviews')).toHaveLength(1);

        // Filters belong to the data of one context, so another selection starts without them.
        view.rerender(<Harness extensions={extensions} initialExtension="reviews" selected={api} />);
        await waitFor(() => expect(callsTo('reviews')).toHaveLength(2));
        expect(await screen.findByRole('button', { name: /Needs review/ })).toHaveAttribute('aria-pressed', 'false');
        expect(tableRows()).toBe(2);
    });

    it('keeps its extension slots mounted but quiet while it is closed', async () => {
        const extensions = [fakeExtension(1, ['designer-tab'])];
        const view = render(<Harness extensions={extensions} />);
        expect(await screen.findByText('ext-1 data resource')).toBeInTheDocument();
        const section = screen.getByTestId('inspector-extension');

        view.rerender(<Harness extensions={extensions} open={false} selected={api} />);
        expect(screen.queryByRole('button', { name: /^Inspector view:/ })).not.toBeInTheDocument();
        expect(section).toBeInTheDocument();
        expect(section).not.toBeVisible();
        await act(async () => {});
        expect(call).toHaveBeenCalledTimes(1);

        view.rerender(<Harness extensions={extensions} selected={api} />);
        expect(screen.getByTestId('inspector-extension')).toBe(section);
        expect(await screen.findByText('ext-1 data api')).toBeInTheDocument();
    });

    it('chooses a view with arrow keys and returns focus to the selector; Escape closes without changing it', async () => {
        const user = userEvent.setup();
        render(<Harness extensions={fakeExtensions(3, ['designer-tab'])} />);
        const menuButton = selector();

        menuButton.focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('menuitemradio', { name: 'designer-tab 1' })).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(menuButton).toHaveFocus();
        expect(selector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');

        await user.keyboard('{Enter}');
        await user.keyboard('{Home}{ArrowUp}');
        expect(screen.getByRole('menuitemradio', { name: 'designer-tab 3' })).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitemradio', { name: 'Details' })).toHaveFocus();
        await user.keyboard('{End}');
        expect(screen.getByRole('menuitemradio', { name: 'designer-tab 3' })).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(selector()).toHaveFocus();
        expect(selector()).toHaveAccessibleName('Inspector view: Extension 3 — designer-tab 3');
        await user.keyboard('{ArrowDown}{Home}{Enter}');
        expect(selector()).toHaveAccessibleName('Inspector view: Details');
        expect(screen.getByRole('region', { name: 'Details' })).toBeVisible();
    });

    it.each(['{Enter}', '{ArrowUp}{Enter}'])('chooses a filtered view with %s and keeps Details available when no view matches', async (keys) => {
        const user = userEvent.setup();
        render(<Harness extensions={fakeExtensions(6, ['designer-tab'])} />);
        await user.click(selector());
        expect(screen.getByRole('searchbox', { name: 'Filter inspector views' })).toHaveFocus();
        await user.keyboard(`5${keys}`);
        expect(selector()).toHaveFocus();
        expect(selector()).toHaveAccessibleName('Inspector view: Extension 5 — designer-tab 5');
        await user.click(selector());
        await user.keyboard('missing');
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
        expect(screen.getByText('No extension view matches the filter.')).toBeVisible();
        await user.keyboard('{ArrowUp}{Enter}');
        expect(selector()).toHaveAccessibleName('Inspector view: Details');
    });

    it('puts Details first and groups individual views by extension, including repeated view titles', async () => {
        const other = { ...scanner, id: 'other', name: 'Other scanner', contributes: { 'designer-tab': [scanner.contributes['designer-tab']![0]] } };
        render(<Harness extensions={[scanner, other]} initialTab="details" />);
        fireEvent.click(selector());
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Details', 'Summary', 'Broken', 'Findings', 'Summary']);
        expect(screen.getByRole('menuitemradio', { name: 'Details' })).toHaveAttribute('aria-checked', 'true');
        expect(within(screen.getByRole('group', { name: 'Scanner' })).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Summary', 'Broken', 'Findings']);
        fireEvent.click(within(screen.getByRole('group', { name: 'Other scanner' })).getByRole('menuitemradio', { name: 'Summary' }));
        expect(await screen.findByText('other summary resource')).toBeVisible();
        chooseView('Details');
        expect(screen.getByRole('region', { name: 'Details' })).toBeVisible();
    });

    it('keeps filters independently for two views with the same contribution id and loads only the visible view', async () => {
        const extension = { ...reviews, contributes: { ...reviews.contributes, 'detail-panel': [{ id: 'table', title: 'Review details', route: 'data' }] } };
        const view = render(<Harness extensions={[extension]} selected={api} />);
        fireEvent.click(await screen.findByRole('button', { name: /Needs review/ }));
        expect(tableRows()).toBe(1);
        expect(callsTo('reviews')).toHaveLength(1);
        chooseView('Review details');
        expect(await screen.findByRole('button', { name: /Needs review/ })).toHaveAttribute('aria-pressed', 'false');
        expect(tableRows()).toBe(2);
        chooseView('Open reviews');
        expect(tableRows()).toBe(1);
        expect(callsTo('reviews')).toHaveLength(2);
        chooseView('Details');
        view.rerender(<Harness extensions={[extension]} selected={{ ...api, 'unique-id': 'other' }} />);
        await act(async () => {});
        expect(callsTo('reviews')).toHaveLength(2);
        chooseView('Review details');
        expect(await screen.findByRole('table')).toBeVisible();
        expect(tableRows()).toBe(2);
        expect(callsTo('reviews')).toHaveLength(3);
    });

    it('offers Actions for an action-only extension and Details with no extension installed', () => {
        const view = render(<Harness extensions={[fakeExtension(1, ['action'])]} initialTab="details" />);
        chooseView('Actions', 'Extension 1');
        expect(screen.getByRole('button', { name: 'Run 1' })).toBeVisible();
        chooseView('Details');
        view.rerender(<Harness extensions={[]} initialTab="details" />);
        fireEvent.click(selector());
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
        expect(screen.getByRole('menuitemradio', { name: 'Details' })).toHaveAttribute('aria-checked', 'true');
    });
});

describe('MobileInspector', () => {
    // jsdom has no modal dialogs. These stand in for the browser, which keeps focus in a modal dialog.
    const showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
    beforeEach(() => {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
        Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close });
    });
    afterEach(() => {
        delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
        delete (HTMLDialogElement.prototype as { close?: unknown }).close;
        showModal.mockClear();
        close.mockClear();
    });

    const page = (open: boolean, onClose = vi.fn()) => (
        <MobileInspector open={open} onClose={onClose}>
            <input aria-label="Draft" />
            <dialog aria-label="Confirm" onCancel={(event) => event.preventDefault()} />
        </MobileInspector>
    );

    it('opens as a modal dialog, so focus stays in it and the page behind it is inert, and keeps its content when closed', () => {
        const { rerender } = render(page(false));
        expect(showModal).not.toHaveBeenCalled();
        rerender(page(true));
        expect(showModal).toHaveBeenCalledOnce();
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'kept' } });

        rerender(page(false));
        expect(close).toHaveBeenCalledOnce();
        rerender(page(true));
        expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('kept');
    });

    it('closes on Escape, but not on the Escape of a dialog in it', () => {
        const onClose = vi.fn();
        render(page(true, onClose));
        fireEvent(document.querySelector('dialog[aria-label="Confirm"]')!, new Event('cancel', { cancelable: true }));
        expect(onClose).not.toHaveBeenCalled();

        const escape = new Event('cancel', { cancelable: true });
        fireEvent(screen.getByRole('dialog', { name: 'Inspector' }), escape);
        expect(onClose).toHaveBeenCalledOnce();
        // The page closes the dialog when it is told to, so the browser must not close it first.
        expect(escape.defaultPrevented).toBe(true);
    });
});
