import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionSlot } from './ExtensionSlot.js';
import { ExtensionService } from '../service/extension-service.js';
import { ExtensionSummary } from '../model/extensions.js';
import { ExtensionsProvider } from './ExtensionsContext.js';
import { SlotActiveContext } from './slotActivity.js';
import { ExtensionRefresh, ExtensionRefreshContext } from './extensionRefresh.js';
const contribution = { id: 'summary', title: 'Summary', route: 'summary' };
const extension: ExtensionSummary = {
    id: 'test',
    name: 'Test',
    hubApi: 0,
    routes: [{ id: 'summary', path: '/summary', method: 'GET', scope: 'authenticated', readOnly: true }],
    contributes: {},
};
const writeExtension: ExtensionSummary = { ...extension, routes: [{ ...extension.routes[0], method: 'POST', readOnly: false }] };
afterEach(() => vi.restoreAllMocks());

describe('ExtensionSlot', () => {
    it('renders a block reply', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'markdown', text: 'ready' }] });
        render(<ExtensionSlot extension={extension} contribution={contribution} />);
        expect(await screen.findByText('ready')).toBeInTheDocument();
    });
    it('shows request failures', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValue(new Error());
        render(<ExtensionSlot extension={extension} contribution={contribution} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');
    });
    it('contains malformed replies', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 1, blocks: [] });
        render(<ExtensionSlot extension={extension} contribution={contribution} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');
    });
    it('does not call a write route to load blocks', async () => {
        const spy = vi.spyOn(ExtensionService.prototype, 'call');
        render(
            <ExtensionSlot
                extension={{ ...extension, routes: [{ ...extension.routes[0], method: 'POST', readOnly: false }] }}
                contribution={contribution}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent('must use GET');
        expect(spy).not.toHaveBeenCalled();
    });
    it('confirms a non-read-only action in a dialog before calling it', async () => {
        const spy = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(undefined);
        render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ version: '1' }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Run Summary?');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(spy).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(spy).toHaveBeenCalledOnce());
        expect(spy.mock.calls[0][2]).toEqual({ version: '1' });
    });
    it('reports a failed write', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValue(new Error());
        render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} />);
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');
        expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'false');
    });
    it('does not confirm read-only actions and reports failures', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValue(new Error());
        render(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} />);
        fireEvent.click(screen.getByRole('button'));
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

it('aborts a previous slot request and ignores its late reply', async () => {
    let complete: (value: unknown) => void = () => {};
    const spy = vi
        .spyOn(ExtensionService.prototype, 'call')
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = resolve;
                })
        )
        .mockResolvedValue({ hubApi: 0, blocks: [{ type: 'markdown', text: 'current' }] });
    const view = render(<ExtensionSlot extension={extension} contribution={contribution} context={{ version: '1' }} />);
    const signal = spy.mock.calls[0][3];
    view.rerender(<ExtensionSlot extension={extension} contribution={contribution} context={{ version: '2' }} />);
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText('current')).toBeInTheDocument();
    complete({ hubApi: 0, blocks: [{ type: 'markdown', text: 'stale' }] });
    await waitFor(() => expect(screen.queryByText('stale')).toBeNull());
});

it('aborts a read-only action when its host slot unmounts', async () => {
    const spy = vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise(() => {}));
    const view = render(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} />);
    fireEvent.click(screen.getByRole('button'));
    view.unmount();
    expect(spy.mock.calls[0][3]?.aborted).toBe(true);
});

it('does not abort a confirmed write when its host slot unmounts', async () => {
    const spy = vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise(() => {}));
    const view = render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} />);
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    view.unmount();
    expect(spy.mock.calls[0][3]).toBeUndefined();
});

it('keeps a confirmed write running when the context changes', async () => {
    let complete: (value: unknown) => void = () => {};
    const spy = vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(
        new Promise((resolve) => {
            complete = resolve;
        })
    );
    const view = render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ version: '1' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    view.rerender(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ version: '2' }} />);
    expect(spy.mock.calls[0][3]).toBeUndefined();
    expect(spy.mock.calls[0][2]).toEqual({ version: '1' });
    expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'true');
    complete(undefined);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('loads a GET block route without the optional readOnly flag', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    render(
        <ExtensionSlot extension={{ ...extension, routes: [{ ...extension.routes[0], readOnly: false }] }} contribution={contribution} />
    );
    expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument();
});

