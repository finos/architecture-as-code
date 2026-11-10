import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Node } from 'reactflow';
import { ExportButton } from './ExportButton.js';
import { DecisionOverlayContext } from '../../context/DecisionOverlayContext.js';
import { exportDiagram } from './utils/diagramExport.js';

const flow = document.createElement('div');
flow.style.backgroundColor = 'rgb(1, 2, 3)';
const viewport = document.createElement('div');
viewport.className = 'react-flow__viewport';
flow.appendChild(viewport);

const nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, positionAbsolute: { x: 0, y: 0 }, width: 100, height: 50, data: {} }];

vi.mock('reactflow', async (importOriginal) => ({
    ...(await importOriginal<typeof import('reactflow')>()),
    useReactFlow: () => ({ getNodes: () => nodes }),
    useStore: (selector: (state: { domNode: HTMLElement }) => unknown) => selector({ domNode: flow }),
}));

vi.mock('./utils/diagramExport.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./utils/diagramExport.js')>()),
    exportDiagram: vi.fn(async () => {}),
}));

function renderButton(calloutSizes = new Map()) {
    render(
        <DecisionOverlayContext.Provider value={{ showDecisions: true, subjectLabels: new Map(), calloutSizes, reportCalloutSize: () => {} }}>
            <ExportButton diagramKey="finos/Architectures/7" />
        </DecisionOverlayContext.Provider>
    );
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

    it('exports the whole diagram, callouts included, on the diagram background, and closes the menu', async () => {
        renderButton(new Map([['a', { width: 220, height: 90 }]]));
        fireEvent.click(screen.getByRole('button', { name: 'Export image' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }));

        await waitFor(() => expect(exportDiagram).toHaveBeenCalledWith(
            viewport,
            { x: 0, y: 0, width: 220, height: 140 },
            'png',
            'finos-Architectures-7.png',
            'rgb(1, 2, 3)',
        ));
        expect(screen.queryByRole('menuitem', { name: 'PNG' })).toBeNull();
    });

    it('closes the menu on Escape', () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Export image' }));
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
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
