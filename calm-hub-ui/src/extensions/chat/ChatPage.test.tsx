import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsProvider } from '../ExtensionsContext.js';
import { ExtensionService } from '../../service/extension-service.js';
import { authStore } from '../../service/utils/auth-store.js';
import { getAuthHeaders } from '../../authService.js';
import { ChatSessionProvider } from './ChatSessionContext.js';
import { ChatPage } from './ChatPage.js';
import { ChatEntryLink } from './ChatEntryLink.js';
import { ExtensionResourceContext } from '../ExtensionResourceContext.js';
import { ReturnLink } from '../../navigation/ReturnLink.js';
import { IntroSearchBar } from '../../hub/components/intro-screen/IntroSearchBar.js';
import { GlobalSearchBar } from '../../components/navbar/GlobalSearchBar.js';
import { ExplorerSearch } from '../../components/navbar/ExplorerSearch.js';
import { SearchService } from '../../service/search-service.js';
import { useChatProvider } from '../ExtensionsContext.js';
import { StrictMode } from 'react';
import { SearchResultsPage } from '../../hub/components/search-results/SearchResultsPage.js';
import { ReturnPointProvider } from '../../navigation/ReturnPointProvider.js';

vi.mock('../../authService.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }) }));
vi.mock('../../components/navbar/Navbar.js', () => ({ Navbar: () => <nav>Navbar</nav> }));

const atlas = {
    id: 'knowledge',
    name: 'Knowledge',
    provider: 'Northstar platform team',
    hubApi: 0,
    routes: [{ id: 'chat', method: 'POST', path: '/chat', scope: 'authenticated', readOnly: true }],
    contributes: { chat: [{ id: 'atlas', title: 'Ask Atlas', route: 'chat' }] },
};
const payments = { namespace: 'finos', resourceType: 'architectures', resourceId: '7', version: '1.0.0' };
const reviewScreen = {
    extension: 'assurance',
    screen: 'reviews',
    context: { namespace: 'finos', type: 'architectures', id: '7', version: '1.0.0' },
    params: { status: 'open' },
};

/** One chat call: the request that the page sent, and the stream that the test writes the reply to. */
interface Call {
    url: string;
    body: Record<string, unknown>;
    headers: Record<string, string>;
    signal: AbortSignal;
    send: (event: string, data: object) => void;
    end: () => void;
}

let calls: Call[];
let reply: (call: Call) => Response | undefined;
/** Models a request whose events still arrive after the page aborted it, such as events already read from the network. */
let keepOpenOnAbort = false;
const encoder = new TextEncoder();

const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    const signal = init!.signal!;
    if (!keepOpenOnAbort) signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
    const call: Call = {
        url: String(input),
        body: JSON.parse(String(init!.body)),
        headers: init!.headers as Record<string, string>,
        signal,
        send: (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
        end: () => controller.close(),
    };
    calls.push(call);
    return reply(call) ?? new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
});

const review = {
    id: 'assurance',
    name: 'Assurance',
    hubApi: 0,
    routes: [{ id: 'ask', method: 'POST', path: '/ask', scope: 'authenticated', readOnly: true }],
    contributes: { chat: [{ id: 'review', title: 'Ask Review', route: 'ask' }] },
};

function service(chat: object | null = { extension: 'knowledge', contribution: 'atlas' }, values: object[] = [atlas]) {
    const ax = axios.create();
    new AxiosMockAdapter(ax as never).onGet('/api/calm/extensions').reply(200, { values, ...(chat ? { chat } : {}) });
    return new ExtensionService(ax, fetchFn as unknown as typeof fetch);
}

function ArchitecturePage() {
    return (
        <ExtensionResourceContext.Provider value={{ ...payments, resource: 'architectures/7' }}>
            <p>Payments architecture</p>
            <ReturnLink />
            <ChatEntryLink />
        </ExtensionResourceContext.Provider>
    );
}

function ReviewScreen() {
    const { search } = useLocation();
    return (
        <>
            <p>Review queue {search}</p>
            <ReturnLink />
        </>
    );
}

function Back() {
    const navigate = useNavigate();
    return (
        <>
            <button onClick={() => navigate(-1)}>Browser back</button>
            <button onClick={() => navigate(1)}>Browser forward</button>
        </>
    );
}

