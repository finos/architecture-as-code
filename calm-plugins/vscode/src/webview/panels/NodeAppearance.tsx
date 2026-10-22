import React, { useEffect, useRef, useState } from 'react';
import type { NodeStyleOverride } from '../utils/standard-node-style';
import { THEME_BG_FALLBACK, THEME_TEXT_FALLBACK, cssColorToHex } from '../canvas/theme-colors';
import type { NodeColours } from '../canvas/node-colours';

/**
 * A CSS colour as `#rrggbb`, for `<input type="color">`. Theme colours are variables or
 * `color-mix()`, so a hidden element resolves them. VS Code changes the theme class on `body`
 * and the colour variables on `html`, so the value is read again when either changes.
 */
function useResolvedHex(cssColor: string, fallback: string): string {
    const [hex, setHex] = useState(fallback);
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const read = () => {
            const probe = document.createElement('span');
            probe.style.display = 'none';
            probe.style.color = cssColor;
            document.body.appendChild(probe);
            const computed = getComputedStyle(probe).color;
            probe.remove();
            setHex(cssColorToHex(computed, fallback));
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
        return () => observer.disconnect();
    }, [cssColor, fallback]);
    return hex;
}

interface NodeAppearanceProps {
    /** Current overrides from the node's `metadata['standard-node-style']` (undefined = defaults). */
    style: NodeStyleOverride | undefined;
    /** Persist new overrides, or `undefined` to reset the node to its default look. */
    onUpdate: (style: NodeStyleOverride | undefined) => void;
    /** The colours the node has without overrides, as CSS values. The colour inputs start from these. */
    defaults: NodeColours;
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
    defaults,
    readonly = false,
}: NodeAppearanceProps) {
    const [bg, setBg] = useState(style?.background ?? '');
    const [text, setText] = useState(style?.text ?? '');
    const defaultBg = useResolvedHex(defaults.background, THEME_BG_FALLBACK);
    const defaultText = useResolvedHex(defaults.text, THEME_TEXT_FALLBACK);
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
                        value={bg || defaultBg}
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
                        value={text || defaultText}
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
