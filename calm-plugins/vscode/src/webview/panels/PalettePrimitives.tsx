import React from 'react';
import { theme } from '../canvas/theme-colors';

export function Section({ title, collapsed, onToggle, badge, borderColor, children }: {
    title: string;
    collapsed: boolean;
    onToggle: () => void;
    badge?: string;
    borderColor?: string;
    children: React.ReactNode;
}) {
    const isHub = badge === 'Hub';
    const sectionStyle: React.CSSProperties = {
        marginBottom: '4px',
        ...(badge ? { borderLeft: `2px solid ${theme.green}`, marginLeft: '4px', background: `color-mix(in srgb, ${theme.green} 12%, transparent)` } : {}),
        ...(borderColor && !badge ? { borderLeft: `2px solid ${borderColor}`, marginLeft: '4px' } : {}),
    };
    return (
        <div style={sectionStyle}>
            <button onClick={onToggle} style={groupNameStyle}>
                <span style={{ fontSize: '10px', display: 'inline-block', transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>▾</span>
                {badge && <span style={isHub ? hubBadgeStyle : wsBadgeStyle}>{badge}</span>}
                {borderColor && !badge && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor, flexShrink: 0 }} />}
                {title}
            </button>
            {!collapsed && children}
        </div>
    );
}

export function PaletteItem({ icon, iconHtml, label, onDragStart, title, style }: {
    icon?: string;
    iconHtml?: string;
    label: string;
    onDragStart: (event: React.DragEvent) => void;
    title?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div draggable onDragStart={onDragStart} style={{ ...itemStyle, ...style }} title={title}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', flexShrink: 0 }}>
                {iconHtml ? <span dangerouslySetInnerHTML={{ __html: iconHtml }} /> : <span style={{ fontSize: '14px' }}>{icon}</span>}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--calm-fg)' }}>{label}</span>
        </div>
    );
}

export function CollapsibleSub({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(true);
    return (
        <div>
            <button onClick={() => setOpen(!open)} style={{ ...subgroupStyle, fontSize: '10px', paddingLeft: '16px', color, cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '8px', transition: 'transform 0.15s', transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>
                {label}
            </button>
            {open && children}
        </div>
    );
}

export function humanizeNs(slug: string): string {
    return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export const hubBlockIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';

export const subgroupStyle: React.CSSProperties = { padding: '3px 12px 3px 20px', fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', textTransform: 'capitalize' };

const groupNameStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--calm-fg-muted)', background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' };
const wsBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: theme.green, color: theme.bg, letterSpacing: '0.5px' };
const hubBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: theme.green, color: theme.bg, letterSpacing: '0.5px' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'grab', borderRadius: '4px', margin: '1px 6px' };