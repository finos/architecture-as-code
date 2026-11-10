import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Node } from 'reactflow';
import { ExportButton } from './ExportButton.js';
import { exportDiagram } from './utils/diagramExport.js';

const flow = document.createElement('div');
flow.style.backgroundColor = 'rgb(1, 2, 3)';
const viewport = document.createElement('div');
viewport.className = 'react-flow__viewport';
viewport.innerHTML = '<div class="react-flow__edgelabel-renderer"><div></div></div>';
flow.appendChild(viewport);
vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 0, height: 0 } as DOMRect);
vi.spyOn(viewport.querySelector('.react-flow__edgelabel-renderer > *')!, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, top: -60, width: 220, height: 40 } as DOMRect);

const nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, positionAbsolute: { x: 0, y: 0 }, width: 100, height: 50, data: {} }];

vi.mock('reactflow', async (importOriginal) => ({
    ...(await importOriginal<typeof import('reactflow')>()),
    useReactFlow: () => ({ getNodes: () => nodes }),
    useStore: (selector: (state: { domNode: HTMLElement; transform: [number, number, number] }) => unknown) =>
        selector({ domNode: flow, transform: [0, 0, 1] }),
}));

vi.mock('./utils/diagramExport.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./utils/diagramExport.js')>()),
    exportDiagram: vi.fn(async () => {}),
}));

function renderButton() {
    render(<ExportButton diagramKey="finos/Architectures/7" />);
}

describe('ExportButton', () => {
    afterEach(() => vi.mocked(exportDiagram).mockClear());

    it('offers SVG and PNG once opened', () => {
        renderButton();
        const button = screen.getByRole('button', { name: 'Export image' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('menuitem', { name: 'SVG' })).toBeNull();

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menuitem', { name: 'SVG' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'PNG' })).toBeInTheDocument();
    });

    it('exports the whole diagram, edge labels and callouts included, on the diagram background, and closes the menu', async () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Export image' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }));

        await waitFor(() => expect(exportDiagram).toHaveBeenCalledWith(
            viewport,
            { x: 0, y: -60, width: 220, height: 110 },
            'png',
            'finos-Architectures-7.png',
            'rgb(1, 2, 3)',
        ));
        expect(screen.queryByRole('menuitem', { name: 'PNG' })).toBeNull();
    });

    it('closes the menu on Escape', () => {
        renderButton();
        const button = screen.getByRole('button', { name: 'Export image' });
        fireEvent.click(button);
        // A click leaves the focus on the button, not in the menu.
        fireEvent.keyDown(button, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('logs a failed export and does not throw', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(exportDiagram).mockRejectedValueOnce(new Error('canvas'));
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Export image' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'SVG' }));
        await waitFor(() => expect(error).toHaveBeenCalled());
        error.mockRestore();
    });
});
