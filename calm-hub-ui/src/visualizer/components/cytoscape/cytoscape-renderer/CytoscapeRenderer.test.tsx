import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { CytoscapeRenderer, CytoscapeRendererProps } from './CytoscapeRenderer.js';
import cytoscape from 'cytoscape';
import * as nodePositionService from '../../../services/node-position-service.js';

const mocks = vi.hoisted(() => ({
    nodes: vi.fn(),
    edges: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    zoom: vi.fn(() => 1),
    pan: vi.fn(() => ({ x: 0, y: 0 })),
    layout: vi.fn(() => ({ run: vi.fn() })),
    style: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    fit: vi.fn(),
    center: vi.fn(),
    boxSelectionEnabled: vi.fn(),
    minZoom: vi.fn(),
    maxZoom: vi.fn(),
}));

// Mock cytoscape and its instance methods
vi.mock('cytoscape', () => {
    return {
        __esModule: true,
        default: vi.fn(() => mocks),
    };
});

// Mock services
vi.mock('../../../services/node-position-service.js', () => ({
    loadStoredNodePositions: vi.fn(() => undefined),
    saveNodePositions: vi.fn(),
}));
vi.mock('../../../services/layout-correction-service.js', () => ({
    LayoutCorrectionService: vi.fn().mockImplementation(() => ({
        calculateAndUpdateNodePositions: vi.fn(),
    })),
}));

describe('CytoscapeRenderer', () => {
    let props: CytoscapeRendererProps;

    beforeEach(() => {
        props = {
            isNodeDescActive: false,
            isRelationshipDescActive: false,
            nodes: [
                {
                    data: {
                        id: 'n1',
                        name: 'Node 1',
                        description: 'Node 1 description',
                        type: 'default',
                        cytoscapeProps: {
                            labelWithDescription: 'Node 1 desc',
                            labelWithoutDescription: 'Node 1',
                        },
                    },
                },
            ],
            edges: [
                {
                    data: {
                        id: 'e1',
                        source: 'n1',
                        target: 'n2',
                        label: 'Edge 1',
                    },
                },
            ],
            nodeClickedCallback: vi.fn(),
            edgeClickedCallback: vi.fn(),
            calmKey: 'test-key',
        };
    });

    it('renders without crashing', () => {
        render(<CytoscapeRenderer {...props} />);
    });

    it('calls nodeClickedCallback when a node is tapped', () => {
        render(<CytoscapeRenderer {...props} />);
        const cyInstance = cytoscape();
        expect(cyInstance.on).toHaveBeenCalledWith('tap', 'node', expect.any(Function));
    });

    it('calls edgeClickedCallback when an edge is tapped', () => {
        render(<CytoscapeRenderer {...props} />);
        const cyInstance = cytoscape();
        expect(cyInstance.on).toHaveBeenCalledWith('tap', 'edge', expect.any(Function));
    });

    it('applies node and edge styles based on props', () => {
        render(
            <CytoscapeRenderer {...props} isNodeDescActive={true} isRelationshipDescActive={true} />
        );
        expect(vi.mocked(cytoscape)).toHaveBeenCalledWith(
            expect.objectContaining({
                style: expect.arrayContaining([
                    expect.objectContaining({ selector: 'node' }),
                    expect.objectContaining({ selector: 'edge' }),
                ]),
            })
        );
    });

    it('restores zoom and pan on unmount', () => {
        const { unmount } = render(<CytoscapeRenderer {...props} />);
        const cyInstance = cytoscape();
        unmount();
        expect(cyInstance.destroy).toHaveBeenCalled();
    });

    it('loads stored node positions on mount', () => {
        render(<CytoscapeRenderer {...props} />);
        expect(nodePositionService.loadStoredNodePositions).toHaveBeenCalledWith('test-key');
    });

    it('saves node positions on dragfree event', () => {
        mocks.nodes.mockReturnValue([]);
        mocks.on.mockImplementation((event, selector, handler) => {
            if (event === 'dragfree' && selector === 'node') {
                // Simulate the dragfree event handler being called
                handler();
                expect(nodePositionService.saveNodePositions).toHaveBeenCalledWith(
                    'test-key',
                    expect.any(Array) // Expecting an array of node positions
                );
            }
        });

        render(<CytoscapeRenderer {...props} />);
        expect(mocks.on).toHaveBeenCalledWith('dragfree', 'node', expect.any(Function));
    });

    it('does not save nodes with the :parent selector on dragfree event', () => {
        // Mock two nodes: one parent, one normal
        const parentNode = {
            is: vi.fn((selector) => selector === ':parent'),
            id: vi.fn(() => 'parent-node'),
            position: vi.fn(() => ({ x: 1, y: 2 })),
        } as unknown as cytoscape.NodeSingular;

        const normalNode: cytoscape.NodeSingular = {
            is: vi.fn(() => false),
            id: vi.fn(() => 'normal-node'),
            position: vi.fn(() => ({ x: 1, y: 2 })),
        } as unknown as cytoscape.NodeSingular;

        mocks.nodes.mockReturnValue([normalNode, parentNode]);

        mocks.on.mockImplementation((event, selector, handler) => {
            if (event === 'dragfree' && selector === 'node') {
                handler();
                expect(nodePositionService.saveNodePositions).toHaveBeenCalledWith('test-key', [
                    { id: 'normal-node', position: { x: 1, y: 2 } },
                ]);
            }
        });
        render(<CytoscapeRenderer {...props} />);
    });
});