it('keeps the named region and its heading when the reply cannot be shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'table', columns: 'bad', rows: [] }] });
    render(<ExtensionSlot extension={extension} contribution={contribution} headingLevel={4} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot show');
    const region = screen.getByRole('region', { name: 'Summary' });
    expect(within(region).getByRole('alert')).toBeInTheDocument();
    expect(within(region).getByRole('heading', { level: 4, name: 'Summary' })).toBeInTheDocument();
});

describe('ExtensionSlot context and visibility', () => {
    const reply = (text: string) => ({ hubApi: 0, blocks: [{ type: 'markdown', text }] });

    it('stays mounted when the context changes, and shows Loading, not the blocks of the earlier target, until the new reply', async () => {
        let complete: (value: unknown) => void = () => {};
        vi.spyOn(ExtensionService.prototype, 'call')
            .mockResolvedValueOnce(reply('for a'))
            .mockImplementationOnce(() => new Promise((resolve) => (complete = resolve)));
        const view = render(<ExtensionSlot extension={extension} contribution={contribution} context={{ selectedElement: 'a' }} />);
        expect(await screen.findByText('for a')).toBeInTheDocument();
        const region = screen.getByRole('region', { name: 'Summary' });

        view.rerender(<ExtensionSlot extension={extension} contribution={contribution} context={{ selectedElement: 'b' }} />);
        expect(screen.queryByText('for a')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Loading extension…');
        expect(screen.getByRole('region', { name: 'Summary' })).toBe(region);

        await act(async () => complete(reply('for b')));
        expect(screen.getByText('for b')).toBeInTheDocument();
    });

    it('sends no request while it is hidden, and loads when it shows again only if its context changed', async () => {
        const spy = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply('ready'));
        const slot = (active: boolean, version: string) => (
            <SlotActiveContext.Provider value={active}>
                <ExtensionSlot extension={extension} contribution={contribution} context={{ version }} />
            </SlotActiveContext.Provider>
        );
        const view = render(slot(false, '1'));
        expect(spy).not.toHaveBeenCalled();

        view.rerender(slot(true, '1'));
        expect(await screen.findByText('ready')).toBeInTheDocument();
        expect(spy).toHaveBeenCalledTimes(1);

        view.rerender(slot(false, '1'));
        view.rerender(slot(true, '1'));
        expect(spy).toHaveBeenCalledTimes(1);

        view.rerender(slot(false, '2'));
        expect(spy).toHaveBeenCalledTimes(1);
        view.rerender(slot(true, '2'));
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
        expect(spy.mock.calls[1][2]).toMatchObject({ version: '2' });
    });

    it('offers Try again after the first load fails, also when it shows again after it was hidden', async () => {
        let complete: (value: unknown) => void = () => {};
        const spy = vi
            .spyOn(ExtensionService.prototype, 'call')
            .mockRejectedValueOnce(new Error('502'))
            .mockImplementationOnce(() => new Promise((resolve) => (complete = resolve)));
        const slot = (active: boolean) => (
            <SlotActiveContext.Provider value={active}>
                <ExtensionSlot extension={extension} contribution={contribution} context={{ version: '1' }} />
            </SlotActiveContext.Provider>
        );
        const view = render(slot(true));
        expect(await screen.findByRole('alert')).toHaveTextContent('Extension request failed.');
        // A slot stays mounted while it is hidden, so showing it again does not load it again.
        view.rerender(slot(false));
        view.rerender(slot(true));
        expect(spy).toHaveBeenCalledTimes(1);

        const retry = screen.getByRole('button', { name: 'Try again' });
        retry.focus();
        fireEvent.click(retry);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('button', { name: 'Trying again…' })).toHaveFocus();
        await act(async () => complete(reply('recovered')));
        expect(screen.getByText('recovered')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('loads the rows of a hidden source table only when it shows again, and keeps the search text', async () => {
        const tableExtension: ExtensionSummary = {
            ...extension,
            routes: [...extension.routes, { ...extension.routes[0], id: 'rows', path: '/rows' }],
        };
        const blocks = [{ type: 'table', id: 'items', columns: ['Item'], rows: [], source: { route: 'rows' }, search: { label: 'Filter items' } }];
        const spy = vi
            .spyOn(ExtensionService.prototype, 'call')
            .mockImplementation(async (_id, route, query) =>
                route.id === 'summary' ? { hubApi: 0, blocks } : { hubApi: 0, rows: [[`row ${query.q ?? ''}`.trim()]], total: 1 }
            );
        const refresh = new ExtensionRefresh();
        const slot = (active: boolean) => (
            <ExtensionRefreshContext.Provider value={refresh}>
                <SlotActiveContext.Provider value={active}>
                    <ExtensionSlot extension={tableExtension} contribution={contribution} />
                </SlotActiveContext.Provider>
            </ExtensionRefreshContext.Provider>
        );
        const routes = () => spy.mock.calls.map((call) => call[1].id);
        const view = render(slot(true));
        expect(await screen.findByText('row')).toBeInTheDocument();
        expect(routes()).toEqual(['summary', 'rows']);

        // A confirmed write while the slot is hidden.
        view.rerender(slot(false));
        await act(async () => refresh.refresh(tableExtension.id));
        expect(routes()).toEqual(['summary', 'rows']);
        view.rerender(slot(true));
        await waitFor(() => expect(routes().slice(2).sort()).toEqual(['rows', 'summary']));

        // A search that the user typed just before the slot hid.
        fireEvent.change(screen.getByRole('searchbox', { name: 'Filter items' }), { target: { value: 'pay' } });
        view.rerender(slot(false));
        await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
        expect(routes()).toHaveLength(4);
        view.rerender(slot(true));
        expect(await screen.findByText('row pay')).toBeInTheDocument();
        expect(routes()).toHaveLength(5);
        expect(screen.getByRole('searchbox', { name: 'Filter items' })).toHaveValue('pay');
    });

    it('clears a failure to render when the context changes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(ExtensionService.prototype, 'call')
            .mockResolvedValueOnce({ hubApi: 0, blocks: [{ type: 'table', columns: 'bad', rows: [] }] })
            .mockResolvedValueOnce(reply('fine'));
        const view = render(<ExtensionSlot extension={extension} contribution={contribution} context={{ selectedElement: 'a' }} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('cannot show');

        view.rerender(<ExtensionSlot extension={extension} contribution={contribution} context={{ selectedElement: 'b' }} />);
        expect(await screen.findByText('fine')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // An extension can fix its reply for the same context, so the slot must not stay failed.
    it('offers Try again for content that cannot show, and then loads the slot again for the same context', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const call = vi
            .spyOn(ExtensionService.prototype, 'call')
            .mockResolvedValueOnce({ hubApi: 0, blocks: [{ type: 'table', columns: 'bad', rows: [] }] })
            .mockResolvedValueOnce(reply('fixed'));
        const slot = (shown: boolean) => (
            <SlotActiveContext.Provider value={shown}>
                <ExtensionSlot extension={extension} contribution={contribution} context={{ selectedElement: 'a' }} />
            </SlotActiveContext.Provider>
        );
        const view = render(slot(true));
        expect(await screen.findByRole('alert')).toHaveTextContent('cannot show');

        // Hidden and shown again, the slot stays failed and sends no request by itself.
        view.rerender(slot(false));
        view.rerender(slot(true));
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
        expect(call).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert')).toHaveTextContent('cannot show');

        fireEvent.click(within(screen.getByRole('region', { name: 'Summary' })).getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('fixed')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(call).toHaveBeenCalledTimes(2);
        expect(call.mock.calls[1][1]).toBe(extension.routes[0]);
        expect(call.mock.calls[1][2]).toEqual(call.mock.calls[0][2]);
    });
});

describe('ExtensionSlot actions', () => {
    const target = { namespace: 'finos', resource: 'architecture/trading', version: '1.0.0', selectedElement: 'web-app' };
    function providerService() {
        const service = new ExtensionService();
        vi.spyOn(service, 'fetchExtensions').mockReturnValue(new Promise(() => {}));
        return service;
    }

    it('keeps a write disabled across a remount, so it cannot run twice', async () => {
        let complete: (value: unknown) => void = () => {};
        const spy = vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((resolve) => (complete = resolve)));
        const service = providerService();
        const page = (shown: boolean) => (
            <ExtensionsProvider service={service}>
                {shown && <ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={target} />}
            </ExtensionsProvider>
        );
        const view = render(page(true));
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        await waitFor(() => expect(spy).toHaveBeenCalledOnce());

        view.rerender(page(false));
        view.rerender(page(true));
        const button = screen.getByRole('button', { name: 'Summary' });
        expect(button).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(button);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await act(async () => complete(undefined));
        expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'false');
        expect(spy).toHaveBeenCalledOnce();
    });

    it('clears a failure when the context changes', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValue(new Error());
        const view = render(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '1' }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');

        view.rerender(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '2' }} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        view.rerender(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '1' }} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the result of a write that ends while the button is not on screen', async () => {
        let complete: (value: unknown) => void = () => {};
        vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((resolve) => (complete = resolve)));
        const service = providerService();
        const page = (shown: boolean) => (
            <ExtensionsProvider service={service}>
                {shown && <ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={target} />}
            </ExtensionsProvider>
        );
        const view = render(page(true));
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));

        view.rerender(page(false));
        await act(async () => complete(undefined));
        view.rerender(page(true));
        expect(screen.getByRole('status')).toHaveTextContent('Summary: done.');
    });

    /**
     * jsdom has no modal dialogs. This models what a browser does: while a dialog is modal, focus() on an element
     * outside it does nothing; close() or removal ends the modal state.
     */
    function modelModalDialogs() {
        const focus = HTMLElement.prototype.focus;
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
            configurable: true,
            value(this: HTMLDialogElement) {
                this.setAttribute('open', '');
                this.setAttribute('data-modal', '');
            },
        });
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
            configurable: true,
            value(this: HTMLDialogElement) {
                this.removeAttribute('open');
                this.removeAttribute('data-modal');
            },
        });
        vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
            const modal = document.querySelector('dialog[data-modal]');
            if (modal && !modal.contains(this)) return;
            focus.call(this, options);
        });
        return () => {
            delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
            delete (HTMLDialogElement.prototype as { close?: unknown }).close;
            vi.mocked(HTMLElement.prototype.focus).mockRestore();
        };
    }

    it('gives focus back to the action button after Cancel, Escape and Run, while the page is inert', async () => {
        const restore = modelModalDialogs();
        try {
            vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(undefined);
            render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={target} />);
            const button = screen.getByRole('button', { name: 'Summary' });

            fireEvent.click(button);
            expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(button).toHaveFocus();

            fireEvent.click(button);
            screen.getByRole('button', { name: 'Run' }).focus();
            fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(button).toHaveFocus();

            fireEvent.click(button);
            screen.getByRole('button', { name: 'Run' }).focus();
            fireEvent.click(screen.getByRole('button', { name: 'Run' }));
            expect(button).toHaveFocus();
            expect(await screen.findByRole('status')).toBeInTheDocument();
        } finally {
            restore();
        }
    });

    it('shows a result only on the button that ran it, and disables each button of the action while it runs', async () => {
        let complete: (value: unknown) => void = () => {};
        vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((resolve) => (complete = resolve)));
        render(
            <ExtensionsProvider service={providerService()}>
                <div data-testid="tab">
                    <ExtensionSlot action placement="tab" extension={extension} contribution={contribution} context={target} />
                </div>
                <div data-testid="other">
                    <ExtensionSlot action placement="other" extension={extension} contribution={contribution} context={target} />
                </div>
            </ExtensionsProvider>
        );
        const tab = within(screen.getByTestId('tab'));
        const other = within(screen.getByTestId('other'));
        fireEvent.click(tab.getByRole('button', { name: 'Summary' }));
        expect(other.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'true');
        expect(tab.getByRole('status')).toHaveTextContent('Summary: running…');
        expect(other.getByRole('status')).toBeEmptyDOMElement();

        await act(async () => complete(undefined));
        expect(tab.getByRole('status')).toHaveTextContent('Summary: done.');
        expect(other.getByRole('status')).toBeEmptyDOMElement();
        expect(other.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('keeps the failure of a confirmed write when the selection changes while it runs', async () => {
        let fail: (error: Error) => void = () => {};
        vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((_, reject) => (fail = reject)));
        const at = (selectedElement: string) => (
            <ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ ...target, selectedElement }} />
        );
        const view = render(at('node-a'));
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));

        view.rerender(at('node-b'));
        await act(async () => fail(new Error('502')));
        expect(screen.getByRole('alert')).toHaveTextContent('Extension request failed (finos architecture/trading 1.0.0 node-a).');

        view.rerender(at('node-a'));
        expect(screen.getByRole('alert')).toHaveTextContent('Extension request failed.');
    });

    it('clears the result of a write only when it runs again', async () => {
        const spy = vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValueOnce(new Error()).mockResolvedValue(undefined);
        const at = (version: string) => (
            <ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ version }} />
        );
        const view = render(at('1'));
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('failed');

        view.rerender(at('2'));
        expect(screen.getByRole('alert')).toHaveTextContent('Extension request failed (1).');
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole('status')).toHaveTextContent('Summary: done.');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says when an action is done, until the context changes', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(undefined);
        const view = render(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '1' }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Summary: done.');

        view.rerender(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '2' }} />);
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('says that a call runs in a live region that is in the page before the call, and stops when it fails', async () => {
        let fail: (error: Error) => void = () => {};
        vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((_, reject) => (fail = reject)));
        render(<ExtensionSlot action placement="test" extension={extension} contribution={contribution} context={{ version: '1' }} />);
        const live = screen.getByRole('status');
        expect(live).toBeEmptyDOMElement();
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        expect(live).toHaveTextContent('Summary: running…');

        await act(async () => fail(new Error('502')));
        expect(screen.getByRole('alert')).toHaveTextContent('failed');
        expect(live).toBeEmptyDOMElement();
    });

    it('names the target in the dialog, and sends the context of the click after the context changes', async () => {
        const spy = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(undefined);
        const view = render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={target} />);
        fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
        const dialog = screen.getByRole('dialog', { name: 'Confirm action' });
        expect(within(dialog).getAllByRole('definition').map((value) => value.textContent)).toEqual([
            'finos',
            'architecture/trading',
            '1.0.0',
            'web-app',
        ]);
        expect(dialog).toHaveTextContent('Resourcearchitecture/trading');
        expect(dialog).toHaveTextContent('Version1.0.0');
        expect(dialog).toHaveTextContent('Elementweb-app');

        view.rerender(
            <ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={{ ...target, version: '2.0.0' }} />
        );
        expect(screen.getByRole('dialog')).toHaveTextContent('Version1.0.0');
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        await waitFor(() => expect(spy).toHaveBeenCalledOnce());
        expect(spy.mock.calls[0][2]).toEqual(target);
    });

    it('opens the dialog as a modal, and closes it on Escape without a call', () => {
        const showModal = vi.fn(function (this: HTMLDialogElement) {
            this.setAttribute('open', '');
        });
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
        try {
            const spy = vi.spyOn(ExtensionService.prototype, 'call');
            render(<ExtensionSlot action placement="test" extension={writeExtension} contribution={contribution} context={target} />);
            fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
            expect(showModal).toHaveBeenCalledOnce();
            // Cancel, not Run, so an Enter does not confirm a write.
            expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

            fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(spy).not.toHaveBeenCalled();
        } finally {
            delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
        }
    });
});

it('makes the slot a size container, so its blocks follow the slot width', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    render(<ExtensionSlot extension={extension} contribution={contribution} />);
    expect(await screen.findByRole('region', { name: 'Summary' })).toHaveClass('@container');
});