function SearchEntry() {
    const chat = useChatProvider();
    const { search } = useLocation();
    const Bar = search === '?navbar' ? GlobalSearchBar : search === '?explorer' ? ExplorerSearch : IntroSearchBar;
    const searchService = { search: () => Promise.reject(new Error('Catalogue unavailable')) } as unknown as SearchService;
    return (
        <>
            <p>{chat ? 'Chat ready' : 'No chat chosen'}</p>
            <ExtensionResourceContext.Provider value={{ ...payments, resource: 'architectures/7', selectedElement: 'gateway' }}>
                <Bar searchService={searchService} />
            </ExtensionResourceContext.Provider>
        </>
    );
}

function LocationState() {
    const location = useLocation();
    return (
        <div data-testid="location-state">
            {JSON.stringify({ path: location.pathname, search: location.search, state: location.state })}
        </div>
    );
}

const catalogue = {
    search: () =>
        Promise.resolve({
            architectures: [],
            patterns: [],
            flows: [],
            standards: [],
            interfaces: [],
            adrs: [],
            controls: [{ namespace: 'finos', id: 2, name: 'Available catalogue result' }],
        }),
} as unknown as SearchService;
function SearchPage() {
    return (
        <ReturnPointProvider page={{ kind: 'search' }} label="search results">
            <IntroSearchBar searchService={catalogue} />
            <SearchResultsPage searchService={catalogue} />
        </ReturnPointProvider>
    );
}

function renderChat(initial: string | string[] = '/chat', svc = service()) {
    const entries = Array.isArray(initial) ? initial : [initial];
    const tree = (current: ExtensionService) => (
        <StrictMode>
            <ExtensionsProvider service={current}>
                <ChatSessionProvider>
                    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
                        <Back />
                        <LocationState />
                        <Routes>
                            <Route path="/search-entry" element={<SearchEntry />} />
                            <Route path="/search" element={<SearchPage />} />
                            <Route path="/chat" element={<ChatPage />} />
                            <Route path="/finos/architectures/7/1.0.0" element={<ArchitecturePage />} />
                            <Route path="/extensions/assurance/reviews" element={<ReviewScreen />} />
                            <Route path="/" element={<ChatEntryLink />} />
                        </Routes>
                    </MemoryRouter>
                </ChatSessionProvider>
            </ExtensionsProvider>
        </StrictMode>
    );
    const view = render(tree(svc));
    // A new service loads the registry again, as after an operator change.
    return { ...view, reload: (next: ExtensionService) => view.rerender(tree(next)) };
}

async function ask(question: string) {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Message to Ask Atlas'), question);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    return user;
}

const lastCall = () => calls[calls.length - 1];
const replies = () => screen.getAllByTestId('chat-reply');

