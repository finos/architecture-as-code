import React, { useState, useEffect, useRef } from 'react';
import type { Edge } from 'reactflow';
import type { EdgeDirection, EdgeLineStyle } from '../canvas/edges/TooltipEdge';
import { CustomMetadata } from './CustomMetadata';

const RELATIONSHIP_TYPES = ['connects', 'interacts', 'deployed-in', 'composed-of', 'options'] as const;
const PROTOCOL_TYPES = ['connects', 'interacts'];
const COMMON_PROTOCOLS = ['HTTPS', 'HTTP', 'gRPC', 'GraphQL', 'WebSocket', 'AMQP', 'MQTT', 'Kafka', 'TCP', 'UDP', 'JDBC', 'ODBC', 'SFTP', 'SSH'];

const DIRECTION_OPTIONS: { value: EdgeDirection; label: string }[] = [
    { value: 'source-to-target', label: 'Source → Target' },
    { value: 'bidirectional', label: 'Bidirectional ↔' },
    { value: 'none', label: 'No Arrows' },
];

const LINE_STYLE_OPTIONS: { value: EdgeLineStyle; label: string }[] = [
    { value: 'solid', label: 'Solid ———' },
    { value: 'dashed', label: 'Dashed - - -' },
    { value: 'dotted', label: 'Dotted · · ·' },
];

interface EdgePropertiesProps {
    edge: Edge;
    readonlyMode?: boolean;
    onEdgeUpdate?: (edgeId: string, field: string, value: unknown) => void;
}

export function EdgeProperties({ edge, readonlyMode = false, onEdgeUpdate }: EdgePropertiesProps) {
    const data = (edge.data ?? {}) as Record<string, unknown>;
    const relType = (data.calmVariant as string) ?? 'connects';
    const showProtocol = PROTOCOL_TYPES.includes(relType);

    const [localDesc, setLocalDesc] = useState(String(data.description ?? ''));
    const [localProtocol, setLocalProtocol] = useState(String(data.protocol ?? ''));
    const [showCustomProtocol, setShowCustomProtocol] = useState(false);
    const descTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const protocolTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastEdgeId = useRef<string | null>(null);

    const direction = (data.direction as EdgeDirection) ?? 'source-to-target';
    const lineStyle = (data.lineStyle as EdgeLineStyle) ?? 'solid';

    useEffect(() => {
        if (edge.id !== lastEdgeId.current) {
            lastEdgeId.current = edge.id;
            setLocalDesc(String(data.description ?? ''));
            setLocalProtocol(String(data.protocol ?? ''));
            setShowCustomProtocol(!!data.protocol && !COMMON_PROTOCOLS.includes(data.protocol as string));
        }
    }, [edge.id, data]);

    return (
        <div style={{ padding: '12px' }}>
            <Field label="Edge ID"><span style={monoStyle}>{data.calmRelId as string ?? edge.id}</span></Field>
            <Field label="Source → Target"><span style={{ fontSize: '11px', color: 'var(--calm-fg)' }}>{edge.source} → {edge.target}</span></Field>

            <Field label="Relationship Type">
                {readonlyMode ? <span style={{ fontSize: '12px' }}>{relType}</span> : (
                    <select value={relType} onChange={(e) => onEdgeUpdate?.(edge.id, 'calmVariant', e.target.value)} style={selectStyle}>
                        {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</option>)}
                    </select>
                )}
            </Field>

            <Field label="Direction">
                {readonlyMode ? <span style={{ fontSize: '12px' }}>{DIRECTION_OPTIONS.find(o => o.value === direction)?.label}</span> : (
                    <select value={direction} onChange={(e) => onEdgeUpdate?.(edge.id, 'direction', e.target.value)} style={selectStyle}>
                        {DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                )}
            </Field>

            <Field label="Line Style">
                {readonlyMode ? <span style={{ fontSize: '12px' }}>{LINE_STYLE_OPTIONS.find(o => o.value === lineStyle)?.label}</span> : (
                    <select value={lineStyle} onChange={(e) => onEdgeUpdate?.(edge.id, 'lineStyle', e.target.value)} style={selectStyle}>
                        {LINE_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                )}
            </Field>

            {showProtocol && (
                <Field label="Protocol">
                    {readonlyMode ? <span style={{ fontSize: '12px' }}>{localProtocol || '—'}</span> : (
                        <>
                            {!showCustomProtocol ? (
                                <select value={localProtocol} onChange={(e) => {
                                    if (e.target.value === '__custom__') { setShowCustomProtocol(true); setLocalProtocol(''); return; }
                                    setLocalProtocol(e.target.value);
                                    onEdgeUpdate?.(edge.id, 'protocol', e.target.value);
                                }} style={selectStyle}>
                                    <option value="">— None —</option>
                                    {COMMON_PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
                                    <option value="__custom__">Custom...</option>
                                </select>
                            ) : (
                                <input type="text" value={localProtocol} onChange={(e) => {
                                    setLocalProtocol(e.target.value);
                                    clearTimeout(protocolTimer.current);
                                    protocolTimer.current = setTimeout(() => onEdgeUpdate?.(edge.id, 'protocol', e.target.value), 300);
                                }} placeholder="Custom protocol" style={inputStyle} />
                            )}
                        </>
                    )}
                </Field>
            )}

            <Field label="Description">
                {readonlyMode ? <span style={{ fontSize: '12px' }}>{localDesc || '—'}</span> : (
                    <textarea value={localDesc} onChange={(e) => {
                        setLocalDesc(e.target.value);
                        clearTimeout(descTimer.current);
                        descTimer.current = setTimeout(() => onEdgeUpdate?.(edge.id, 'description', e.target.value), 300);
                    }} rows={2} placeholder="Edge description" style={{ ...inputStyle, resize: 'vertical', minHeight: '44px' }} />
                )}
            </Field>

            <CustomMetadata
                metadata={(data.edgeMetadata as Record<string, string>) ?? {}}
                onUpdate={(meta) => onEdgeUpdate?.(edge.id, 'edgeMetadata', meta)}
                readonly={readonlyMode}
            />
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '4px' }}>{label}</div>{children}</div>;
}

const monoStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', fontSize: '12px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
