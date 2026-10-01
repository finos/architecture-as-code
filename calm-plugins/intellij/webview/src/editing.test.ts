import { describe, expect, it } from 'vitest';
import { applyDraft, newDraft, nodeDraft, connectionDraft } from './editing';

const source = '{\n  "custom": { "number": 1e3, "keep": "\\u0041" },\n  "nodes": [{"unique-id":"a","node-type":"service","name":"Alpha","description":"Old","controls":{"x":{"custom":true}},"interfaces":[{"unique-id":"port"}]},{"unique-id":"b","node-type":"system","name":"Beta"}],\n  "relationships": [{"unique-id":"r","relationship-type":{"connects":{"source":{"node":"a","interfaces":["port"]},"destination":{"node":"b"}}},"protocol":"HTTPS","description":"Before","custom":{"keep":true}}],\n  "flows": [{"relationship-unique-id":"r"}]\n}';

describe('lossless form edits', () => {
  it('changes only the selected field, retaining original escapes, whitespace and metadata', () => {
    const draft = { ...nodeDraft(JSON.parse(source).nodes[0]), name: 'Renamed' };
    expect(applyDraft(source, draft)).toBe(source.replace('Alpha', 'Renamed'));
  });
  it('retains interface references, flows and custom relationship fields', () => {
    const draft = { ...connectionDraft(JSON.parse(source).relationships[0]), description: 'After' };
    expect(applyDraft(source, draft)).toBe(source.replace('Before', 'After'));
  });
  it('rejects endpoint changes that would invalidate interface references', () => {
    const draft = { ...connectionDraft(JSON.parse(source).relationships[0]), source: 'b' };
    expect(() => applyDraft(source, draft)).toThrow('interface references');
  });
  it('adds nodes and connections without changing existing objects', () => {
    const node = { ...newDraft('node'), id: 'c', name: 'Gamma' };
    const withNode = applyDraft(source, node);
    const result = JSON.parse(applyDraft(withNode, { ...newDraft('connection'), id: 'r2', source: 'b', destination: 'c', protocol: 'HTTPS' }));
    expect(result.nodes.slice(0, 2)).toEqual(JSON.parse(source).nodes);
    expect(result.relationships[0]).toEqual(JSON.parse(source).relationships[0]);
    expect(result.relationships[1]['relationship-type'].connects.destination.node).toBe('c');
  });
  it('creates a missing relationships array', () => {
    const minimal = JSON.stringify({ nodes: JSON.parse(source).nodes });
    expect(JSON.parse(applyDraft(minimal, { ...newDraft('connection'), id: 'r', source: 'a', destination: 'b' })).relationships).toHaveLength(1);
  });
  it('rejects duplicate IDs, missing endpoints, renames and ambiguous existing IDs', () => {
    expect(() => applyDraft(source, { ...newDraft('node'), id: 'a', name: 'Duplicate' })).toThrow('ID');
    expect(() => applyDraft(source, { ...newDraft('connection'), id: 'r2', source: 'missing', destination: 'b' })).toThrow('existing');
    expect(() => applyDraft(source, { ...nodeDraft(JSON.parse(source).nodes[0]), id: 'new' })).toThrow('renamed');
    const duplicate = JSON.parse(source); duplicate.relationships.push(duplicate.relationships[0]);
    expect(() => applyDraft(JSON.stringify(duplicate), connectionDraft(duplicate.relationships[0]))).toThrow('unique');
  });
  it('leaves a no-op edit byte-for-byte identical', () => {
    expect(applyDraft(source, nodeDraft(JSON.parse(source).nodes[1]))).toBe(source);
  });
});
