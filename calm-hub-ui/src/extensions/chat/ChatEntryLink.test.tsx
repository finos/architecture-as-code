import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ChatProviderContext, ExtensionsContext } from '../ExtensionsContext.js';
import { ExtensionResourceContext } from '../ExtensionResourceContext.js';
import { fakeExtension } from '../../test-support/fake-extensions.js';
import { ChatEntryLink, chatContextOf } from './ChatEntryLink.js';
import { userEvent } from '@testing-library/user-event';

const resource = { namespace: 'finos', resource: 'architectures/7', resourceType: 'architectures', resourceId: '7', version: '1.0.0' };

function State() {
    return <pre data-testid="state">{JSON.stringify(useLocation().state)}</pre>;
}

function renderLink(path: string, props: Parameters<typeof ChatEntryLink>[0] = {}, chosen = true) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <ExtensionsContext.Provider value={[fakeExtension(1, ['chat'])]}>
                <ChatProviderContext.Provider value={chosen ? { extension: 'ext-1', contribution: 'chat' } : undefined}>
                    <ExtensionResourceContext.Provider value={resource}>
                        <Routes>
                            <Route path="/chat" element={<State />} />
                            <Route path="*" element={<ChatEntryLink {...props} />} />
                        </Routes>
                    </ExtensionResourceContext.Provider>
                </ChatProviderContext.Provider>
            </ExtensionsContext.Provider>
        </MemoryRouter>
    );
}

describe('ChatEntryLink', () => {
    it('is labelled with the title of the chat entry, with no prefix', () => {
        renderLink('/');
        expect(screen.getByRole('link', { name: 'chat 1' })).toHaveAttribute('href', '/chat');
    });

    it('keeps the title as the accessible name when it shows only the icon', () => {
        renderLink('/', { compact: true });
        expect(screen.getByRole('link', { name: 'chat 1' })).not.toHaveTextContent('chat 1');
    });

    it('shows nothing when the operator chose no chat', () => {
        renderLink('/', {}, false);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('offers the resource of the page and the node that the URL names', async () => {
        renderLink('/finos/architectures/7/1.0.0?node=payments-api');
        await userEvent.setup().click(screen.getByRole('link'));
        expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
            chatContext: { namespace: 'finos', resourceType: 'architectures', resourceId: '7', version: '1.0.0', selectedElement: 'payments-api' },
        });
    });
});

describe('chatContextOf', () => {
    it('offers only an architecture or a pattern with all its parts', () => {
        expect(chatContextOf({ ...resource, resourceType: 'flows' })).toBeUndefined();
        expect(chatContextOf({ ...resource, version: undefined })).toBeUndefined();
        expect(chatContextOf(null)).toBeUndefined();
        expect(chatContextOf({ ...resource, selectedElement: 'ledger' })).toEqual({
            namespace: 'finos', resourceType: 'architectures', resourceId: '7', version: '1.0.0', selectedElement: 'ledger',
        });
    });
});
