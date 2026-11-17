import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Node } from '@xyflow/react';
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

let zoom = 1;

const nodes = [{ id: 'a', position: { x: 0, y: 0 }, internals: { positionAbsolute: { x: 0, y: 0 } }, measured: { width: 100, height: 50 }, data: {} }] as unknown as Node[];

vi.mock('@xyflow/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@xyflow/react')>()),
    useReactFlow: () => ({ getNodes: () => nodes, getZoom: () => zoom, getInternalNode: (id: string) => nodes.find((n) => n.id === id) }),
    useStore: (selector: (state: { domNode: HTMLElement }) => unknown) => selector({ domNode: flow }),
}));

vi.mock('./utils/diagramExport.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./utils/diagramExport.js')>()),
    exportDiagram: vi.fn(async () => {}),
}));

function renderButton() {
    render(<ExportButton diagramKey="finos/Architectures/7" />);
}

describe('ExportButton', () => {
    afterEach(() => {
        vi.mocked(exportDiagram).mockClear();
        zoom = 1;
    });

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

    it('exports the whole diagram, edge labels and callouts measured at the zoom on click, on the diagram background, and closes the menu', async () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Export image' }));
        // A zoom does not render the button again.
        zoom = 2;
        fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }));

        await waitFor(() => expect(exportDiagram).toHaveBeenCalledWith(
            viewport,
            { x: 0, y: -30, width: 110, height: 80 },
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
