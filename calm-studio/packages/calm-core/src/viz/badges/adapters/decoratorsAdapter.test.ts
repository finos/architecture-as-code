import { describe, it, expect, vi } from 'vitest';
import { decoratorsAdapter, severityFromDecorator } from './decoratorsAdapter.js';

describe('decoratorsAdapter', () => {
  it('emits one badge per node decorator', () => {
    const node = {
      'unique-id': 'n1',
      'node-type': 'service',
      decorators: [
        { 'unique-id': 'd1', type: 'threat', data: { severity: 'high' } },
        { 'unique-id': 'd2', type: 'control', data: {} },
      ],
    } as any;
    const arch = { nodes: [node], relationships: [] } as any;
    const badges = decoratorsAdapter.forNode(node, arch);
    expect(badges).toHaveLength(2);
    expect(badges[0]).toMatchObject({ id: 'd1', source: 'decorators', severity: 'high' });
  });

  it('skips malformed decorators with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const node = {
      'unique-id': 'n1',
      'node-type': 'service',
      decorators: [{ data: {} }, { 'unique-id': 'ok', type: 'threat' }],
    } as any;
    const arch = { nodes: [node], relationships: [] } as any;
    const badges = decoratorsAdapter.forNode(node, arch);
    expect(badges).toHaveLength(1);
    expect(badges[0]!.id).toBe('ok');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns empty for node without decorators', () => {
    const node = { 'unique-id': 'n1', 'node-type': 'service' } as any;
    expect(decoratorsAdapter.forNode(node, { nodes: [node], relationships: [] } as any)).toEqual([]);
  });

  it('infers severity by precedence: data.severity > risk-level > type fallback', () => {
    expect(severityFromDecorator({ 'unique-id': 'd', type: 'threat', data: { severity: 'critical' } } as any)).toBe('critical');
    expect(severityFromDecorator({ 'unique-id': 'd', type: 'threat', data: { 'risk-level': 'medium' } } as any)).toBe('medium');
    expect(severityFromDecorator({ 'unique-id': 'd', type: 'threat', data: {} } as any)).toBe('high');
    expect(severityFromDecorator({ 'unique-id': 'd', type: 'control', data: {} } as any)).toBe('unknown');
  });

  it('emits edge decorators', () => {
    const edge = {
      'unique-id': 'r1',
      'relationship-type': { connects: {} },
      decorators: [{ 'unique-id': 'd-edge', type: 'threat', data: { severity: 'low' } }],
    } as any;
    const arch = { nodes: [], relationships: [edge] } as any;
    const badges = decoratorsAdapter.forEdge(edge, arch);
    expect(badges).toHaveLength(1);
    expect(badges[0]!.severity).toBe('low');
  });
});
