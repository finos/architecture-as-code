import { describe, expect, it } from 'vitest';
import { readArchitecture } from './model';
import { diagramFor } from './diagram';

const node = (id: string) => ({ 'unique-id': id, 'node-type': 'system', name: id, description: '' });
const containment = (parent: string, child: string) => ({ 'unique-id': parent + child,
  'relationship-type': { 'composed-of': { container: parent, nodes: [child] } } });

describe('preview input', () => {
  it('retains fields and never changes source JSON', () => {
    const original = { nodes: [{ ...node('a'), custom: { preserved: true } }], relationships: [], customRoot: 42 };
    const json = JSON.stringify(original);
    const result = diagramFor(json);
    expect(result.architecture).toEqual(original);
    expect(JSON.stringify(original)).toBe(json);
  });
  it('rejects cycles before recursive layout', () => {
    expect(() => diagramFor(JSON.stringify({ nodes: [node('a'), node('b')], relationships: [containment('a', 'b'), containment('b', 'a')] }))).toThrow('cycle');
  });
  it('renders containment as a Mermaid subgraph', () => {
    const result = diagramFor(JSON.stringify({ nodes: [node('child'), node('parent')], relationships: [containment('parent', 'child')] }));
    expect(result.code).toContain('subgraph parent');
    expect(result.code).toContain('class parent boundary');
  });
  it('rejects ambiguous IDs and malformed architecture structure', () => {
    expect(() => readArchitecture('{')).toThrow();
    expect(() => readArchitecture('{}')).toThrow('nodes array');
    expect(() => readArchitecture(JSON.stringify({ nodes: [node('a'), node('a')] }))).toThrow('Duplicate');
  });
  it('hides relationship labels by default and preserves node names', () => {
    const json = JSON.stringify({ nodes: [node('a'), node('b')], relationships: [{ 'unique-id': 'ab', description: 'Sends an order', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } }] });
    expect(diagramFor(json).code).not.toContain('Sends an order');
    expect(diagramFor(json, true).code).toContain('Sends an order');
    expect(diagramFor(json).nodesByMermaidId.size).toBe(2);
  });
  it('uses the original dark theme, ELK layout and typed service shape', () => {
    const json = JSON.stringify({ nodes: [{ ...node('api'), 'node-type': 'service' }] });
    const { code } = diagramFor(json);
    expect(code).toContain('"layout": "elk"');
    expect(code).toContain('fill:#434343');
    expect(code).toContain('stroke-dasharray: 5 4');
    expect(code).toContain('api[/"⚙️ api"/]:::service');
  });
});
