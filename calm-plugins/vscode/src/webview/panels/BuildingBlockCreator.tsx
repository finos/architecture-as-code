import React, { useState } from 'react';
import {
    buildBuildingBlockDoc,
    type AttachedControl,
} from './building-block-doc';
import { makeControlMapKey } from '../../extension/services/control-curie';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';

interface BuildingBlockCreatorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (nodeJson: string, fileName: string) => void;
    /** Opens the shared control picker, preserving the in-progress form. */
    onRequestBrowseControls?: (
        onAttach: (ref: string, parsed: ParsedRequirement) => void,
        existingKeys: Set<string>
    ) => void;
}

const NODE_TYPES = ['service', 'database', 'network', 'webclient', 'actor', 'system', 'ecosystem', 'ldap', 'data-asset'];

/**
 * Authoring modal for governed building blocks ("building blocks"). Collects a
 * node definition plus controls attached via the shared control picker, and
 * emits a CALM document that the extension writes to `building-blocks/`.
 */
export function BuildingBlockCreator({ visible, onClose, onSave, onRequestBrowseControls }: Readonly<BuildingBlockCreatorProps>) {
    const [nodeName, setNodeName] = useState('');
    const [nodeType, setNodeType] = useState('service');
    const [nodeDescription, setNodeDescription] = useState('');
    const [controls, setControls] = useState<AttachedControl[]>([]);

    if (!visible) return null;

    const removeControl = (ref: string) => setControls((c) => c.filter((ctrl) => ctrl.ref !== ref));

    const browseControls = () => {
        const existingKeys = new Set(controls.map((c) => makeControlMapKey(c.ref)));
        onRequestBrowseControls?.((ref, parsed) => {
            setControls((c) =>
                c.some((existing) => existing.ref === ref) ? c : [...c, { ref, parsed }]
            );
        }, existingKeys);
    };

    const resetForm = () => {
        setNodeName('');
        setNodeType('service');
        setNodeDescription('');
        setControls([]);
    };

    const handleSave = () => {
        if (!nodeName.trim()) return;
        const { json, fileName } = buildBuildingBlockDoc({
            name: nodeName,
            nodeType,
            description: nodeDescription,
            controls,
        });
        onSave(json, fileName);
        resetForm();
        onClose();
    };

    return (
        <div style={overlayStyle} role="dialog" aria-label="Create Building Block">
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--calm-fg)' }}>Create Building Block</h3>
                    <button onClick={onClose} style={closeBtnStyle}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    <section style={{ marginBottom: '18px' }}>
                        <h4 style={sectionTitleStyle}>Node Definition</h4>
                        <Field label="Name">
                            <input type="text" value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="e.g. API Gateway" style={inputStyle} />
                        </Field>
                        <Field label="Type">
                            <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} style={inputStyle}>
                                {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Description">
                            <textarea rows={3} value={nodeDescription} onChange={(e) => setNodeDescription(e.target.value)}
                                placeholder="What this node represents and its governance requirements..." style={{ ...inputStyle, resize: 'vertical' }} />
                        </Field>
                    </section>

                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <h4 style={sectionTitleStyle}>Controls <span style={countStyle}>{controls.length}</span></h4>
                            <button onClick={browseControls} style={addBtnStyle}>Browse Controls…</button>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', margin: '0 0 10px' }}>
                            Attach control requirements that consuming architectures must fulfill.
                        </p>

                        {controls.length === 0 && (
                            <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', fontStyle: 'italic' }}>No controls attached.</p>
                        )}
                        {controls.map((ctrl) => (
                            <div key={ctrl.ref} style={controlCardStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' }}>{ctrl.parsed.identity.name}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctrl.ref}</span>
                                    </div>
                                    <button onClick={() => removeControl(ctrl.ref)} style={closeBtnStyle}>&times;</button>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>

                <div style={footerStyle}>
                    <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                    <button onClick={handleSave} disabled={!nodeName.trim()} style={{ ...saveBtnStyle, opacity: nodeName.trim() ? 1 : 0.5 }}>Save Building Block</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
    return (
        <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--calm-fg-muted)', marginBottom: '3px' }}>{label}</label>
            {children}
        </div>
    );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'var(--calm-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: '560px', maxWidth: '90vw', maxHeight: '85vh', background: 'var(--calm-bg)', borderRadius: '12px', border: '1px solid var(--calm-border-heavy)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--calm-border)' };
const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--calm-border)' };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' };
const countStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--calm-fg-muted)', fontWeight: 400 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-heavy)', borderRadius: '4px', color: 'var(--calm-fg)', fontSize: '12px', padding: '6px 8px' };
const controlCardStyle: React.CSSProperties = { border: '1px solid var(--calm-border)', borderRadius: '8px', padding: '10px', marginBottom: '8px', background: 'var(--calm-bg-secondary)' };
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 };
const addBtnStyle: React.CSSProperties = { border: '1px solid var(--calm-border-heavy)', background: 'var(--calm-bg-input)', color: 'var(--calm-fg)', borderRadius: '4px', fontSize: '11px', padding: '4px 8px', cursor: 'pointer' };
const cancelBtnStyle: React.CSSProperties = { border: '1px solid var(--calm-border-heavy)', background: 'transparent', color: 'var(--calm-fg)', borderRadius: '4px', fontSize: '12px', padding: '6px 14px', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { border: 'none', background: 'var(--calm-btn-bg)', color: 'var(--calm-btn-fg)', borderRadius: '4px', fontSize: '12px', padding: '6px 14px', cursor: 'pointer' };
