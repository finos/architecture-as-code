import React, { useCallback, useEffect, useState } from 'react';
import type {
    ControlBrowseEntry,
    ControlBrowseGroup,
} from '../../extension/services/control-asset-service';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';
import { makeControlMapKey } from '../../extension/services/control-curie';
import {
    requestControlBrowse,
    requestControlsForDomain,
} from '../stores/sync-bridge';

const LOCAL_DOMAIN = 'Local';

type DomainStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface ControlPickerProps {
    visible: boolean;
    onClose: () => void;
    onAttach: (ref: string, parsed: ParsedRequirement) => void;
    existingControlKeys: Set<string>;
}

function rowKey(domain: string, controlName: string): string {
    return `${domain}::${controlName}`;
}

/** Build the reference string the extension will classify and resolve. */
function buildRef(entry: ControlBrowseEntry): string {
    if (entry.source === 'local') return entry.requirementRef ?? '';
    // Unversioned CURIE — the resolver auto-fetches the latest version from Hub.
    return `${entry.domain}:controls:${entry.controlName}`;
}

export function ControlPicker({
    visible,
    onClose,
    onAttach,
    existingControlKeys,
}: Readonly<ControlPickerProps>) {
    const [groups, setGroups] = useState<ControlBrowseGroup[]>([]);
    const [browseError, setBrowseError] = useState<string | null>(null);
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [domainStatus, setDomainStatus] = useState<Record<string, DomainStatus>>({});
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!visible) return;
        setBrowseError(null);
        requestControlBrowse((result) => {
            if (result.ok) {
                setGroups(result.groups);
                // Local group is ready immediately.
                setExpandedDomains(new Set([LOCAL_DOMAIN]));
                setDomainStatus({ [LOCAL_DOMAIN]: 'loaded' });
            } else {
                setBrowseError(result.error);
            }
        });
    }, [visible]);

    const loadDomain = useCallback((domain: string) => {
        setDomainStatus((s) => ({ ...s, [domain]: 'loading' }));
        requestControlsForDomain(domain, (result) => {
            if (result.ok) {
                setGroups((gs) =>
                    gs.map((g) => (g.domain === domain ? result.group : g))
                );
                setDomainStatus((s) => ({
                    ...s,
                    [domain]: result.group.error ? 'error' : 'loaded',
                }));
            } else {
                setGroups((gs) =>
                    gs.map((g) =>
                        g.domain === domain ? { ...g, error: result.error } : g
                    )
                );
                setDomainStatus((s) => ({ ...s, [domain]: 'error' }));
            }
        });
    }, []);

    const toggleDomain = useCallback(
        (domain: string) => {
            setExpandedDomains((prev) => {
                const next = new Set(prev);
                if (next.has(domain)) {
                    next.delete(domain);
                } else {
                    next.add(domain);
                    if (
                        domain !== LOCAL_DOMAIN &&
                        (domainStatus[domain] ?? 'idle') === 'idle'
                    ) {
                        loadDomain(domain);
                    }
                }
                return next;
            });
        },
        [domainStatus, loadDomain]
    );

    const attach = useCallback(
        (entry: ControlBrowseEntry) => {
            const ref = buildRef(entry);
            if (!ref) return;
            // Build a minimal ParsedRequirement from browse metadata — same
            // pattern as building-block drop. Full property enrichment happens
            // later via the webview enrichment flow.
            const parsed: ParsedRequirement = {
                identity: {
                    controlId: entry.controlName,
                    name: entry.title,
                    description: entry.description,
                },
                properties: {},
            };
            onAttach(ref, parsed);
            onClose();
        },
        [onAttach, onClose]
    );

    if (!visible) return null;

    const filterEntry = (entry: ControlBrowseEntry): boolean => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            entry.title.toLowerCase().includes(q) ||
            entry.controlName.toLowerCase().includes(q) ||
            entry.description.toLowerCase().includes(q)
        );
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Browse Controls</h3>
                    <button onClick={onClose} style={closeBtnStyle}>&times;</button>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search loaded controls..."
                    style={searchStyle}
                />
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {browseError && (
                        <div style={errorBannerStyle}>Failed to browse controls: {browseError}</div>
                    )}
                    {groups.map((group) => {
                        const isLocal = group.domain === LOCAL_DOMAIN;
                        const expanded = expandedDomains.has(group.domain);
                        const status = domainStatus[group.domain] ?? 'idle';
                        const visibleControls = group.controls.filter(filterEntry);
                        return (
                            <div key={group.domain} style={{ marginBottom: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => toggleDomain(group.domain)}
                                    style={domainHeaderStyle}
                                >
                                    <span style={{ fontSize: '8px', transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>&#9654;</span>
                                    {isLocal ? (
                                        <span style={localBadgeStyle}>Local</span>
                                    ) : (
                                        <span style={{ fontSize: '11px' }}>&#9729;</span>
                                    )}
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{group.domain}</span>
                                </button>
                                {expanded && (
                                    <div style={{ paddingLeft: '10px' }}>
                                        {status === 'loading' && (
                                            <div style={hintStyle}>Loading…</div>
                                        )}
                                        {group.error && (
                                            <div style={errorBannerStyle}>{group.error}</div>
                                        )}
                                        {status !== 'loading' && !group.error && visibleControls.length === 0 && (
                                            <div style={hintStyle}>No controls</div>
                                        )}
                                        {visibleControls.map((entry) => {
                                            const key = rowKey(entry.domain, entry.controlName);
                                            const ref = buildRef(entry);
                                            const mapKey = ref ? makeControlMapKey(ref) : '';
                                            const duplicate = !!mapKey && existingControlKeys.has(mapKey);
                                            return (
                                                <div key={key} style={rowStyle}>
                                                    <div style={rowHeaderStyle}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{entry.title}</span>
                                                            <span style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', fontFamily: 'monospace' }}>{entry.controlName}</span>
                                                            {entry.description && (
                                                                <span style={{ fontSize: '10px', color: 'var(--calm-fg-muted)' }}>{entry.description}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button
                                                            type="button"
                                                            disabled={duplicate}
                                                            onClick={() => attach(entry)}
                                                            style={{ ...attachBtnStyle, opacity: duplicate ? 0.5 : 1 }}
                                                        >
                                                            Attach
                                                        </button>
                                                    </div>
                                                    {duplicate && (
                                                        <div style={warnBannerStyle}>Already attached</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {groups.length === 0 && !browseError && (
                        <div style={hintStyle}>Loading controls…</div>
                    )}
                </div>
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
    width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    background: 'var(--calm-bg)', border: '1px solid var(--calm-border)', borderRadius: '6px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};
const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', borderBottom: '1px solid var(--calm-border)',
};
const closeBtnStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '18px',
};
const searchStyle: React.CSSProperties = {
    margin: '10px 14px', padding: '6px 8px', fontSize: '12px',
    background: 'var(--calm-bg-secondary)', color: 'var(--calm-fg)',
    border: '1px solid var(--calm-border)', borderRadius: '4px',
};
const domainHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
    padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg)',
};
const localBadgeStyle: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    padding: '1px 6px', borderRadius: '8px', background: '#16a34a', color: '#fff',
};
const rowStyle: React.CSSProperties = {
    border: '1px solid var(--calm-border)', borderRadius: '4px', padding: '6px 8px', marginBottom: '4px',
    display: 'flex', flexDirection: 'column', gap: '4px',
};
const rowHeaderStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--calm-fg)', padding: 0, textAlign: 'left',
};
const attachBtnStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, padding: '3px 10px', cursor: 'pointer',
    background: 'var(--calm-accent, #2563eb)', color: '#fff', border: 'none', borderRadius: '4px',
};
const hintStyle: React.CSSProperties = {
    fontSize: '11px', color: 'var(--calm-fg-muted)', fontStyle: 'italic', padding: '4px',
};
const warnBannerStyle: React.CSSProperties = {
    fontSize: '10px', color: '#92400e', background: '#fef3c7',
    border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 6px',
};
const errorBannerStyle: React.CSSProperties = {
    fontSize: '10px', color: '#991b1b', background: '#fee2e2',
    border: '1px solid #fecaca', borderRadius: '4px', padding: '4px 6px',
};
