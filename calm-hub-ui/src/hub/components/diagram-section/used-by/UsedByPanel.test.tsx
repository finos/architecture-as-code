import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { UsedByPanel } from './UsedByPanel.js';
import type { ImplementationsState } from './usePatternImplementations.js';
import type { PatternImplementation } from '../../../../model/pattern-implementation.js';

const rows: PatternImplementation[] = [
    { namespace: 'finos', architectureId: 7, version: '1.0.0', customId: 'trade-capture' },
    { namespace: 'finos', architectureId: 7, version: '1.2.0', customId: 'trade-capture' },
    { namespace: 'finos', architectureId: 8, version: '2.0.0', customId: 'settlement' },
    { namespace: 'traderx', architectureId: 3, version: '1.0.0' },
];

function renderList(implementations: PatternImplementation[] = rows) {
    render(<UsedByPanel state={{ status: 'loaded', implementations }} />);
}

const architectureNames = () =>
    within(screen.getByRole('list'))
        .queryAllByRole('listitem')
        .map((item) => item.querySelector('a')?.textContent);

describe('UsedByPanel', () => {
    it('shows each architecture once, linked to its latest version, with a link to each version', () => {
        renderList();

        const link = screen.getByRole('link', { name: 'trade-capture' });
        expect(link).toHaveAttribute('href', '#/finos/architectures/trade-capture/1.2.0');
        expect(link).toHaveAttribute('target', '_blank');
        const versions = within(link.closest('li')!).getAllByRole('link').slice(1);
        expect(versions.map((v) => [v.textContent, v.getAttribute('href')])).toEqual([
            ['1.0.0', '#/finos/architectures/trade-capture/1.0.0'],
            ['1.2.0', '#/finos/architectures/trade-capture/1.2.0'],
        ]);
        expect(architectureNames()).toEqual(['Architecture 3', 'settlement', 'trade-capture']);
    });

    it('links an architecture that has no name by its numeric id', () => {
        renderList();

        expect(screen.getByRole('link', { name: 'Architecture 3' })).toHaveAttribute('href', '#/traderx/architectures/3/1.0.0');
    });

    it('counts architectures and namespaces, in the singular for one', () => {
        renderList();
        expect(screen.getByText('3 architectures in 2 namespaces')).toBeInTheDocument();
    });

    it('says one architecture in one namespace', () => {
        renderList([rows[0]]);
        expect(screen.getByText('1 architecture in 1 namespace')).toBeInTheDocument();
    });

    it('shows only the architectures in the namespace picked on the left', async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(screen.getByRole('button', { name: /^traderx/ }));

        expect(screen.getByRole('button', { name: /^traderx/ })).toHaveAttribute('aria-pressed', 'true');
        expect(architectureNames()).toEqual(['Architecture 3']);
    });

    it('shows only the architectures in the namespace picked from the select', async () => {
        const user = userEvent.setup();
        renderList();

        await user.selectOptions(screen.getByRole('combobox', { name: 'Show architectures in namespace' }), 'finos');

        expect(architectureNames()).toEqual(['settlement', 'trade-capture']);
    });

    it('filters by name or namespace, and says when nothing matches', async () => {
        const user = userEvent.setup();
        renderList();

        await user.type(screen.getByRole('searchbox', { name: 'Filter architectures' }), 'TRADE');
        expect(architectureNames()).toEqual(['Architecture 3', 'trade-capture']);

        await user.clear(screen.getByRole('searchbox', { name: 'Filter architectures' }));
        await user.type(screen.getByRole('searchbox', { name: 'Filter architectures' }), 'nothing');
        expect(screen.getByText('No architectures match the filter.')).toBeInTheDocument();
    });

    it('explains when no architecture uses the version', () => {
        renderList([]);

        expect(screen.getByText(/No architectures use this version/)).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it.each<[ImplementationsState, string]>([
        [{ status: 'idle' }, 'Loading…'],
        [{ status: 'loading' }, 'Loading…'],
        [{ status: 'error' }, 'Could not load the architectures that use this version.'],
        [{ status: 'unavailable' }, 'Not available for this pattern.'],
    ])('shows a message for the %o state', (state, text) => {
        render(<UsedByPanel state={state} />);

        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
