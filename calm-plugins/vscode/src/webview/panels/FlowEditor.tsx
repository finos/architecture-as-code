import React, { useState, useRef } from 'react';
import type { CalmFlow } from '../../core/types';

interface FlowStyle { background?: string; text?: string }

interface FlowEditorProps {
    flow: CalmFlow;
    onUpdate: (flowId: string, updates: Partial<CalmFlow>) => void;
    onDelete: (flowId: string) => void;
    readonly?: boolean;
}

function getFlowStyle(flow: CalmFlow): FlowStyle | undefined {
    const meta = flow.metadata as Record<string, unknown> | undefined;
    if (!meta) return undefined;
    return meta['flow-style'] as FlowStyle | undefined;
}

const DEFAULT_BG = '#3b82f6';
const DEFAULT_TEXT = '#ffffff';

export function FlowEditor({ flow, onUpdate, onDelete, readonly = false }: FlowEditorProps) {
    const [expanded, setExpanded] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flowId = flow['unique-id'];
    const style = getFlowStyle(flow);
    const [bg, setBg] = useState(style?.background ?? '');
    const [text, setText] = useState(style?.text ?? '');

    const pushColor = (nextBg: string, nextText: string) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const meta = { ...((flow.metadata as Record<string, unknown>) ?? {}) };
            const cleaned: FlowStyle = {};
            if (nextBg) cleaned.background = nextBg;
            if (nextText) cleaned.text = nextText;
            if (Object.keys(cleaned).length) {
                meta['flow-style'] = cleaned;
            } else {
                delete meta['flow-style'];
            }
            onUpdate(flowId, { metadata: meta });
        }, 150);
    };

    const onBg = (v: string) => { setBg(v); pushColor(v, text); };
    const onText = (v: string) => { setText(v); pushColor(bg, v); };
    const resetColor = () => {
        if (timer.current) clearTimeout(timer.current);
        setBg(''); setText('');
        const meta = { ...((flow.metadata as Record<string, unknown>) ?? {}) };
        delete meta['flow-style'];
        onUpdate(flowId, { metadata: meta });
    };

    const debouncedField = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const handleField = (field: string, value: string) => {
        clearTimeout(debouncedField.current[field]);
        debouncedField.current[field] = setTimeout(() => {
            onUpdate(flowId, { [field]: value } as Partial<CalmFlow>);
        }, 300);
    };

    const transitionCount = flow.transitions?.length ?? 0;
    const swatchColor = bg || DEFAULT_BG;

    return (
        <div style={cardStyle}>
            <div style={cardHeaderStyle} onClick={() => setExpanded(!expanded)}>
                <span style={chevronStyle}>{expanded ? '▾' : '▸'}</span>
                <span style={{ ...swatchStyle, background: swatchColor }} />
                <span style={nameStyle}>{flow.name || 'Unnamed'}</span>
                <span style={badgeStyle}>{transitionCount}</span>
                <span style={{ flex: 1 }} />
                {!readonly && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(flowId); }} style={deleteBtnStyle} title="Delete flow">&times;</button>
                )}
            </div>

            {expanded && (
                <div style={cardBodyStyle}>
                    <div style={rowStyle}>
                        <span style={rowLabelStyle}>unique-id</span>
                        <input style={{ ...inputStyle, flex: 1 }} type="text" defaultValue={flowId}
                            key={`${flowId}-uid`}
                            onBlur={(e) => handleField('unique-id', e.target.value)} readOnly={readonly} />
                    </div>
                    <div style={rowStyle}>
                        <span style={rowLabelStyle}>name</span>
                        <input style={{ ...inputStyle, flex: 1 }} type="text" defaultValue={flow.name}
                            key={`${flowId}-name`}
                            onBlur={(e) => handleField('name', e.target.value)} readOnly={readonly} />
                    </div>
                    <div style={rowStyle}>
                        <span style={rowLabelStyle}>description</span>
                        <textarea style={{ ...inputStyle, flex: 1, resize: 'vertical', minHeight: '40px' }}
                            defaultValue={flow.description} key={`${flowId}-desc`}
                            onBlur={(e) => handleField('description', e.target.value)} readOnly={readonly} />
                    </div>

                    <div style={colorSectionStyle}>
                        <span style={colorLabelStyle}>Flow Colour</span>
                        <div style={colorRowStyle}>
                            <span style={colorFieldLabel}>Background</span>
                            <div style={colorSwatchRow}>
                                <input type="color" disabled={readonly} value={bg || DEFAULT_BG}
                                    onChange={(e) => onBg(e.target.value)} style={colorSwatch} title="Flow colour" />
                                <input type="text" disabled={readonly} value={bg} placeholder="default"
                                    onChange={(e) => onBg(e.target.value.trim())} style={hexInput} />
                            </div>
                        </div>
                        <div style={colorRowStyle}>
                            <span style={colorFieldLabel}>Text</span>
                            <div style={colorSwatchRow}>
                                <input type="color" disabled={readonly} value={text || DEFAULT_TEXT}
                                    onChange={(e) => onText(e.target.value)} style={colorSwatch} title="Text colour" />
                                <input type="text" disabled={readonly} value={text} placeholder="default"
                                    onChange={(e) => onText(e.target.value.trim())} style={hexInput} />
                            </div>
                        </div>
                        {!readonly && !!(bg || text) && (
                            <button onClick={resetColor} style={resetBtn}>Reset to default</button>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}

const cardStyle: React.CSSProperties = { borderRadius: '4px', border: '1px solid var(--calm-border)', overflow: 'hidden' };
const cardHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', background: 'var(--calm-bg-secondary)' };
const chevronStyle: React.CSSProperties = { fontSize: '9px', color: 'var(--calm-fg-muted)', flexShrink: 0, width: '10px' };
const swatchStyle: React.CSSProperties = { width: '12px', height: '12px', borderRadius: '2px', border: '1px solid var(--calm-border)', flexShrink: 0 };
const nameStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: 'var(--calm-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const badgeStyle: React.CSSProperties = { minWidth: '18px', height: '16px', padding: '0 4px', borderRadius: '8px', fontSize: '9px', fontWeight: 600, background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const deleteBtnStyle: React.CSSProperties = { width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '13px', flexShrink: 0 };
const cardBodyStyle: React.CSSProperties = { padding: '8px 10px', borderTop: '1px solid var(--calm-border)' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' };
const rowLabelStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', flexShrink: 0, width: '70px' };
const inputStyle: React.CSSProperties = { padding: '3px 6px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };

const colorSectionStyle: React.CSSProperties = { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--calm-border)' };
const colorLabelStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--calm-fg-muted)', display: 'block', marginBottom: '6px' };
const colorRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' };
const colorFieldLabel: React.CSSProperties = { fontSize: '10px', color: 'var(--calm-fg)' };
const colorSwatchRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };
const colorSwatch: React.CSSProperties = { width: '24px', height: '20px', padding: 0, border: '1px solid var(--calm-border-input)', borderRadius: '3px', background: 'transparent', cursor: 'pointer' };
const hexInput: React.CSSProperties = { width: '72px', padding: '3px 5px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const resetBtn: React.CSSProperties = { marginTop: '2px', fontSize: '9px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' };
