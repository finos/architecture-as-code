import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IoCodeOutline, IoEyeOutline } from 'react-icons/io5';
import { describe, expect, it, vi } from 'vitest';
import { LensMenu } from './LensMenu.js';
import type { DiagramLens } from './diagramTabRegistry.js';

const lens = (id: string, label: string, extension?: DiagramLens['extension']): DiagramLens => ({
    id,
    label,
    icon: extension ? IoCodeOutline : IoEyeOutline,
    extension,
    render: () => null,
});

// Registry order mixes the two kinds, so the test shows that the menu groups them.
const LENSES = [
    lens('calm', 'CALM'),
    lens('blast-radius', 'Blast radius', { id: 'acme-risk', name: 'Acme Risk' }),
    lens('json', 'JSON'),
    lens('lineage', 'Data lineage', { id: 'datagov', name: 'DataGov' }),
];

function renderMenu(lenses: readonly DiagramLens[] = LENSES, onSelect = vi.fn()) {
    render(<LensMenu lenses={lenses} activeLensId="calm" labelOf={(l) => l.label as string} onSelect={onSelect} buttonClassName="" />);
    return onSelect;
}

const names = (list: HTMLElement) => within(list).getAllByRole('button').map((button) => button.textContent);

describe('LensMenu', () => {
    it('lists the lenses of Hub first, then the extension lenses under their own heading', async () => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(screen.getByRole('button', { name: 'Choose a lens' }));

        expect(names(screen.getByRole('list', { name: 'Lenses' }))).toEqual(['CALM', 'JSON']);
        expect(names(screen.getByRole('list', { name: 'Extensions' }))).toEqual(['Blast radiusAcme Risk', 'Data lineageDataGov']);
    });

    it('shows no Extensions heading when no extension gives a lens', async () => {
        const user = userEvent.setup();
        renderMenu(LENSES.filter((l) => !l.extension));

        await user.click(screen.getByRole('button', { name: 'Choose a lens' }));

        expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
    });

    it('filters by extension name, and opens the first match on Enter', async () => {
        const user = userEvent.setup();
        const onSelect = renderMenu();

        await user.click(screen.getByRole('button', { name: 'Choose a lens' }));
        await user.type(screen.getByRole('searchbox', { name: 'Filter lenses' }), 'datagov');

        expect(screen.queryByRole('list', { name: 'Lenses' })).not.toBeInTheDocument();
        expect(names(screen.getByRole('list', { name: 'Extensions' }))).toEqual(['Data lineageDataGov']);

        await user.keyboard('{Enter}');
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'lineage' }));
    });
});
