import { THEME } from './theme';
import { FiShield, FiExternalLink, FiAlertCircle } from 'react-icons/fi';

// Types for CALM control data
export interface ControlRequirementConfig {
    appliesTo?: {
        nodes?: string[];
        relationships?: string[];
    };
    [key: string]: unknown;
}

export interface ControlRequirement {
    'requirement-url'?: string;
    'config-url'?: string;
    config?: ControlRequirementConfig;
}

export interface Control {
    description?: string;
    requirements?: ControlRequirement[];
    'aigf-mitigations'?: string[];
    'aigf-risks'?: string[];
    // Extended properties added during extraction
    appliesTo?: string;
    nodeName?: string;
    relationshipDescription?: string;
    appliesToType?: 'node' | 'relationship';
}

interface ControlsPanelProps {
    controls: Record<string, Control>;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
}

export function ControlsPanel({ controls, onNodeClick, onControlClick }: ControlsPanelProps) {
    if (!controls || Object.keys(controls).length === 0) return null;

    const controlEntries = Object.entries(controls);

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                background: THEME.colors.card,
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.backgroundSecondary,
                }}
            >
                <FiShield style={{ width: '16px', height: '16px', color: THEME.colors.accent }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: THEME.colors.foreground }}>CALM Controls</span>
                <span
                    style={{
                        marginLeft: 'auto',
                        fontSize: '12px',
                        color: THEME.colors.muted,
                    }}
                >
                    {controlEntries.length} {controlEntries.length === 1 ? 'control' : 'controls'}
                </span>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {controlEntries.map(([controlId, control]) => (
                        <div
                            key={controlId}
                            onClick={() => onControlClick?.(controlId)}
                            style={{
                                borderRadius: '8px',
                                border: `1px solid ${THEME.colors.border}`,
                                background: THEME.colors.card,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = `${THEME.colors.accent}80`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = THEME.colors.border;
                            }}
                            title="Click to view control details"
                        >
                            {/* Control Header */}
                            <div
                                style={{
                                    padding: '12px',
                                    background: `${THEME.colors.success}10`,
                                    borderBottom: `1px solid ${THEME.colors.border}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <FiShield style={{ width: '14px', height: '14px', color: THEME.colors.success }} />
                                    <span
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            color: THEME.colors.muted,
                                        }}
                                    >
                                        {controlId}
                                    </span>
                                </div>

                                {control.nodeName && (
                                    <div style={{ marginTop: '6px', marginBottom: '8px' }}>
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (control.appliesTo) {
                                                    onNodeClick?.(control.appliesTo);
                                                }
                                            }}
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: THEME.colors.backgroundSecondary,
                                                border: `1px solid ${THEME.colors.border}`,
                                                fontSize: '11px',
                                                color: THEME.colors.foreground,
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = `${THEME.colors.accent}20`;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                                            }}
                                        >
                                            Node: {control.nodeName}
                                        </span>
                                    </div>
                                )}

                                {control.relationshipDescription && (
                                    <div style={{ marginTop: '6px', marginBottom: '8px' }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: 'transparent',
                                                border: `1px solid ${THEME.colors.border}`,
                                                fontSize: '11px',
                                                color: THEME.colors.foreground,
                                            }}
                                        >
                                            Relationship: {control.relationshipDescription}
                                        </span>
                                    </div>
                                )}

                                {control.description && (
                                    <p style={{ fontSize: '12px', color: THEME.colors.foreground, margin: '4px 0 0 0' }}>
                                        {control.description}
                                    </p>
                                )}
                            </div>

                            {/* Requirements */}
                            {control.requirements && control.requirements.length > 0 && (
                                <div style={{ padding: '12px' }}>
                                    <h4
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            color: THEME.colors.muted,
                                            textTransform: 'uppercase',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Requirements
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {control.requirements.map((req, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    borderRadius: '6px',
                                                    background: THEME.colors.backgroundSecondary,
                                                    border: `1px solid ${THEME.colors.border}`,
                                                    padding: '8px',
                                                }}
                                            >
                                                {req['requirement-url'] && (
                                                    <a
                                                        href={req['requirement-url']}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '11px',
                                                            color: THEME.colors.info,
                                                            textDecoration: 'none',
                                                            marginBottom: '4px',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.textDecoration = 'underline';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.textDecoration = 'none';
                                                        }}
                                                    >
                                                        <FiExternalLink style={{ width: '12px', height: '12px' }} />
                                                        <span style={{ wordBreak: 'break-all' }}>{req['requirement-url']}</span>
                                                    </a>
                                                )}

                                                {req['config-url'] && (
                                                    <a
                                                        href={req['config-url']}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '11px',
                                                            color: THEME.colors.info,
                                                            textDecoration: 'none',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.textDecoration = 'underline';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.textDecoration = 'none';
                                                        }}
                                                    >
                                                        <FiExternalLink style={{ width: '12px', height: '12px' }} />
                                                        <span>Config: {req['config-url']}</span>
                                                    </a>
                                                )}

                                                {req.config && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <span
                                                            style={{
                                                                display: 'block',
                                                                fontSize: '11px',
                                                                fontWeight: 500,
                                                                color: THEME.colors.muted,
                                                                marginBottom: '4px',
                                                            }}
                                                        >
                                                            Configuration:
                                                        </span>

                                                        {/* Applies To section */}
                                                        {req.config.appliesTo && (
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <span style={{ fontSize: '11px', color: THEME.colors.muted }}>
                                                                    Applies to:
                                                                </span>
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexWrap: 'wrap',
                                                                        gap: '4px',
                                                                        marginTop: '4px',
                                                                    }}
                                                                >
                                                                    {req.config.appliesTo.nodes?.map((nodeId) => (
                                                                        <span
                                                                            key={nodeId}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onNodeClick?.(nodeId);
                                                                            }}
                                                                            style={{
                                                                                display: 'inline-block',
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                                background: THEME.colors.card,
                                                                                border: `1px solid ${THEME.colors.border}`,
                                                                                fontSize: '10px',
                                                                                color: THEME.colors.foreground,
                                                                                cursor: 'pointer',
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.background = `${THEME.colors.accent}20`;
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.background = THEME.colors.card;
                                                                            }}
                                                                        >
                                                                            {nodeId}
                                                                        </span>
                                                                    ))}
                                                                    {req.config.appliesTo.relationships?.map((relId) => (
                                                                        <span
                                                                            key={relId}
                                                                            style={{
                                                                                display: 'inline-block',
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                                background: 'transparent',
                                                                                border: `1px solid ${THEME.colors.border}`,
                                                                                fontSize: '10px',
                                                                                color: THEME.colors.foreground,
                                                                            }}
                                                                        >
                                                                            {relId}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Other config details */}
                                                        <pre
                                                            style={{
                                                                fontSize: '10px',
                                                                color: THEME.colors.foreground,
                                                                background: THEME.colors.card,
                                                                padding: '8px',
                                                                borderRadius: '4px',
                                                                overflow: 'auto',
                                                                maxHeight: '100px',
                                                                margin: 0,
                                                            }}
                                                        >
                                                            {JSON.stringify(
                                                                Object.fromEntries(
                                                                    Object.entries(req.config).filter(
                                                                        ([key]) => key !== 'appliesTo'
                                                                    )
                                                                ),
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AIGF Mappings */}
                            {(control['aigf-mitigations'] || control['aigf-risks']) && (
                                <div style={{ padding: '0 12px 12px 12px' }}>
                                    <div
                                        style={{
                                            borderRadius: '8px',
                                            background: `${THEME.colors.info}10`,
                                            border: `1px solid ${THEME.colors.info}30`,
                                            padding: '8px',
                                        }}
                                    >
                                        <h4
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                color: THEME.colors.foreground,
                                                marginBottom: '6px',
                                            }}
                                        >
                                            FINOS AIGF Mapping
                                        </h4>

                                        {control['aigf-mitigations'] && control['aigf-mitigations'].length > 0 && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '6px',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                <FiShield
                                                    style={{
                                                        width: '12px',
                                                        height: '12px',
                                                        color: THEME.colors.success,
                                                        marginTop: '2px',
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <div>
                                                    <span style={{ fontSize: '11px', color: THEME.colors.muted }}>
                                                        Mitigations:{' '}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            color: THEME.colors.success,
                                                        }}
                                                    >
                                                        {control['aigf-mitigations'].join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {control['aigf-risks'] && control['aigf-risks'].length > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                <FiAlertCircle
                                                    style={{
                                                        width: '12px',
                                                        height: '12px',
                                                        color: THEME.colors.warning,
                                                        marginTop: '2px',
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <div>
                                                    <span style={{ fontSize: '11px', color: THEME.colors.muted }}>Risks: </span>
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            color: THEME.colors.warning,
                                                        }}
                                                    >
                                                        {control['aigf-risks'].join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
