import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { diagramFor } from './diagram';
import { renderDiagram } from './mermaid';
import './style.css';
import { Editor } from './Editor';
import { Draft, newDraft, nodeDraft, connectionDraft } from './editing';

declare global { interface Window { calmHost?: { postMessage(message: string): void } } }
type ModelMessage = { type: 'modelUpdated'; documentId: string; revision: number; fileName: string; json?: string; error?: string; version?: string; writable?: boolean; canUndo?: boolean; canRedo?: boolean };
type Bounds = { x: number; y: number; width: number; height: number };
type Diagram = ReturnType<typeof diagramFor>;

function Preview() {
  const [model, setModel] = useState<ModelMessage | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<{ draft: Draft; model: ModelMessage; key: number } | null>(null);
  const [listing, setListing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRequest = useRef<string | null>(null);
  const [editError, setEditError] = useState('');
  const editable = !!model?.version && model.writable === true && !!diagram && !loading && !pending;
  function startEditing(draft: Draft) {
    if (!editable || !model || editing) return;
    setEditing({ draft, model, key: Date.now() }); setSelected(null); setListing(false); setEditError('');
  }
  function sendAction(type: 'applyEdit' | 'undo' | 'redo', json?: string) {
    const base = type === 'applyEdit' ? editing?.model : model;
    if (!base?.version || pendingRequest.current) return;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingRequest.current = requestId; setPending(requestId); setEditError('');
    window.calmHost?.postMessage(JSON.stringify({ type, requestId, documentId: base.documentId, version: base.version, json }));
  }
  const viewport = useRef<HTMLDivElement>(null);
  const initialBounds = useRef<Bounds | null>(null);
  const revision = useRef(-1);
  const drag = useRef<{ x: number; y: number; bounds: Bounds; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'editResult' && message.requestId === pendingRequest.current) {
        pendingRequest.current = null; setPending(null);
        if (message.ok) setEditing(null);
        else setEditError(message.error ?? 'Unable to apply this edit.');
        return;
      }
      if (message?.type !== 'modelUpdated' || typeof message.documentId !== 'string' ||
          typeof message.revision !== 'number' || typeof message.fileName !== 'string' || message.revision <= revision.current) return;
      revision.current = message.revision;
      setModel(message); setSelected(null);
      setEditing(current => current && current.model.documentId !== message.documentId ? null : current);
    };
    window.addEventListener('message', listener);
    window.calmHost?.postMessage('ready');
    return () => window.removeEventListener('message', listener);
  }, []);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    const container = viewport.current!;
    container.replaceChildren(); initialBounds.current = null;
    setLoading(true); setError(null); setDiagram(null);
    void (async () => {
      try {
        if (model.error) throw new Error(model.error);
        if (!model.json?.trim()) throw new Error('This file is empty. Add a CALM architecture and save it.');
        const next = diagramFor(model.json, showLabels);
        if (next.architecture.nodes.length > 0) {
          const svgText = await renderDiagram(next.code);
          if (cancelled) return;
          container.innerHTML = svgText;
          const svg = container.querySelector('svg')!;
          const b = svg.viewBox.baseVal;
          initialBounds.current = { x: b.x, y: b.y, width: b.width, height: b.height };
          svg.style.width = '100%'; svg.style.height = '100%'; svg.style.maxWidth = 'none';
          svg.setAttribute('aria-label', 'Architecture diagram'); svg.setAttribute('role', 'img');
          // Explicit IDs distinguish parallel and reverse connections independently of SVG order.
          container.querySelectorAll<SVGPathElement>('path.flowchart-link').forEach(path => {
            const edgeId = path.getAttribute('data-id') ?? path.id;
            // ELK appends segment suffixes (for example _0) to explicit edge IDs.
            const entry = [...next.connectionsByMermaidId].find(([id]) => edgeId === id || edgeId.startsWith(`${id}_`));
            if (!entry) return;
            const [connectionId, relationship] = entry;
            const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hit.setAttribute('d', path.getAttribute('d') ?? '');
            if (path.hasAttribute('transform')) hit.setAttribute('transform', path.getAttribute('transform')!);
            hit.classList.add('connection-hit');
            hit.dataset.connectionId = connectionId;
            hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button');
            hit.setAttribute('aria-label', `Edit connection ${String(relationship['unique-id'])}`);
            path.after(hit);
            // Labels carry the same explicit edge ID in Mermaid's SVG.
            container.querySelectorAll<SVGElement>('[data-id]').forEach(element => {
              if ([edgeId, connectionId].includes(element.getAttribute('data-id') ?? '')) element.dataset.connectionId = connectionId;
            });
          });
          container.querySelectorAll<SVGGElement>('g.node').forEach(element => {
            const entry = [...next.nodesByMermaidId].sort(([a], [b]) => b.length - a.length).find(([id]) =>
              element.id === id || element.getAttribute('data-id') === id ||
              element.id.startsWith(`flowchart-${id}-`) || element.id.startsWith(`${svg.id}-flowchart-${id}-`));
            if (!entry) return;
            element.dataset.calmId = String(entry[1]['unique-id']);
            element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button');
            element.setAttribute('aria-label', `Inspect ${String(entry[1].name ?? entry[1]['unique-id'])}`);
          });
        }
        if (!cancelled) setDiagram(next);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to render this architecture.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [model, showLabels]);

  function fit() {
    const svg = viewport.current?.querySelector('svg'), b = initialBounds.current;
    if (svg && b) svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
  }
  function zoom(factor: number) {
    const svg = viewport.current?.querySelector('svg');
    if (!svg || !initialBounds.current) return;
    const b = svg.viewBox.baseVal;
    const width = Math.max(initialBounds.current.width / 8, Math.min(initialBounds.current.width * 4, b.width * factor));
    const height = b.height * width / b.width;
    svg.setAttribute('viewBox', `${b.x + (b.width - width) / 2} ${b.y + (b.height - height) / 2} ${width} ${height}`);
  }
  useEffect(() => {
    const container = viewport.current!;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom(event.deltaY < 0 ? 0.85 : 1 / 0.85); };
    container.addEventListener('wheel', wheel, { passive: false });
    return () => container.removeEventListener('wheel', wheel);
  }, []);
  function inspect(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const connectionId = target.closest<SVGElement>('[data-connection-id]')?.dataset.connectionId;
    if (connectionId) {
      const connection = diagram?.connectionsByMermaidId.get(connectionId);
      if (connection && editable) startEditing(connectionDraft(connection));
      return;
    }
    const id = target.closest<SVGGElement>('g.node')?.dataset.calmId;
    const node = diagram?.architecture.nodes.find(node => node['unique-id'] === id);
    if (node && editable) startEditing(nodeDraft(node));
    else if (!editing) setSelected(node ?? null);
  }

  return <main>
    <header><strong>CALM Preview</strong><span className="filename">{model?.fileName ?? 'Architecture preview'}</span></header>
    <nav aria-label="Preview controls"><span>Diagram</span><div className="actions">
      <button onClick={() => { setSelected(null); fit(); }}>⌂ Home</button>
      <label><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)}/> Show Labels</label>
    </div></nav>
    <div className="edit-toolbar" aria-label="Editing controls">
      <button disabled={!editable || !!editing} onClick={() => startEditing(newDraft('node'))}>Add node</button>
      <button disabled={!editable || !!editing || !diagram?.architecture.nodes.length} onClick={() => startEditing(newDraft('connection'))}>Add connection</button>
      <button disabled={!diagram || !!editing || !!pending} onClick={() => { setListing(!listing); setSelected(null); }}>Edit items</button>
      <button disabled={!editable || !!editing || !model?.canUndo} onClick={() => sendAction('undo')}>Undo</button>
      <button disabled={!editable || !!editing || !model?.canRedo} onClick={() => sendAction('redo')}>Redo</button>
    </div>
    {editError && <div className="edit-error" role="alert">{editError}</div>}
    <section className="body"><article>
      <h1>Architecture Overview</h1>
      <div className="diagram-frame">
        <div ref={viewport} className="canvas"
          onClick={event => { if (!ignoreClick.current) inspect(event.target); ignoreClick.current = false; }}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(event.target); } }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            const svg = viewport.current?.querySelector('svg'); if (!svg) return;
            const b = svg.viewBox.baseVal;
            drag.current = { x: event.clientX, y: event.clientY, bounds: { x: b.x, y: b.y, width: b.width, height: b.height }, moved: false };
          }}
          onPointerMove={event => {
            const state = drag.current, svg = viewport.current?.querySelector('svg');
            if (!state || !svg) return;
            const dx = event.clientX - state.x, dy = event.clientY - state.y;
            if (Math.abs(dx) + Math.abs(dy) < 4 && !state.moved) return;
            state.moved = true; event.currentTarget.setPointerCapture(event.pointerId);
            const rect = svg.getBoundingClientRect();
            const scale = Math.min(rect.width / state.bounds.width, rect.height / state.bounds.height);
            svg.setAttribute('viewBox', `${state.bounds.x - dx / scale} ${state.bounds.y - dy / scale} ${state.bounds.width} ${state.bounds.height}`);
          }}
          onPointerUp={() => { ignoreClick.current = drag.current?.moved ?? false; drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        />
        {!model ? <div className="message"><h2>Open a CALM architecture</h2><p>Right-click a CALM JSON file and choose <b>Open CALM Canvas</b>.</p></div>
          : error ? <div className="message error" role="alert"><h2>Cannot preview this file</h2><p>{error}</p><p>Fix the JSON to refresh the diagram.</p></div>
          : loading ? <div className="message" role="status">Rendering architecture…</div>
          : diagram?.architecture.nodes.length === 0 ? <div className="message"><h2>No nodes yet</h2><p>Use Add node to start your architecture.</p></div> : null}
        <div className="zoom-controls"><button aria-label="Zoom in" onClick={() => zoom(0.8)} disabled={!diagram}>+</button>
          <button aria-label="Zoom out" onClick={() => zoom(1.25)} disabled={!diagram}>−</button>
          <button aria-label="Fit diagram" onClick={fit} disabled={!diagram}>⊡</button></div>
      </div>
    </article>
    {editing && <Editor key={editing.key} draft={editing.draft} json={editing.model.json!} pending={!!pending}
      stale={model?.version !== editing.model.version || model?.documentId !== editing.model.documentId || model?.writable !== true || !!model?.error}
      onApply={json => sendAction('applyEdit', json)} onClose={() => setEditing(null)}/>}
    {listing && !editing && diagram && <aside aria-label="Architecture items"><button className="close" aria-label="Close items" onClick={() => setListing(false)}>×</button>
      <h2>Nodes</h2>{diagram.architecture.nodes.map((node, i) => <button className="item" key={i} disabled={!editable} onClick={() => startEditing(nodeDraft(node))}>{String(node.name ?? node['unique-id'])}</button>)}
      <h2>Connections</h2>{diagram.architecture.relationships.map((relationship, i) => <button className="item" key={i} disabled={!editable || !(relationship['relationship-type'] as any)?.connects} onClick={() => startEditing(connectionDraft(relationship))}>{String(relationship['unique-id'] ?? 'Unnamed relationship')}</button>)}
      <p className="hint">Connects relationships can be edited here. Edit other relationship types in JSON.</p>
    </aside>}
    {selected && !editing && !listing && <aside aria-label="Node details"><button className="close" onClick={() => setSelected(null)} aria-label="Close details">×</button>
      <h2>{String(selected.name ?? selected['unique-id'])}</h2><dl><dt>ID</dt><dd>{String(selected['unique-id'])}</dd>
      <dt>Type</dt><dd>{String(selected['node-type'] ?? '')}</dd><dt>Description</dt><dd>{String(selected.description || 'No description')}</dd></dl></aside>}
    </section>
    <footer><span>{diagram?.architecture.nodes.length ?? 0} nodes · {diagram?.connectionCount ?? 0} connections</span><span>{model?.writable === true ? 'Edits update JSON · Live preview' : 'Read only · Live preview'}</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
