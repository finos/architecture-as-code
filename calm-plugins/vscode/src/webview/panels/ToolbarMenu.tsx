import React, { useState, useRef, useEffect } from 'react';

export interface ToolbarMenuItem {
    label: string;
    onClick: () => void;
    color?: string;
}

/**
 * Overflow ("⋮") menu for secondary toolbar actions. Keeps the toolbar
 * uncluttered by grouping less-frequent actions behind a single vertical
 * three-dots button with a dropdown.
 */
export function ToolbarMenu({ items }: Readonly<{ items: ToolbarMenuItem[] }>) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (items.length === 0) return null;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className="fid-toolbar-btn"
                title="More actions"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                style={{ padding: '3px 7px', border: '1px solid #555', borderRadius: '4px' }}
            >
                <span style={dotsStyle}>
                    <span style={dotStyle} />
                    <span style={dotStyle} />
                    <span style={dotStyle} />
                </span>
            </button>
            {open && (
                <div role="menu" style={menuStyle}>
                    {items.map((item) => (
                        <button
                            key={item.label}
                            role="menuitem"
                            className="fid-menu-item"
                            style={item.color ? { color: item.color } : undefined}
                            onClick={() => { item.onClick(); setOpen(false); }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: 'var(--calm-bg-secondary)',
    border: '1px solid var(--calm-border-heavy)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    minWidth: '170px',
    zIndex: 1000,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
};

const dotsStyle: React.CSSProperties = { display: 'inline-flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center', height: '15px' };
const dotStyle: React.CSSProperties = { width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' };
