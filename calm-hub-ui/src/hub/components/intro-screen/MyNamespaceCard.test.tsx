import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MyNamespaceCard } from './MyNamespaceCard.js';
import { PersonalNamespaceControl } from '../../hooks/usePersonalNamespace.js';
import { PersonalNamespaceState } from '../../../model/personal-namespace.js';

function control(state: PersonalNamespaceState, overrides: Partial<PersonalNamespaceControl> = {}): PersonalNamespaceControl {
    return { state, creating: false, createFailed: false, create: vi.fn().mockResolvedValue(true), ...overrides };
}

function renderCard(pn: PersonalNamespaceControl) {
    return render(
        <MemoryRouter>
            <MyNamespaceCard personalNamespace={pn} />
        </MemoryRouter>
    );
}

function mockViewport(isMobile: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
        matches: isMobile,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    return () => {
        window.matchMedia = original;
    };
}

describe('MyNamespaceCard', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each<PersonalNamespaceState>([{ status: 'loading' }, { status: 'unavailable' }])('renders nothing for %o', (state) => {
        const { container } = renderCard(control(state));
        expect(container).toBeEmptyDOMElement();
    });

    it('offers to create an available namespace', () => {
        const pn = control({ status: 'available', name: 'users.alice' });
        renderCard(pn);

        expect(screen.getByTestId('my-namespace-name')).toHaveTextContent('users.alice');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(pn.create).toHaveBeenCalledOnce();
    });

    it('disables the button while creating', () => {
        renderCard(control({ status: 'available', name: 'users.alice' }, { creating: true }));

        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    });

    it('shows an error after a failed create', () => {
        renderCard(control({ status: 'available', name: 'users.alice' }, { createFailed: true }));

        expect(screen.getByRole('alert')).toHaveTextContent('Could not create the namespace');
    });

    it('links to an owned namespace and copies its name', async () => {
        vi.useFakeTimers();
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        renderCard(control({ status: 'owned', name: 'users.alice' }));

        expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/namespace/users.alice');
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy name' }));
        });
        expect(writeText).toHaveBeenCalledWith('users.alice');
        expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(screen.getByRole('button', { name: 'Copy name' })).toBeInTheDocument();
    });

    it('explains a taken namespace', () => {
        renderCard(control({ status: 'taken', name: 'users.alice' }));

        expect(screen.getByText(/Another user holds this name/)).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('explains an unsupported user name', () => {
        renderCard(control({ status: 'unsupported' }));

        expect(screen.getByText(/cannot be used for a personal namespace/)).toBeInTheDocument();
        expect(screen.queryByTestId('my-namespace-name')).not.toBeInTheDocument();
    });

    it.each([false, true])('renders the same content at mobile=%s', (isMobile) => {
        const restore = mockViewport(isMobile);
        try {
            renderCard(control({ status: 'owned', name: 'users.alice' }));
            expect(screen.getByTestId('my-namespace-card')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
        } finally {
            restore();
        }
    });
});
