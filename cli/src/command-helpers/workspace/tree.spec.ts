import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderGraphAsTree, printBundleTreeFromGraph } from './tree';
import type { DependencyGraph } from './bundle';

describe('tree', () => {
    const bundlePath = '/test/bundle';

    describe('renderGraphAsTree', () => {
        it('should render empty string for empty graph', () => {
            const graph: DependencyGraph = {
                nodes: [],
                edges: {},
                idToPath: {}
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toBe('');
        });

        it('should render single node', () => {
            const graph: DependencyGraph = {
                nodes: ['doc1'],
                edges: { 'doc1': [] },
                idToPath: { 'doc1': '/test/bundle/doc1.json' }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('doc1');
            expect(result).toContain('./doc1.json');
        });

        it('should render parent-child relationship', () => {
            const graph: DependencyGraph = {
                nodes: ['parent', 'child'],
                edges: {
                    'parent': ['child'],
                    'child': []
                },
                idToPath: {
                    'parent': '/test/bundle/parent.json',
                    'child': '/test/bundle/child.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('parent');
            expect(result).toContain('child');
        });

        it('should show (pulled) for files in files directory', () => {
            const graph: DependencyGraph = {
                nodes: ['doc1'],
                edges: { 'doc1': [] },
                idToPath: { 'doc1': '/test/bundle/files/doc1.json' }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('pulled');
            expect(result).not.toContain('files/doc1.json');
        });

        it('should detect and mark cycles', () => {
            const graph: DependencyGraph = {
                nodes: ['a', 'b'],
                edges: {
                    'a': ['b'],
                    'b': ['a']
                },
                idToPath: {
                    'a': '/test/bundle/a.json',
                    'b': '/test/bundle/b.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('(cycle)');
        });

        it('should identify root nodes (no incoming edges)', () => {
            const graph: DependencyGraph = {
                nodes: ['root', 'middle', 'leaf'],
                edges: {
                    'root': ['middle'],
                    'middle': ['leaf'],
                    'leaf': []
                },
                idToPath: {
                    'root': '/test/bundle/root.json',
                    'middle': '/test/bundle/middle.json',
                    'leaf': '/test/bundle/leaf.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            // root should appear at the top level
            const lines = result.split('\n');
            const rootLine = lines.find(l => l.includes('root'));
            expect(rootLine).toBeDefined();
            // Root should not be indented (appears at start of tree)
        });

        it('should handle multiple root nodes', () => {
            const graph: DependencyGraph = {
                nodes: ['root1', 'root2', 'shared'],
                edges: {
                    'root1': ['shared'],
                    'root2': ['shared'],
                    'shared': []
                },
                idToPath: {
                    'root1': '/test/bundle/root1.json',
                    'root2': '/test/bundle/root2.json',
                    'shared': '/test/bundle/shared.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('root1');
            expect(result).toContain('root2');
        });

        it('should handle deep nesting', () => {
            const graph: DependencyGraph = {
                nodes: ['a', 'b', 'c', 'd'],
                edges: {
                    'a': ['b'],
                    'b': ['c'],
                    'c': ['d'],
                    'd': []
                },
                idToPath: {
                    'a': '/test/bundle/a.json',
                    'b': '/test/bundle/b.json',
                    'c': '/test/bundle/c.json',
                    'd': '/test/bundle/d.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('a');
            expect(result).toContain('b');
            expect(result).toContain('c');
            expect(result).toContain('d');
        });

        it('should handle node with multiple children', () => {
            const graph: DependencyGraph = {
                nodes: ['parent', 'child1', 'child2', 'child3'],
                edges: {
                    'parent': ['child1', 'child2', 'child3'],
                    'child1': [],
                    'child2': [],
                    'child3': []
                },
                idToPath: {
                    'parent': '/test/bundle/parent.json',
                    'child1': '/test/bundle/child1.json',
                    'child2': '/test/bundle/child2.json',
                    'child3': '/test/bundle/child3.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            expect(result).toContain('child1');
            expect(result).toContain('child2');
            expect(result).toContain('child3');
        });

        it('should use all nodes as roots when no clear roots exist (all have incoming)', () => {
            // This is a cycle where everyone points to everyone
            const graph: DependencyGraph = {
                nodes: ['a', 'b'],
                edges: {
                    'a': ['b'],
                    'b': ['a']
                },
                idToPath: {
                    'a': '/test/bundle/a.json',
                    'b': '/test/bundle/b.json'
                }
            };

            const result = renderGraphAsTree(graph, bundlePath);
            // Both should appear since there are no true roots
            expect(result).toContain('a');
            expect(result).toContain('b');
        });
    });

    describe('printBundleTreeFromGraph', () => {
        let consoleSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should print tree to console', () => {
            const graph: DependencyGraph = {
                nodes: ['doc1'],
                edges: { 'doc1': [] },
                idToPath: { 'doc1': '/test/bundle/doc1.json' }
            };

            printBundleTreeFromGraph(graph, bundlePath);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            const output = consoleSpy.mock.calls[0][0];
            expect(output).toContain('doc1');
        });

        it('should call renderGraphAsTree internally', () => {
            const graph: DependencyGraph = {
                nodes: ['a', 'b'],
                edges: {
                    'a': ['b'],
                    'b': []
                },
                idToPath: {
                    'a': '/test/bundle/a.json',
                    'b': '/test/bundle/files/b.json'
                }
            };

            printBundleTreeFromGraph(graph, bundlePath);

            const output = consoleSpy.mock.calls[0][0];
            // Verify it uses the same rendering logic
            expect(output).toContain('a');
            expect(output).toContain('pulled'); // b is in files directory
        });
    });
});
