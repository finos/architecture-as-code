import React, { useState } from 'react';
import {
    buildBuildingBlockDoc,
    generateId,
    type ControlEntry,
    type ControlValidation,
    type ValidationType,
} from './building-block-doc';

interface BuildingBlockCreatorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (nodeJson: string, fileName: string) => void;
}

const NODE_TYPES = ['service', 'database', 'network', 'webclient', 'actor', 'system', 'ecosystem', 'ldap', 'data-asset'];

/**
 * Authoring modal for governed building blocks ("building blocks"). Mirrors the
 * Svelte calm-canvas's BuildingBlockCreator: collects a node definition
 * plus controls (with optional pattern / allowed-values validation) and emits a
 * CALM document that the extension writes to `building-blocks/`.
 */
export function BuildingBlockCreator({ visible, onClose, onSave }: Readonly<BuildingBlockCreatorProps>) {
    const [nodeName, setNodeName] = useState('');
    const [nodeType, setNodeType] = useState('service');
    const [nodeDescription, setNodeDescription] = useState('');
    const [controls, setControls] = useState<ControlEntry[]>([]);

    if (!visible) return null;

    const addControl = () => setControls((c) => [...c, { id: '', description: '', requirementUrl: '', validation: { type: 'none' } }]);
    const removeControl = (index: number) => setControls((c) => c.filter((_, i) => i !== index));
    const updateControl = (index: number, field: keyof ControlEntry, value: unknown) =>
        setControls((c) => c.map((ctrl, i) => (i === index ? { ...ctrl, [field]: value } : ctrl)));
    const updateValidation = (index: number, validation: ControlValidation) =>
        setControls((c) => c.map((ctrl, i) => (i === index ? { ...ctrl, validation } : ctrl)));

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
                            <button onClick={addControl} style={addBtnStyle}>+ Add Control</button>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', margin: '0 0 10px' }}>
                            Each control defines a configuration requirement that consuming architectures must fulfill.
                        </p>

                        {controls.map((ctrl, idx) => (
                            <div key={idx} style={controlCardStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', fontFamily: 'monospace' }}>#{idx + 1}</span>
                                    <button onClick={() => removeControl(idx)} style={closeBtnStyle}>&times;</button>
                                </div>
                                <Field label="Control ID">
                                    <input type="text" value={ctrl.id} onChange={(e) => updateControl(idx, 'id', e.target.value)}
                                        placeholder={generateId(ctrl.description || 'control-name')} style={inputStyle} />
                                </Field>
                                <Field label="Description">
                                    <input type="text" value={ctrl.description} onChange={(e) => updateControl(idx, 'description', e.target.value)} style={inputStyle} />
                                </Field>
                                <Field label="Requirement URL">
                                    <input type="text" value={ctrl.requirementUrl} onChange={(e) => updateControl(idx, 'requirementUrl', e.target.value)}
                                        placeholder="standards/tls-policy.md" style={inputStyle} />
                                </Field>
                                <Field label="Validation">
                                    <select value={ctrl.validation.type}
                                        onChange={(e) => updateValidation(idx, { ...ctrl.validation, type: e.target.value as ValidationType })} style={inputStyle}>
                                        <option value="none">None</option>
                                        <option value="pattern">Pattern (regex)</option>
                                        <option value="allowed-values">Allowed values</option>
                                    </select>
                                </Field>
                                {ctrl.validation.type === 'pattern' && (
                                    <>
                                        <Field label="Pattern">
                                            <input type="text" value={ctrl.validation.pattern ?? ''}
                                                onChange={(e) => updateValidation(idx, { ...ctrl.validation, pattern: e.target.value })} placeholder="^TLS1\\.[23]$" style={inputStyle} />
                                        </Field>
                                        <Field label="Example">
                                            <input type="text" value={ctrl.validation.example ?? ''}
                                                onChange={(e) => updateValidation(idx, { ...ctrl.validation, example: e.target.value })} style={inputStyle} />
                                        </Field>
                                    </>
                                )}
                                {ctrl.validation.type === 'allowed-values' && (
                                    <Field label="Allowed values (comma-separated)">
                                        <input type="text" value={(ctrl.validation.allowedValues ?? []).join(', ')}
                                            onChange={(e) => updateValidation(idx, { ...ctrl.validation, allowedValues: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                                            placeholder="TLS1.2, TLS1.3" style={inputStyle} />
                                    </Field>
                                )}
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
