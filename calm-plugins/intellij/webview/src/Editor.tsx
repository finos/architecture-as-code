import React, { useState } from 'react';
import { applyDraft, Draft } from './editing';
import { readArchitecture } from './model';
import { SuggestedField, NODE_TYPES, PROTOCOLS } from './SuggestedField';

export function Editor({ draft: initial, json, pending, stale, onApply, onClose }: { draft: Draft; json: string; pending: boolean; stale: boolean; onApply: (json: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const nodes = readArchitecture(json).nodes;
  const field = (key: keyof Draft, label: string, required = false) => <label>{label}<input value={String(draft[key] ?? '')} required={required} readOnly={key === 'id' && !!draft.existingId} onChange={e => setDraft({ ...draft, [key]: e.target.value })}/></label>;
  return <aside aria-label={draft.kind === 'node' ? 'Node details' : 'Connection details'}>
    <button className="close" onClick={onClose} disabled={pending} aria-label="Close details">×</button>
    <h2>{draft.existingId ? 'Edit' : 'Add'} {draft.kind}</h2>
    <form onSubmit={event => { event.preventDefault(); try { setError(''); onApply(applyDraft(json, draft)); } catch (e) { setError((e as Error).message); } }}>
      <fieldset disabled={pending || stale}>
        {field('id', 'Unique ID', true)}
        {draft.existingId && <small>IDs stay fixed to preserve references.</small>}
        {draft.kind === 'node' ? <>{field('name', 'Name', true)}<SuggestedField label="Node type" value={draft.nodeType} options={NODE_TYPES} required onChange={nodeType => setDraft({ ...draft, nodeType })}/></> : <>
          {(['source', 'destination'] as const).map(key => <label key={key}>{key === 'source' ? 'Source' : 'Destination'}<select value={draft[key]} required onChange={e => setDraft({ ...draft, [key]: e.target.value })}>
            <option value="">Choose a node</option>{nodes.map(node => <option key={String(node['unique-id'])} value={String(node['unique-id'])}>{String(node.name ?? node['unique-id'])} ({String(node['unique-id'])})</option>)}
          </select></label>)}<SuggestedField label="Protocol" value={draft.protocol} options={PROTOCOLS} onChange={protocol => setDraft({ ...draft, protocol })}/>
        </>}
        <label>Description<textarea value={draft.description} rows={4} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
        <button type="submit">{pending ? 'Applying…' : 'Apply changes'}</button>
      </fieldset>
      {stale && <p role="alert">The document changed while this form was open. Close and reopen it to edit the latest version.</p>}
      {error && <p role="alert">{error}</p>}
      <p className="hint">Changes update the JSON document. Use the IDE’s Save action to save to disk.</p>
    </form>
  </aside>;
}
