import { applyEdits, modify } from 'jsonc-parser';
import { readArchitecture } from './model';

export type Draft = { kind: 'node' | 'connection'; existingId?: string; id: string; name: string; nodeType: string; description: string; source: string; destination: string; protocol: string };
export function newDraft(kind: Draft['kind']): Draft {
  return { kind, id: '', name: '', nodeType: 'service', description: '', source: '', destination: '', protocol: '' };
}
export function nodeDraft(node: Record<string, unknown>): Draft {
  return { ...newDraft('node'), existingId: String(node['unique-id']), id: String(node['unique-id']), name: String(node.name ?? ''), nodeType: String(node['node-type'] ?? ''), description: String(node.description ?? '') };
}
export function connectionDraft(relationship: Record<string, unknown>): Draft {
  const connects = (relationship['relationship-type'] as any)?.connects;
  return { ...newDraft('connection'), existingId: String(relationship['unique-id']), id: String(relationship['unique-id']), description: String(relationship.description ?? ''), protocol: String(relationship.protocol ?? ''), source: connects?.source?.node ?? '', destination: connects?.destination?.node ?? '' };
}

// Change only fields controlled by the form. Never serialize the rendering model.
export function applyDraft(json: string, draft: Draft): string {
  const model = readArchitecture(json);
  const collection = draft.kind === 'node' ? 'nodes' : 'relationships';
  const entries = model[collection];
  const id = draft.id.trim();
  if (!id) throw new Error('Enter a unique ID.');
  if (draft.existingId && id !== draft.existingId) throw new Error('Existing IDs cannot be renamed here because other fields may reference them.');
  const matches = entries.flatMap((item, index) => item['unique-id'] === (draft.existingId ?? id) ? [index] : []);
  if (draft.existingId ? matches.length !== 1 : matches.length > 0) throw new Error('The ID already exists or the selected item is no longer unique.');
  const index = draft.existingId ? matches[0] : entries.length;
  const original = entries[index];
  const indent = json.match(/\n([\t ]+)"/)?.[1] ?? '  ';
  let result = json;
  const set = (path: (string | number)[], value: unknown) => {
    result = applyEdits(result, modify(result, path, value, { formattingOptions: { insertSpaces: !indent.includes('\t'), tabSize: indent.length, eol: json.includes('\r\n') ? '\r\n' : '\n' } }));
  };
  const path = [collection, index];
  if (draft.kind === 'node') {
    if (!draft.name.trim() || !draft.nodeType.trim()) throw new Error('Enter a name and node type.');
    if (!draft.existingId) set(path, { 'unique-id': id, 'node-type': draft.nodeType.trim(), name: draft.name.trim(), description: draft.description });
    else for (const [key, value] of Object.entries({ 'node-type': draft.nodeType.trim(), name: draft.name.trim(), description: draft.description })) {
      if (original[key] !== value && !(original[key] === undefined && value === '')) set([...path, key], value);
    }
  } else {
    if (![draft.source, draft.destination].every(endpoint => model.nodes.some(node => node['unique-id'] === endpoint))) throw new Error('Choose existing source and destination nodes.');
    if (!draft.existingId) set(path, { 'unique-id': id, 'relationship-type': { connects: { source: { node: draft.source }, destination: { node: draft.destination } } }, description: draft.description, ...(draft.protocol.trim() ? { protocol: draft.protocol.trim() } : {}) });
    else {
      const connects = (original['relationship-type'] as any)?.connects;
      if (!connects) throw new Error('Only connects relationships can be edited in this form.');
      for (const [endpoint, node] of [['source', draft.source], ['destination', draft.destination]]) {
        // Interface IDs belong to their original node. Refuse to silently discard or redirect them.
        if (connects[endpoint].node !== node) {
          if (connects[endpoint].interfaces?.length) throw new Error(`The ${endpoint} has interface references. Update those references in JSON before changing its node.`);
          set([...path, 'relationship-type', 'connects', endpoint, 'node'], node);
        }
      }
      for (const [key, value] of Object.entries({ description: draft.description, protocol: draft.protocol.trim() })) {
        if (original[key] !== value && !(original[key] === undefined && value === '')) set([...path, key], value || (key === 'protocol' ? undefined : ''));
      }
    }
  }
  readArchitecture(result);
  return result;
}
