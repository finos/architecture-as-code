import React, { useRef, useState } from 'react';
import type { NodeStyleOverride } from '../utils/building-block-style';

const DEFAULT_BG = '#f8fafc';
const DEFAULT_TEXT = '#1e293b';

interface NodeAppearanceProps {
    /** Current overrides from the node's `metadata['building-block-style']` (undefined = defaults). */
    style: NodeStyleOverride | undefined;
    /** Persist new overrides, or `undefined` to reset the node to its default look. */
    onUpdate: (style: NodeStyleOverride | undefined) => void;
    readonly?: boolean;
}

/**
 * Per-node appearance editor: background + text colour with a reset. Local state drives the
 * inputs for a responsive feel while upstream persistence is debounced to avoid a file write on
 * every colour-picker tick. The parent remounts this per node (via `key`), so local state always
 * reflects the selected node.
 */
export function NodeAppearance({
    style,
    onUpdate,
    readonly = false,
}: NodeAppearanceProps) {
    const [bg, setBg] = useState(style?.background ?? '');
    const [text, setText] = useState(style?.text ?? '');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const push = (nextBg: string, nextText: string) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const cleaned: NodeStyleOverride = {};
            if (nextBg) cleaned.background = nextBg;
            if (nextText) cleaned.text = nextText;
            onUpdate(Object.keys(cleaned).length ? cleaned : undefined);
        }, 150);
    };

    const onBg = (v: string) => {
        setBg(v);
        push(v, text);
    };
    const onText = (v: string) => {
        setText(v);
        push(bg, v);
    };
    const reset = () => {
        if (timer.current) clearTimeout(timer.current);
        setBg('');
        setText('');
        onUpdate(undefined);
    };

    const hasOverride = !!(bg || text);

    return (
        <div style={sectionStyle}>
            <span style={sectionLabel}>Appearance</span>

            <div style={rowStyle}>
                <span style={fieldLabel}>Background</span>
                <div style={swatchRow}>
                    <input
                        type="color"
                        disabled={readonly}
                        value={bg || DEFAULT_BG}
                        onChange={(e) => onBg(e.target.value)}
                        style={colorSwatch}
                        title="Background colour"
                    />
                    <input
                        type="text"
                        disabled={readonly}
                        value={bg}
                        placeholder="default"
                        onChange={(e) => onBg(e.target.value.trim())}
                        style={hexInput}
                    />
                </div>
            </div>

            <div style={rowStyle}>
                <span style={fieldLabel}>Text</span>
                <div style={swatchRow}>
                    <input
                        type="color"
                        disabled={readonly}
                        value={text || DEFAULT_TEXT}
                        onChange={(e) => onText(e.target.value)}
                        style={colorSwatch}
                        title="Text colour"
                    />
                    <input
                        type="text"
                        disabled={readonly}
                        value={text}
                        placeholder="default"
                        onChange={(e) => onText(e.target.value.trim())}
                        style={hexInput}
                    />
                </div>
            </div>

            {!readonly && hasOverride && (
                <button onClick={reset} style={resetBtn}>
                    Reset to default
                </button>
            )}
        </div>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderTop: '1px solid var(--calm-border)',
};
const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    color: 'var(--calm-fg-muted)',
    display: 'block',
    marginBottom: '8px',
};
const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
};
const fieldLabel: React.CSSProperties = { fontSize: '11px', color: 'var(--calm-fg)' };
const swatchRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
};
const colorSwatch: React.CSSProperties = {
    width: '28px',
    height: '22px',
    padding: 0,
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    background: 'transparent',
    cursor: 'pointer',
};
const hexInput: React.CSSProperties = {
    width: '80px',
    padding: '4px 6px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg-input)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    outline: 'none',
};
const resetBtn: React.CSSProperties = {
    marginTop: '4px',
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--calm-link)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 0',
};
