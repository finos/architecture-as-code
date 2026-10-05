import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState, type ReactNode } from 'react';
import type { Node } from 'reactflow';
import { PatternGraph } from './PatternGraph';
import { saveNodePositions, clearStoredNodePositions } from '../../services/node-position-service.js';

/**
 * Capture the props ReactFlow is rendered with. Mirrors ArchitectureGraph.test.tsx's
 * mock: keep the real reactflow hooks (useNodesState/useEdgesState) so the graph's
 * node state populates as it does in production, and stub only the heavy,
 * DOM-measuring view components. PatternGraph renders two <Panel>s (decision
 * selector + search bar), so Panel must be stubbed too.
 */
const reactFlowProps: { current: Record<string, unknown> | null } = { current: null };
let reactFlowMountCount = 0;

function MockReactFlow(props: Record<string, unknown>) {
    reactFlowProps.current = props;
    const [instanceId] = useState(() => ++reactFlowMountCount);
    return (
        <div data-testid="react-flow" data-instance={instanceId}>
            {props.children as ReactNode}
        </div>
    );
}

vi.mock('reactflow', async () => {
    const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: MockReactFlow,
        Background: () => <div data-testid="rf-background" />,
        Controls: ({ children }: { children?: ReactNode }) => (
            <div data-testid="rf-controls">{children}</div>
        ),
        MiniMap: () => <div data-testid="diagram-minimap" />,
        Panel: ({ children }: { children?: ReactNode }) => (
            <div data-testid="rf-panel">{children}</div>
        ),
    };
});

// Helpers mirroring patternTransformer.test.ts — node ids come straight from
// `unique-id`, unlike Drawer.test.tsx's fixture (empty prefixItems, which would
// render EmptyGraphState and make a precedence assertion vacuous).
function schemaNode(uniqueId: string, name: string, nodeType: string) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            name: { const: name },
            'node-type': { const: nodeType },
        },
    };
}

function makePattern(nodes: unknown[]) {
    return {
        properties: {
            nodes: { prefixItems: nodes },
            relationships: { prefixItems: [] },
        },
    };
}

const mockPatternData = makePattern([
    schemaNode('node-1', 'Service A', 'service'),
    schemaNode('node-2', 'Database B', 'database'),
]);

