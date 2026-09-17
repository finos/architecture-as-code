import React, { useMemo, useState } from 'react';
import {
    buildControlRequirement,
    validateControlRequirementInput,
    slugify,
    type ControlPropertyInput,
    type ControlPropertyType,
    type ControlRequirementInput,
} from './control-doc';
import { requestSaveControl } from '../stores/sync-bridge';

interface ControlCreatorProps {
    visible: boolean;
    onClose: () => void;
}

const PROPERTY_TYPES: ControlPropertyType[] = ['string', 'boolean', 'number', 'integer', 'enum'];

export function ControlCreator({ visible, onClose }: Readonly<ControlCreatorProps>) {
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [domain, setDomain] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [properties, setProperties] = useState<ControlPropertyInput[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const input: ControlRequirementInput = useMemo(
        () => ({ slug, domain, name, description, properties }),
        [slug, domain, name, description, properties]
    );
    const errors = useMemo(() => validateControlRequirementInput(input), [input]);
    const preview = useMemo(
        () => (errors.length === 0 ? buildControlRequirement(input) : null),
        [errors, input]
    );

    if (!visible) return null;

    const setNameAndSlug = (value: string) => {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    };

    const addProperty = () =>
        setProperties((p) => [...p, { name: '', type: 'string', required: false }]);
    const removeProperty = (index: number) =>
        setProperties((p) => p.filter((_, i) => i !== index));
    const updateProperty = (index: number, patch: Partial<ControlPropertyInput>) =>
        setProperties((p) => p.map((prop, i) => (i === index ? { ...prop, ...patch } : prop)));

    const reset = () => {
        setSlug(''); setSlugTouched(false); setDomain(''); setName('');
        setDescription(''); setProperties([]); setSaveError(null); setSaving(false);
    };

    const handleSave = () => {
        if (!preview) return;
        setSaving(true);
        setSaveError(null);
        requestSaveControl(preview.fileName, preview.json, (result) => {
            setSaving(false);
            if (result.ok) {
                reset();
                onClose();
            } else if (result.error !== 'cancelled') {
                setSaveError(result.error);
            }
        });
    };

    return (
        <div style={overlayStyle} role="dialog" aria-label="Create Control Requirement">
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--calm-fg)' }}>Create Control Requirement</h3>
                    <button onClick={onClose} style={closeBtnStyle}>&times;</button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Form */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', borderRight: '1px solid var(--calm-border)' }}>
                        <Field label="Domain">
                            <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="platform" style={inputStyle} />
                        </Field>
                        <Field label="Slug">
                            <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="resiliency-tier" style={inputStyle} />
                        </Field>
                        <Field label="Display Name">
                            <input type="text" value={name} onChange={(e) => setNameAndSlug(e.target.value)} placeholder="Resiliency Tier" style={inputStyle} />
                        </Field>
                        <Field label="Description">
                            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this control requires..." style={{ ...inputStyle, resize: 'vertical' }} />
                        </Field>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 6px' }}>
                            <h4 style={sectionTitleStyle}>Properties <span style={countStyle}>{properties.length}</span></h4>
                            <button onClick={addProperty} style={addBtnStyle}>+ Add Property</button>
                        </div>
                        {properties.map((prop, i) => (
                            <div key={i} style={propRowStyle}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input type="text" value={prop.name} onChange={(e) => updateProperty(i, { name: e.target.value })} placeholder="property-name" style={{ ...inputStyle, flex: 1 }} />
                                    <select value={prop.type} onChange={(e) => updateProperty(i, { type: e.target.value as ControlPropertyType })} style={{ ...inputStyle, width: '90px' }}>
                                        {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--calm-fg-muted)' }}>
                                        <input type="checkbox" checked={prop.required} onChange={(e) => updateProperty(i, { required: e.target.checked })} /> req
                                    </label>
                                    <button onClick={() => removeProperty(i)} style={removeBtnStyle}>&times;</button>
                                </div>
                                {prop.type === 'enum' && (
                                    <input type="text" value={(prop.enumValues ?? []).join(',')} onChange={(e) => updateProperty(i, { enumValues: e.target.value.split(',') })} placeholder="Comma-separated values" style={{ ...inputStyle, marginTop: '4px' }} />
                                )}
                                {prop.type === 'string' && (
                                    <input type="text" value={prop.pattern ?? ''} onChange={(e) => updateProperty(i, { pattern: e.target.value })} placeholder="Regex pattern (optional)" style={{ ...inputStyle, marginTop: '4px' }} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Preview */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--calm-bg-secondary)' }}>
                        <h4 style={sectionTitleStyle}>Preview</h4>
                        {errors.length > 0 ? (
                            <ul style={{ margin: '8px 0', paddingLeft: '18px' }}>
                                {errors.map((e, i) => <li key={i} style={{ fontSize: '11px', color: '#dc2626' }}>{e}</li>)}
                            </ul>
                        ) : (
                            <pre style={previewStyle}>{preview?.json}</pre>
                        )}
                    </div>
                </div>

                <div style={footerStyle}>
                    {saveError && <span style={{ fontSize: '11px', color: '#dc2626', marginRight: 'auto' }}>{saveError}</span>}
                    <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                    <button onClick={handleSave} disabled={errors.length > 0 || saving} style={{ ...saveBtnStyle, opacity: errors.length > 0 || saving ? 0.5 : 1 }}>
                        {saving ? 'Saving…' : 'Save Control'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
    return <div style={{ marginBottom: '10px' }}><div style={fieldLabelStyle}>{label}</div>{children}</div>;
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: '760px', maxWidth: '92vw', height: '78vh', display: 'flex', flexDirection: 'column', background: 'var(--calm-bg)', border: '1px solid var(--calm-border)', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--calm-border)' };
const footerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '1px solid var(--calm-border)' };
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '18px' };
const fieldLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '3px' };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' };
const countStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px', background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', marginLeft: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 7px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none', boxSizing: 'border-box' };
const propRowStyle: React.CSSProperties = { border: '1px solid var(--calm-border)', borderRadius: '4px', padding: '6px', marginBottom: '6px' };
const addBtnStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--calm-link)', background: 'none', border: '1px dashed var(--calm-link)', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px' };
const removeBtnStyle: React.CSSProperties = { width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' };
const previewStyle: React.CSSProperties = { fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--calm-fg)', margin: 0 };
const cancelBtnStyle: React.CSSProperties = { fontSize: '11px', padding: '5px 12px', cursor: 'pointer', background: 'var(--calm-bg-secondary)', color: 'var(--calm-fg)', border: '1px solid var(--calm-border)', borderRadius: '4px' };
const saveBtnStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 600, padding: '5px 12px', cursor: 'pointer', background: 'var(--calm-accent, #2563eb)', color: '#fff', border: 'none', borderRadius: '4px' };