beforeEach(() => {
    // jsdom has no layout or scrolling; the browser journey checks the scroll position.
    Element.prototype.scrollIntoView = vi.fn();
    calls = [];
    reply = () => undefined;
    keepOpenOnAbort = false;
    fetchFn.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe('ChatPage', () => {
    it.each(['home', 'navbar', 'explorer'])('asks the assistant on %s search submission, never on focus or typing', async (surface) => {
        renderChat(`/search-entry?${surface}`);
        const user = userEvent.setup();
        await screen.findByText('Chat ready');
        await user.click(screen.getByRole('combobox'));
        await user.keyboard('{Enter}');
        expect(calls).toHaveLength(0);
        expect(screen.queryByText('Continue in chat')).not.toBeInTheDocument();
        await user.type(screen.getByRole('combobox'), 'Why is the gateway failing?');
        await screen.findByText('Search failed, please try again');
        expect(calls).toHaveLength(0);
        await user.keyboard('{Enter}');
        await waitFor(() => expect(calls).toHaveLength(1));
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'Why is the gateway failing?' }]);
        expect(lastCall().body).not.toHaveProperty('context');
        expect(await screen.findByText('Available catalogue result')).toBeInTheDocument();
        expect(await screen.findByLabelText('Message to Ask Atlas')).toHaveValue('');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('names the recipient before an immediate navbar submission, without waiting for catalogue results', async () => {
        renderChat('/search-entry?navbar');
        await screen.findByText('Chat ready');
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'private plan' } });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getByText(/Search also asks/)).toHaveTextContent(
            'Search also asks Knowledge. Only your query is shared. Provider charges and retention policies apply.'
        );
        expect(screen.getByRole('combobox')).toHaveAccessibleDescription(
            'Search also asks Knowledge. Only your query is shared. Provider charges and retention policies apply.'
        );
        expect(calls).toHaveLength(0);
        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
        await waitFor(() => expect(calls).toHaveLength(1));
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'private plan' }]);
    });

    it.each(['Escape', 'outside click'])('dismisses the navbar notice on %s until the query changes', async (action) => {
        renderChat('/search-entry?navbar');
        await screen.findByText('Chat ready');
        const input = screen.getByRole('combobox');
        const dismiss = () => {
            if (action === 'Escape') fireEvent.keyDown(input, { key: 'Escape' });
            else fireEvent.mouseDown(screen.getByText('Chat ready'));
        };
        fireEvent.change(input, { target: { value: 'payments' } });
        expect(screen.getByText(/Search also asks/)).toBeVisible();
        dismiss();
        expect(screen.queryByText(/Search also asks/)).not.toBeInTheDocument();
        expect(input).toHaveAttribute('aria-expanded', 'false');
        fireEvent.change(input, { target: { value: 'ledger' } });
        expect(screen.getByText(/Search also asks/)).toBeVisible();
        await screen.findByText('Search failed, please try again');
        dismiss();
        expect(screen.queryByText(/Search also asks/)).not.toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(input).toHaveValue('ledger');
        expect(calls).toHaveLength(0);
    });

    it('expands a long answer without requesting again or losing the draft, then follows up in the same conversation', async () => {
        renderChat('/search?q=payments');
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        const initial = lastCall();
        const text = 'Opening explanation. '.repeat(40) + '\n\nFinal detail with [a runbook](https://example.com/runbook).';
        act(() => {
            initial.send('delta', { text });
            initial.send('done', {});
        });
        const more = await screen.findByRole('button', { name: 'Show more' });
        expect(screen.queryByRole('link', { name: 'a runbook' })).not.toBeInTheDocument();
        const draft = await screen.findByLabelText('Message to Ask Atlas');
        await user.type(draft, 'Unsent question');
        more.focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('link', { name: 'a runbook' })).toBeVisible();
        const less = screen.getByRole('button', { name: 'Show less' });
        expect(less).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: 'Show more' })).toHaveFocus();
        expect(draft).toHaveValue('Unsent question');
        expect(calls).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(calls).toHaveLength(2));
        expect(lastCall().body.conversationId).toBe(initial.body.conversationId);
        expect(lastCall().body.messages).toEqual([
            { role: 'user', content: 'payments' },
            { role: 'assistant', content: text },
            { role: 'user', content: 'Unsent question' },
        ]);
    });

    it('keeps short answers whole and keeps search usable while the assistant fails, stops or retries', async () => {
        renderChat('/search?q=payments');
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        expect(await screen.findByText('Available catalogue result')).toBeInTheDocument();
        const initial = lastCall();
        act(() => initial.send('delta', { text: 'Short answer.' }));
        expect(await screen.findByText('Short answer.')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Stop' }));
        expect(initial.signal.aborted).toBe(true);
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(calls).toHaveLength(2));
        expect(lastCall().body).toEqual(initial.body);
        act(() => lastCall().send('error', { message: 'Provider unavailable' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
        expect(screen.getByText('Available catalogue result')).toBeVisible();
    });

    it('starts fresh on another search and same-query resubmission, ignoring the old stream', async () => {
        keepOpenOnAbort = true;
        renderChat('/search?q=old');
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        const old = lastCall();
        await user.type(screen.getByRole('combobox'), 'new');
        // act() flushes Router's transition with urgent state and masks an intervening request for the old query.
        const actEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
        try {
            screen.getByRole('combobox').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await vi.waitFor(() => {
                expect(screen.getByTestId('location-state')).toHaveTextContent('"search":"?q=new"');
                expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'new' }]);
            });
        } finally {
            vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', actEnvironment);
        }
        await waitFor(() => expect(calls).toHaveLength(2));
        expect(old.signal.aborted).toBe(true);
        const next = lastCall();
        expect(next.body.messages).toEqual([{ role: 'user', content: 'new' }]);
        expect(next.body.conversationId).not.toBe(old.body.conversationId);
        act(() => {
            old.send('delta', { text: 'Stale answer' });
            old.end();
            next.send('delta', { text: 'Current answer' });
            next.send('done', {});
        });
        expect(await screen.findByText('Current answer')).toBeVisible();
        expect(screen.queryByText('Stale answer')).not.toBeInTheDocument();
        await user.type(screen.getByRole('combobox'), 'new{Enter}');
        await waitFor(() => expect(calls).toHaveLength(3));
        expect(lastCall().body.conversationId).not.toBe(next.body.conversationId);
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'new' }]);
    });

    it.each([false, true])('preserves a chat draft and any sent conversation on history navigation (sent: %s)', async (sent) => {
        renderChat(['/search?q=payments', '/chat']);
        const user = userEvent.setup();
        await screen.findByLabelText('Message to Ask Atlas');
        if (sent) {
            await ask('Explain the ledger');
            act(() => {
                lastCall().send('delta', { text: 'The ledger records transactions.' });
                lastCall().send('done', {});
            });
            await screen.findByText('The ledger records transactions.');
        }
        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'Keep this unsent draft');
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(await screen.findByRole('button', { name: 'Ask Knowledge' })).toBeVisible();
        expect(await screen.findByText('Available catalogue result')).toBeVisible();
        expect(calls).toHaveLength(sent ? 1 : 0);
        await user.click(screen.getByRole('button', { name: 'Browser forward' }));
        expect(await screen.findByLabelText('Message to Ask Atlas')).toHaveValue('Keep this unsent draft');
        if (sent) expect(screen.getByText('The ledger records transactions.')).toBeVisible();
        expect(calls).toHaveLength(sent ? 1 : 0);
    });

    it('does not ask again on Back or Forward between searches, but allows an explicit fresh answer', async () => {
        renderChat('/search?q=payments');
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        await user.type(screen.getByRole('combobox'), 'ledger{Enter}');
        await waitFor(() => expect(calls).toHaveLength(2));
        const ledger = lastCall();
        act(() => {
            ledger.send('delta', { text: 'Ledger search answer.' });
            ledger.send('done', {});
        });
        await user.type(await screen.findByLabelText('Message to Ask Atlas'), 'Ledger follow-up draft');
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(await screen.findByRole('button', { name: 'Ask Knowledge' })).toBeVisible();
        expect(calls).toHaveLength(2);
        await user.click(screen.getByRole('button', { name: 'Browser forward' }));
        expect(await screen.findByText('Ledger search answer.')).toBeVisible();
        expect(screen.getByLabelText('Message to Ask Atlas')).toHaveValue('Ledger follow-up draft');
        expect(calls).toHaveLength(2);
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        await user.click(await screen.findByRole('button', { name: 'Ask Knowledge' }));
        await waitFor(() => expect(calls).toHaveLength(3));
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'payments' }]);
        expect(lastCall().body.conversationId).not.toBe(ledger.body.conversationId);
    });

    it('requires explicit submission before sending a search to a changed provider', async () => {
        const view = renderChat('/search?q=payments', service(undefined, [atlas, review]));
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        const old = lastCall();
        view.reload(service({ extension: 'assurance', contribution: 'review' }, [atlas, review]));
        expect(await screen.findByRole('button', { name: 'Ask Assurance' })).toBeVisible();
        expect(await screen.findByText('Available catalogue result')).toBeVisible();
        expect(old.signal.aborted).toBe(true);
        expect(calls).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'Ask Assurance' }));
        await waitFor(() => expect(calls).toHaveLength(2));
        expect(lastCall().url).toBe('/api/calm/extensions/assurance/chat/review');
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'payments' }]);
        expect(lastCall().body).not.toHaveProperty('context');
    });

    it('returns from a search citation with the answer and draft intact, without resending', async () => {
        renderChat('/search?q=payments');
        const user = userEvent.setup();
        await waitFor(() => expect(calls).toHaveLength(1));
        act(() => {
            lastCall().send('delta', { text: 'Read the payments architecture.' });
            lastCall().send('citation', {
                label: 'Payments platform',
                hub: { namespace: 'finos', type: 'architectures', id: '7', version: '1.0.0' },
            });
            lastCall().send('done', {});
        });
        await user.type(await screen.findByLabelText('Message to Ask Atlas'), 'Follow-up draft');
        await user.click(screen.getByRole('link', { name: 'Payments platform' }));
        await user.click(await screen.findByRole('link', { name: /Back to search results/ }));
        expect(await screen.findByText('Read the payments architecture.')).toBeVisible();
        expect(screen.getByLabelText('Message to Ask Atlas')).toHaveValue('Follow-up draft');
        expect(calls).toHaveLength(1);
    });

    it('keeps search without a chat action when no provider is chosen', async () => {
        renderChat('/search-entry', service(null));
        const user = userEvent.setup();
        await user.type(screen.getByRole('combobox'), 'gateway');
        await screen.findByText('Search failed, please try again');
        expect(screen.queryByRole('link', { name: 'Ask Atlas' })).not.toBeInTheDocument();
    });

    it('names the provider that gets the messages and sends the question to its chat endpoint', async () => {
        renderChat();
        expect(await screen.findByRole('heading', { level: 1, name: 'Ask Atlas' })).toBeInTheDocument();
        expect(screen.getByText(/Messages go to/)).toHaveTextContent('Messages go to Knowledge · Northstar platform team');
        await ask('Explain the Payments platform');
        const call = lastCall();
        expect(call.url).toBe('/api/calm/extensions/knowledge/chat/atlas');
        expect(call.headers).toMatchObject({
            Authorization: 'Bearer test',
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
        });
        expect(call.body).toEqual({
            conversationId: expect.any(String),
            messageId: expect.any(String),
            messages: [{ role: 'user', content: 'Explain the Payments platform' }],
        });
    });

    it('shows a streamed reply while it arrives, then its citations as Hub links', async () => {
        renderChat();
        await ask('Explain the Payments platform');
        act(() => lastCall().send('delta', { text: 'Payments platform connects ' }));
        expect(await screen.findByText('Payments platform connects')).toBeInTheDocument();
        expect(replies()[0]).toHaveAttribute('data-status', 'streaming');
        expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
        act(() => {
            lastCall().send('delta', { text: 'a web client to the Payments API.' });
            lastCall().send('citation', {
                label: 'Payments platform',
                hub: { namespace: 'finos', type: 'architectures', id: '7', version: '1.0.0' },
            });
            lastCall().send('citation', { label: 'Runbook', href: 'https://runbooks.example.com/payments' });
            lastCall().send('citation', { label: 'Open reviews', screen: reviewScreen });
            lastCall().send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        expect(replies()[0]).toHaveTextContent('Payments platform connects a web client to the Payments API.');
        expect(within(screen.getByRole('list', { name: 'Sources' })).getByRole('link', { name: 'Open reviews' })).toHaveAttribute(
            'href',
            '/extensions/assurance/reviews?namespace=finos&resourceType=architectures&resourceId=7&version=1.0.0&status=open'
        );
        const sources = within(screen.getByRole('list', { name: 'Sources' }));
        expect(sources.getByRole('link', { name: 'Payments platform' })).toHaveAttribute('href', '/finos/architectures/7/1.0.0?exact=1');
        expect(sources.getByRole('link', { name: /Runbook/ })).toHaveAttribute('href', 'https://runbooks.example.com/payments');
    });

    it('leaves out a citation that Hub cannot open', async () => {
        renderChat();
        await ask('Sources?');
        act(() => {
            lastCall().send('citation', { label: 'No target' });
            lastCall().send('citation', {
                label: 'Both',
                href: 'https://a.example.com',
                hub: { namespace: 'a', type: 'b', id: 'c', version: 'd' },
            });
            lastCall().send('citation', { label: 'Script', href: 'javascript:alert(1)' });
            lastCall().send('citation', { label: 'No screen', screen: { extension: 'assurance' } });
            lastCall().send('citation', { label: 'Context param', screen: { ...reviewScreen, params: { namespace: 'other' } } });
            lastCall().send('citation', {
                label: 'Dot segment',
                hub: { namespace: '..', type: 'architectures', id: '7', version: '1.0.0' },
            });
            lastCall().send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        expect(screen.queryByRole('list', { name: 'Sources' })).not.toBeInTheDocument();
        for (const label of ['No target', 'Both', 'Script', 'No screen', 'Context param', 'Dot segment']) {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
    });

    it('stops a reply, keeps the part that came, and retries with the same message id and one question', async () => {
        renderChat();
        const user = await ask('List the payment services');
        act(() => lastCall().send('delta', { text: 'Payments API and' }));
        await screen.findByText('Payments API and');
        await user.click(screen.getByRole('button', { name: 'Stop' }));

        expect(lastCall().signal.aborted).toBe(true);
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'stopped'));
        expect(replies()[0]).toHaveTextContent('Payments API and');
        expect(screen.getByText('You stopped this reply.')).toBeInTheDocument();

        const first = lastCall().body;
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        expect(calls).toHaveLength(2);
        expect(lastCall().body).toEqual(first);
        expect(screen.getAllByTestId('chat-question')).toHaveLength(1);
        act(() => {
            lastCall().send('delta', { text: 'Payments API and Ledger.' });
            lastCall().send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        expect(replies()).toHaveLength(1);
        expect(replies()[0]).toHaveTextContent('Payments API and Ledger.');
    });

    it('stops a reply at once while sign-in is pending, sends nothing for it, and keeps the retry in control', async () => {
        renderChat();
        const user = userEvent.setup();
        await user.type(await screen.findByLabelText('Message to Ask Atlas'), 'List the payment services');
        let signIn!: (headers: Record<string, string>) => void;
        vi.mocked(getAuthHeaders).mockReturnValueOnce(new Promise((resolve) => (signIn = resolve)));
        await user.click(screen.getByRole('button', { name: 'Send' }));
        expect(replies()[0]).toHaveAttribute('data-status', 'streaming');

        await user.click(screen.getByRole('button', { name: 'Stop' }));
        expect(replies()[0]).toHaveAttribute('data-status', 'stopped');
        expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(calls).toHaveLength(1));
        const retried = lastCall();
        // The stopped attempt ends only now. It must not send, change the retry, or let it go from Stop.
        await act(async () => signIn({ Authorization: 'Bearer late' }));
        expect(calls).toHaveLength(1);
        expect(replies()[0]).toHaveAttribute('data-status', 'streaming');
        act(() => retried.send('delta', { text: 'Payments API' }));
        await screen.findByText('Payments API');
        await user.click(screen.getByRole('button', { name: 'Stop' }));
        expect(retried.signal.aborted).toBe(true);
        expect(replies()[0]).toHaveAttribute('data-status', 'stopped');
        expect(replies()[0]).toHaveTextContent('Payments API');
    });

    it('announces when a reply starts, completes or stops, but not its text', async () => {
        renderChat();
        const user = await ask('First');
        const live = () => screen.getByRole('status');
        expect(live()).toHaveAttribute('aria-live', 'polite');
        expect(live()).toHaveTextContent('Knowledge is replying');
        act(() => lastCall().send('delta', { text: 'Payments platform' }));
        await screen.findByText('Payments platform');
        expect(live()).toHaveTextContent(/^Knowledge is replying$/);
        act(() => lastCall().send('done', {}));
        await waitFor(() => expect(live()).toHaveTextContent(/^Reply complete$/));

        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'Second{Enter}');
        expect(live()).toHaveTextContent('Knowledge is replying');
        await user.click(screen.getByRole('button', { name: 'Stop' }));
        expect(live()).toHaveTextContent(/^Reply stopped$/);

        // The alert announces a failure, so the status says nothing more.
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        act(() => lastCall().send('error', { message: 'The extension stopped replying' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The reply failed: The extension stopped replying');
        expect(live()).toBeEmptyDOMElement();
    });

    it('shows an error event, a refusal and an interrupted stream as failures that can be retried', async () => {
        renderChat();
        const user = await ask('First');
        act(() => lastCall().send('error', { message: 'The extension stopped replying' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The reply failed: The extension stopped replying');

        reply = () =>
            new Response(JSON.stringify({ error: 'The extension is busy. Try again later' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            });
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The reply failed: The extension is busy. Try again later');

        reply = () => undefined;
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        act(() => {
            lastCall().send('delta', { text: 'Half an answer' });
            lastCall().end();
        });
        expect(await screen.findByRole('alert')).toHaveTextContent('The reply ended before it was complete');
        expect(replies()[0]).toHaveTextContent('Half an answer');
        expect(new Set(calls.map((call) => call.body.messageId)).size).toBe(1);
        expect(screen.getAllByTestId('chat-question')).toHaveLength(1);
    });

    it('opens the sign-in prompt when the Hub session ended', async () => {
        const setAuthError = vi.spyOn(authStore, 'setAuthError');
        reply = () => new Response(JSON.stringify({ error: 'Sign in' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        renderChat();
        await ask('Hello');
        await screen.findByRole('alert');
        expect(setAuthError).toHaveBeenCalledWith(401);
    });

    it('sends earlier questions and finished replies with the next question, but not a failed reply', async () => {
        renderChat();
        const user = await ask('One');
        act(() => {
            lastCall().send('delta', { text: 'Answer one' });
            lastCall().send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'Two');
        await user.click(screen.getByRole('button', { name: 'Send' }));
        act(() => lastCall().send('error', { message: 'down' }));
        await screen.findByRole('alert');
        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'Three{Enter}');
        expect(lastCall().body.messages).toEqual([
            { role: 'user', content: 'One' },
            { role: 'assistant', content: 'Answer one' },
            { role: 'user', content: 'Two' },
            { role: 'user', content: 'Three' },
        ]);
        expect(new Set(calls.map((call) => call.body.conversationId)).size).toBe(1);
    });

    it('shares the offered architecture only when the user chooses to, and asks again for a new one', async () => {
        renderChat(['/', '/finos/architectures/7/1.0.0']);
        const user = userEvent.setup();
        await user.click(await screen.findByRole('link', { name: 'Ask Atlas' }));
        const share = await screen.findByRole('checkbox', { name: /Share finos \/ architectures\/7 1.0.0 with Knowledge/ });
        expect(share).not.toBeChecked();

        await ask('Without context');
        expect(lastCall().body).not.toHaveProperty('context');
        act(() => lastCall().send('done', {}));
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));

        await user.click(share);
        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'With context{Enter}');
        expect(lastCall().body.context).toEqual(payments);
        expect(screen.getAllByTestId('chat-question')[1]).toHaveTextContent('Shared: finos / architectures/7 1.0.0');
        act(() => lastCall().send('done', {}));
        await waitFor(() => expect(replies()[1]).toHaveAttribute('data-status', 'done'));

        // From a page with no resource, nothing is offered any more.
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(await screen.findByText('Payments architecture')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        await user.click(await screen.findByRole('link', { name: 'Ask Atlas' }));
        expect(await screen.findByText(/No architecture is shared/)).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'After{Enter}');
        expect(lastCall().body).not.toHaveProperty('context');
    });

    it('keeps the conversation while the user opens a cited architecture and goes back', async () => {
        renderChat();
        const user = await ask('Explain the Payments platform');
        act(() => {
            lastCall().send('delta', { text: 'It connects the web client.' });
            lastCall().send('citation', {
                label: 'Payments platform',
                hub: { namespace: 'finos', type: 'architectures', id: '7', version: '1.0.0' },
            });
            lastCall().send('done', {});
        });
        await user.click(await screen.findByRole('link', { name: 'Payments platform' }));
        expect(await screen.findByText('Payments architecture')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(await screen.findByText('It connects the web client.')).toBeInTheDocument();
        expect(screen.getAllByTestId('chat-question')).toHaveLength(1);
    });

    it.each([
        ['architecture', 'Payments platform', 'Payments architecture'],
        [
            'extension screen',
            'Open reviews',
            'Review queue ?namespace=finos&resourceType=architectures&resourceId=7&version=1.0.0&status=open',
        ],
    ])('opens a cited %s and returns to the conversation through its Back link', async (_, label, page) => {
        renderChat();
        const user = await ask('Explain the Payments platform');
        act(() => {
            lastCall().send('delta', { text: 'It connects the web client.' });
            lastCall().send('citation', {
                label: 'Payments platform',
                hub: { namespace: 'finos', type: 'architectures', id: '7', version: '1.0.0' },
            });
            lastCall().send('citation', { label: 'Open reviews', screen: reviewScreen });
            lastCall().send('done', {});
        });
        await user.click(await screen.findByRole('link', { name: label }));
        expect(await screen.findByText(page)).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: 'Back to Ask Atlas' }));
        expect(await screen.findByText('It connects the web client.')).toBeInTheDocument();
        expect(screen.getAllByTestId('chat-question')).toHaveLength(1);
        expect(screen.getByLabelText('Message to Ask Atlas')).toBeInTheDocument();
    });

    it('starts a new conversation with a new id and stops a reply in progress', async () => {
        renderChat();
        const user = await ask('First');
        const first = lastCall();
        await user.click(screen.getByRole('button', { name: 'New conversation' }));
        expect(first.signal.aborted).toBe(true);
        expect(screen.queryByTestId('chat-question')).not.toBeInTheDocument();
        await ask('Second');
        expect(lastCall().body.conversationId).not.toBe(first.body.conversationId);
        expect(lastCall().body.messages).toEqual([{ role: 'user', content: 'Second' }]);
    });

    it.each([
        [
            'another provider',
            [service({ extension: 'assurance', contribution: 'review' }, [atlas, review])],
            'Ask Review',
            '/api/calm/extensions/assurance/chat/review',
        ],
        [
            'no provider, then the same provider again',
            [service(null, [atlas, review]), service(undefined, [atlas, review])],
            'Ask Atlas',
            '/api/calm/extensions/knowledge/chat/atlas',
        ],
    ])(
        'after a change to %s, stops the old reply and shares no resource until the user chooses again',
        async (_, registries, title, url) => {
            const view = renderChat(['/', '/finos/architectures/7/1.0.0'], service(undefined, [atlas, review]));
            const user = userEvent.setup();
            await user.click(await screen.findByRole('link', { name: 'Ask Atlas' }));
            await user.click(await screen.findByRole('checkbox', { name: /Share finos \/ architectures\/7 1.0.0/ }));
            await ask('Shared with Atlas');
            const old = lastCall();
            expect(old.body.context).toEqual(payments);

            for (const registry of registries) {
                view.reload(registry);
                await waitFor(() => expect(screen.queryByTestId('chat-question')).not.toBeInTheDocument());
            }

            expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
            expect(old.signal.aborted).toBe(true);
            const share = screen.getByRole('checkbox', { name: /Share finos \/ architectures\/7 1.0.0/ });
            expect(share).not.toBeChecked();
            await user.type(screen.getByLabelText(`Message to ${title}`), 'Not shared{Enter}');
            expect(lastCall().url).toBe(url);
            expect(lastCall().body).not.toHaveProperty('context');
            expect(lastCall().body.conversationId).not.toBe(old.body.conversationId);
            act(() => lastCall().send('done', {}));
            await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));

            await user.click(share);
            await user.type(screen.getByLabelText(`Message to ${title}`), 'Shared again{Enter}');
            expect(lastCall().body.context).toEqual(payments);
        }
    );

    it('ends a request at its error event, so a late event of that request cannot change the retry', async () => {
        keepOpenOnAbort = true;
        renderChat();
        const user = await ask('Explain');
        const first = lastCall();
        act(() => first.send('error', { message: 'The model is busy' }));
        expect(await screen.findByText('The reply failed: The model is busy')).toBeInTheDocument();
        expect(first.signal.aborted).toBe(true);

        await user.click(screen.getByRole('button', { name: 'Retry' }));
        const second = lastCall();
        expect(second).not.toBe(first);
        expect(second.body.messageId).toBe(first.body.messageId);
        act(() => {
            first.send('delta', { text: 'late' });
            first.send('citation', { label: 'Late', href: 'https://late.example.com' });
            first.send('error', { message: 'late failure' });
            first.send('done', {});
        });
        expect(replies()[0]).toHaveAttribute('data-status', 'streaming');
        act(() => {
            second.send('delta', { text: 'Fresh' });
            second.send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        expect(replies()[0]).toHaveTextContent('Fresh');
        expect(replies()[0]).not.toHaveTextContent(/late/i);
        expect(second.signal.aborted).toBe(true);
        expect(screen.getAllByTestId('chat-question')).toHaveLength(1);
    });

    it('ends a request at its done event, so a late event of that request cannot change the next reply', async () => {
        keepOpenOnAbort = true;
        renderChat();
        const user = await ask('One');
        const first = lastCall();
        act(() => {
            first.send('delta', { text: 'Answer one' });
            first.send('done', {});
        });
        await waitFor(() => expect(replies()[0]).toHaveAttribute('data-status', 'done'));
        expect(first.signal.aborted).toBe(true);

        await user.type(screen.getByLabelText('Message to Ask Atlas'), 'Two{Enter}');
        const second = lastCall();
        expect(second.body.messages).toEqual([
            { role: 'user', content: 'One' },
            { role: 'assistant', content: 'Answer one' },
            { role: 'user', content: 'Two' },
        ]);
        act(() => {
            first.send('delta', { text: ' late' });
            first.send('error', { message: 'late failure' });
        });
        expect(replies()[0]).toHaveTextContent('Answer one');
        expect(replies()[0]).not.toHaveTextContent('late');
        expect(replies()[1]).toHaveAttribute('data-status', 'streaming');
        act(() => second.send('done', {}));
        await waitFor(() => expect(replies()[1]).toHaveAttribute('data-status', 'done'));
    });

    it('says so when the operator chose no chat provider', async () => {
        renderChat('/chat', service(null));
        expect(await screen.findByText('The operator has not chosen a chat provider for this CALM Hub.')).toBeInTheDocument();
        expect(screen.queryByLabelText('Message to Ask Atlas')).not.toBeInTheDocument();
    });
});