describe('PatternGraph', () => {
    beforeEach(() => {
        reactFlowProps.current = null;
        reactFlowMountCount = 0;
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    describe('default layout precedence', () => {
        const key = 'ns/id';

        function nodePosition(id: string) {
            const nodes = reactFlowProps.current?.nodes as Node[] | undefined;
            return nodes?.find((n) => n.id === id)?.position;
        }

        it('applies local scratch over the default layout when both exist', () => {
            saveNodePositions(key, [{ id: 'node-1', position: { x: 111, y: 222 }, data: {} }] as Node[]);

            render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 999, y: 999 } }]}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 111, y: 222 });
        });

        it('applies the server default when no local scratch is stored', () => {
            render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('falls back to the auto-layout when neither scratch nor a server default exist', () => {
            render(<PatternGraph patternData={mockPatternData} viewportKey={key} defaultLayout={null} />);

            // No loading gate, no forced position — the graph renders with its own layout.
            expect(screen.getByTestId('react-flow')).toBeInTheDocument();
            expect(nodePosition('node-1')).toBeDefined();
        });

        it('shows a loading placeholder and withholds the graph while the server default is still loading', () => {
            render(<PatternGraph patternData={mockPatternData} viewportKey={key} defaultLayout={undefined} />);

            expect(screen.getByText('Loading saved layout…')).toBeInTheDocument();
            expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
        });

        it('does not gate on a missing viewportKey (e.g. a dropped file) even with defaultLayout undefined', () => {
            render(<PatternGraph patternData={mockPatternData} defaultLayout={undefined} />);

            expect(screen.getByTestId('react-flow')).toBeInTheDocument();
        });

        it('falls back to scratch when no default layout is provided, then applies default on epoch bump after scratch is cleared', () => {
            saveNodePositions(key, [{ id: 'node-1', position: { x: 111, y: 222 }, data: {} }] as Node[]);

            const { rerender } = render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={null}
                    layoutEpoch={0}
                />
            );
            expect(nodePosition('node-1')).toEqual({ x: 111, y: 222 });

            // Simulate save/reset: scratch is cleared before the epoch bumps.
            clearStoredNodePositions(key);
            rerender(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                    layoutEpoch={1}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('does not remount ReactFlow on a layoutEpoch bump, so the current viewport survives a save/reset', () => {
            const { rerender } = render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 5, y: 6 } }]}
                    layoutEpoch={0}
                />
            );
            const instanceBefore = screen.getByTestId('react-flow').getAttribute('data-instance');

            rerender(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                    layoutEpoch={1}
                />
            );

            expect(screen.getByTestId('react-flow').getAttribute('data-instance')).toBe(instanceBefore);
            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('reports applied positions upward via onPositionsChange', () => {
            const onPositionsChange = vi.fn();
            render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 5, y: 6 } }]}
                    onPositionsChange={onPositionsChange}
                />
            );

            expect(onPositionsChange).toHaveBeenCalled();
            const reported = onPositionsChange.mock.calls.at(-1)?.[0];
            expect(reported.find((p: { id: string }) => p.id === 'node-1')?.position).toEqual({ x: 5, y: 6 });
        });

        it('does not re-run the parse effect when onPositionsChange gets a new identity', () => {
            const stableDefaultLayout = [{ id: 'node-1', position: { x: 5, y: 6 } }];

            const firstCallback = vi.fn();
            const { rerender } = render(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={firstCallback}
                />
            );
            expect(firstCallback).toHaveBeenCalledTimes(1);

            // Same props except a brand-new function identity, as a naive inline
            // arrow at a call site would produce. The parse effect must not treat
            // this as a real dependency change.
            const secondCallback = vi.fn();
            rerender(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={secondCallback}
                />
            );

            expect(firstCallback).toHaveBeenCalledTimes(1);
            expect(secondCallback).not.toHaveBeenCalled();

            // The next genuine re-apply (layoutEpoch bump) reports through the
            // *current* callback, proving the ref is kept up to date.
            rerender(
                <PatternGraph
                    patternData={mockPatternData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={secondCallback}
                    layoutEpoch={1}
                />
            );
            expect(secondCallback).toHaveBeenCalledTimes(1);
            expect(firstCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('patterns with nothing to draw', () => {
        const rulesOnlyPattern = {
            description: 'Every node is governed.',
            properties: {
                nodes: { items: { $ref: 'https://hub.calm.finos.org/calm/namespaces/ns/standards/governed-node/versions/1.0.0' } },
                relationships: { items: { $ref: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship' } },
                controls: { required: ['code-review'] },
            },
        };

        it('explains the rules of a pattern that has no fixed nodes', () => {
            render(<PatternGraph patternData={rulesOnlyPattern} />);

            expect(screen.getByTestId('pattern-rules-state')).toHaveTextContent('Every node is governed.');
            expect(screen.getByText('code-review')).toBeInTheDocument();
            expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
        });

        it('does not wait for a saved layout when there is nothing to lay out', () => {
            render(<PatternGraph patternData={rulesOnlyPattern} viewportKey="ns/id" defaultLayout={undefined} />);

            expect(screen.getByTestId('pattern-rules-state')).toBeInTheDocument();
            expect(screen.queryByText('Loading saved layout…')).not.toBeInTheDocument();
        });

        it('says so when a pattern has neither nodes nor rules', () => {
            render(<PatternGraph patternData={makePattern([])} />);

            expect(screen.getByText('This pattern defines no nodes or relationships to draw.')).toBeInTheDocument();
            expect(screen.queryByTestId('pattern-rules-state')).not.toBeInTheDocument();
        });

        it('reports a pattern that cannot be parsed, even if it has rules', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            const brokenPattern = {
                ...rulesOnlyPattern,
                properties: { ...rulesOnlyPattern.properties, nodes: { prefixItems: 'not-an-array' } },
            };

            render(<PatternGraph patternData={brokenPattern} />);

            expect(screen.getByText('This pattern could not be drawn. See the JSON view for its schema.')).toBeInTheDocument();
            expect(screen.queryByTestId('pattern-rules-state')).not.toBeInTheDocument();
            consoleError.mockRestore();
        });

        it('does not show an empty state on the first render of a pattern that has nodes', () => {
            // Effects do not run in renderToString, so this is the frame before node state is filled.
            const html = renderToString(<PatternGraph patternData={mockPatternData} />);

            expect(html).toContain('data-testid="react-flow"');
            expect(html).not.toContain('could not be drawn');
            expect(html).not.toContain('defines no nodes');
        });
    });
});
