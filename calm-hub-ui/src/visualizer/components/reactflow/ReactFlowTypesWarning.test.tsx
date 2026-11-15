import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = { custom: () => <div>custom-node</div> };
const edgeTypes = { custom: () => <div>custom-edge</div> };

function isError002(args: unknown[]): boolean {
    return args.some((arg) => {
        const text = String(arg);
        return text.includes('002') || text.includes('nodeTypes or edgeTypes');
    });
}

describe('React Flow nodeTypes / edgeTypes warning', () => {
    const warnings: unknown[][] = [];

    beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
        warnings.length = 0;
        vi.spyOn(console, 'warn').mockImplementation((...args) => {
            warnings.push(args);
        });
        vi.spyOn(console, 'error').mockImplementation((...args) => {
            warnings.push(args);
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('does not report error 002 when nodeTypes and edgeTypes are module constants, including under StrictMode', () => {
        render(
            <StrictMode>
                <div style={{ width: 200, height: 200 }}>
                    <ReactFlow
                        nodes={[{ id: 'a', position: { x: 0, y: 0 }, data: {}, type: 'custom' }]}
                        edges={[{ id: 'e1', source: 'a', target: 'a', type: 'custom' }]}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                    />
                </div>
            </StrictMode>,
        );

        expect(warnings.filter(isError002)).toEqual([]);
    });

    it('still reports error 002 when a node type component actually changes', () => {
        const First = () => <div>first</div>;
        const Second = () => <div>second</div>;
        const { rerender } = render(
            <div style={{ width: 200, height: 200 }}>
                <ReactFlow
                    nodes={[{ id: 'a', position: { x: 0, y: 0 }, data: {}, type: 'custom' }]}
                    edges={[]}
                    nodeTypes={{ custom: First }}
                />
            </div>,
        );
        warnings.length = 0;
        rerender(
            <div style={{ width: 200, height: 200 }}>
                <ReactFlow
                    nodes={[{ id: 'a', position: { x: 0, y: 0 }, data: {}, type: 'custom' }]}
                    edges={[]}
                    nodeTypes={{ custom: Second }}
                />
            </div>,
        );
        expect(warnings.some(isError002)).toBe(true);
    });
});
