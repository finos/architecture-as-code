import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { renderGraphAsTree, printBundleTreeFromGraph, buildDependencyGraph, printBundleTree, type DependencyGraph } from './tree';
import { saveManifest } from './bundle';

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

describe('dependency graph', () => {
    const testDir = path.join(__dirname, 'test-tree');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        if (existsSync(bundlePath)) {
            await rm(bundlePath, { recursive: true, force: true });
        }
        await mkdir(bundlePath, { recursive: true });
    });

    describe('buildDependencyGraph', () => {
        beforeEach(async () => {
            await mkdir(filesPath, { recursive: true });
        });

        it('should return empty graph for empty manifest', async () => {
            const graph = await buildDependencyGraph(bundlePath);
            expect(graph.nodes).toEqual([]);
            expect(graph.edges).toEqual({});
            expect(graph.idToPath).toEqual({});
        });

        it('should build graph with nodes from manifest', async () => {
            await writeFile(path.join(filesPath, 'doc1.json'), JSON.stringify({ '$id': 'doc1' }));
            await writeFile(path.join(filesPath, 'doc2.json'), JSON.stringify({ '$id': 'doc2' }));
            await saveManifest(bundlePath, {
                'doc1': { path: 'files/doc1.json', type: 'unknown' },
                'doc2': { path: 'files/doc2.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('doc1');
            expect(graph.nodes).toContain('doc2');
            expect(graph.idToPath['doc1']).toBe(path.join(bundlePath, 'files/doc1.json'));
            expect(graph.idToPath['doc2']).toBe(path.join(bundlePath, 'files/doc2.json'));
        });

        it('should detect $ref edges between documents', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
            expect(graph.edges['child']).toEqual([]);
        });

        describe('CalmHub $id references', () => {
            const patternId = 'http://localhost:8080/calm/namespaces/finos/patterns/payments/versions/1.0.0';

            async function writePatternAndArchitecture(schemaRef: string): Promise<void> {
                await writeFile(path.join(filesPath, 'payments.pattern.json'), JSON.stringify({
                    '$id': patternId,
                    'properties': { 'nodes': { '$ref': `${patternId}#/defs/nodes` } }
                }));
                await writeFile(path.join(filesPath, 'payments.arch.json'), JSON.stringify({
                    '$schema': schemaRef,
                    'nodes': []
                }));
                await saveManifest(bundlePath, {
                    'payments-pattern': { path: 'files/payments.pattern.json', type: 'pattern' },
                    'payments-gateway': { path: 'files/payments.arch.json', type: 'architecture' }
                });
            }

            it('should detect a reference by the exact $id URL', async () => {
                await writePatternAndArchitecture(patternId);

                const graph = await buildDependencyGraph(bundlePath);

                expect(graph.edges['payments-gateway']).toEqual(['payments-pattern']);
            });

            it('should detect a reference to another version of the $id', async () => {
                await writePatternAndArchitecture(patternId.replace('1.0.0', '0.9.0'));

                const graph = await buildDependencyGraph(bundlePath);

                expect(graph.edges['payments-gateway']).toEqual(['payments-pattern']);
            });

            it('should not detect a reference to the same path on another host when the $id is a full URL', async () => {
                await writePatternAndArchitecture(patternId.replace('localhost:8080', 'calm.example.com'));

                const graph = await buildDependencyGraph(bundlePath);

                expect(graph.edges['payments-gateway']).toEqual([]);
            });

            it('should not add an edge for a reference to the document itself', async () => {
                await writePatternAndArchitecture(patternId);

                const graph = await buildDependencyGraph(bundlePath);

                expect(graph.edges['payments-pattern']).toEqual([]);
            });
        });

        it('should detect requirement-url edges', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                'requirement-url': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should detect config-url edges', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                'config-url': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should detect references in JSON Schema const objects', async () => {
            // This is the pattern format where URLs are wrapped in { const: "url" }
            await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({
                '$id': 'pattern',
                'properties': {
                    'requirement-url': {
                        'const': 'requirement-doc'
                    },
                    'config-url': {
                        'const': 'config-doc'
                    }
                }
            }));
            await writeFile(path.join(filesPath, 'requirement.json'), JSON.stringify({
                '$id': 'requirement-doc'
            }));
            await writeFile(path.join(filesPath, 'config.json'), JSON.stringify({
                '$id': 'config-doc'
            }));
            await saveManifest(bundlePath, {
                'pattern': { path: 'files/pattern.json', type: 'pattern' },
                'requirement-doc': { path: 'files/requirement.json', type: 'unknown' },
                'config-doc': { path: 'files/config.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['pattern']).toContain('requirement-doc');
            expect(graph.edges['pattern']).toContain('config-doc');
        });

        it('should handle mixed direct and const reference formats', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'direct-ref',
                'requirement-url': { 'const': 'const-ref' }
            }));
            await writeFile(path.join(filesPath, 'direct.json'), JSON.stringify({
                '$id': 'direct-ref'
            }));
            await writeFile(path.join(filesPath, 'const.json'), JSON.stringify({
                '$id': 'const-ref'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'direct-ref': { path: 'files/direct.json', type: 'unknown' },
                'const-ref': { path: 'files/const.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('direct-ref');
            expect(graph.edges['parent']).toContain('const-ref');
        });

        it('should handle refs with fragments', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'child#/definitions/foo'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child',
                definitions: { foo: {} }
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should skip unreadable files', async () => {
            await writeFile(path.join(filesPath, 'good.json'), JSON.stringify({ '$id': 'good' }));
            await writeFile(path.join(filesPath, 'bad.json'), 'not valid json');
            await saveManifest(bundlePath, {
                'good': { path: 'files/good.json', type: 'unknown' },
                'bad': { path: 'files/bad.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('good');
            expect(graph.nodes).toContain('bad');
            expect(graph.edges['good']).toEqual([]);
            // 'bad' should not have edges since it couldn't be parsed
            expect(graph.edges['bad']).toBeUndefined();
        });

        it('resolves a relative file path reference to a manifest entry', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': './files/child.json'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({ '$id': 'child' }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should ignore http/https references not in manifest', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'https://external.com/schema.json'
            }));
            await saveManifest(bundlePath, {
                'doc': { path: 'files/doc.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['doc']).toEqual([]);
        });

        it('printBundleTree calls buildDependencyGraph and prints without throwing', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({ '$id': 'doc' }));
            await saveManifest(bundlePath, { 'doc': { path: 'files/doc.json', type: 'unknown' } });
            await expect(printBundleTree(bundlePath)).resolves.not.toThrow();
        });

        it('should detect nested $ref properties', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                properties: {
                    nested: {
                        '$ref': 'child'
                    }
                }
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should resolve absolute paths stored by the default add-by-reference workflow', async () => {
            const absPath = path.join(filesPath, 'abs-doc.json');
            await writeFile(absPath, JSON.stringify({ '$id': 'abs-doc' }));
            // Default `add` (by reference) stores an absolute path in the manifest.
            await saveManifest(bundlePath, {
                'abs-doc': { path: absPath, type: 'architecture' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('abs-doc');
            expect(graph.idToPath['abs-doc']).toBe(absPath);
            expect(graph.edges['abs-doc']).toEqual([]);
        });
    });
});
