import { THEME } from './theme';
import { FiGitBranch, FiChevronRight, FiShield, FiAlertCircle } from 'react-icons/fi';

// Types for CALM flow data
export interface FlowTransition {
    'sequence-number': number;
    'relationship-unique-id': string;
    description?: string;
    direction?: string;
}

export interface AIGFGovernance {
    'mitigations-applied'?: string[];
    'risks-addressed'?: string[];
    'trust-boundaries-crossed'?: string[];
}

export interface Flow {
    'unique-id': string;
    name: string;
    description?: string;
    transitions?: FlowTransition[];
    'aigf-governance'?: AIGFGovernance;
}

interface FlowsPanelProps {
    flows: Flow[];
    onTransitionClick?: (relationshipId: string) => void;
}

export function FlowsPanel({ flows, onTransitionClick }: FlowsPanelProps) {
    if (!flows || flows.length === 0) return null;

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
                <FiGitBranch style={{ width: '16px', height: '16px', color: THEME.colors.accent }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: THEME.colors.foreground }}>
                    Business Flows
                </span>
                <span
                    style={{
                        marginLeft: 'auto',
                        fontSize: '12px',
                        color: THEME.colors.muted,
                    }}
                >
                    {flows.length} {flows.length === 1 ? 'flow' : 'flows'}
                </span>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {flows.map((flow) => (
                        <div
                            key={flow['unique-id']}
                            style={{
                                borderRadius: '8px',
                                border: `1px solid ${THEME.colors.border}`,
                                background: THEME.colors.card,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Flow Header */}
                            <div
                                style={{
                                    padding: '8px 12px',
                                    background: `${THEME.colors.accent}10`,
                                    borderBottom: `1px solid ${THEME.colors.border}`,
                                }}
                            >
                                <h3
                                    style={{
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        marginBottom: '2px',
                                        color: THEME.colors.foreground,
                                    }}
                                >
                                    {flow.name}
                                </h3>
                                {flow.description && (
                                    <p style={{ fontSize: '12px', color: THEME.colors.muted, margin: 0 }}>
                                        {flow.description}
                                    </p>
                                )}
                            </div>

                            {/* Transitions */}
                            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {flow.transitions?.map((transition, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => onTransitionClick?.(transition['relationship-unique-id'])}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            padding: '6px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = `${THEME.colors.accent}08`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <div
                                            style={{
                                                flexShrink: 0,
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: `${THEME.colors.accent}20`,
                                                color: THEME.colors.accent,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {transition['sequence-number']}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p
                                                style={{
                                                    fontSize: '12px',
                                                    color: THEME.colors.foreground,
                                                    margin: 0,
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {transition.description}
                                            </p>
                                            {transition['relationship-unique-id'] && (
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        fontFamily: 'monospace',
                                                        color: THEME.colors.muted,
                                                    }}
                                                >
                                                    {transition['relationship-unique-id']}
                                                </span>
                                            )}
                                        </div>
                                        <FiChevronRight
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                color: THEME.colors.muted,
                                                flexShrink: 0,
                                                opacity: 0.5,
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* AIGF Governance (if present) */}
                            {flow['aigf-governance'] && (
                                <div style={{ padding: '0 8px 8px 8px' }}>
                                    <div
                                        style={{
                                            borderRadius: '8px',
                                            background: `${THEME.colors.success}10`,
                                            border: `1px solid ${THEME.colors.success}30`,
                                            padding: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                marginBottom: '6px',
                                            }}
                                        >
                                            <FiShield style={{ width: '14px', height: '14px', color: THEME.colors.success }} />
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                                                AIGF Governance
                                            </span>
                                        </div>

                                        {flow['aigf-governance']['mitigations-applied'] &&
                                            flow['aigf-governance']['mitigations-applied'].length > 0 && (
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
                                                            {flow['aigf-governance']['mitigations-applied'].join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                        {flow['aigf-governance']['risks-addressed'] &&
                                            flow['aigf-governance']['risks-addressed'].length > 0 && (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '6px',
                                                        marginBottom: '4px',
                                                    }}
                                                >
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
                                                            {flow['aigf-governance']['risks-addressed'].join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                        {flow['aigf-governance']['trust-boundaries-crossed'] &&
                                            flow['aigf-governance']['trust-boundaries-crossed'].length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                    <div
                                                        style={{
                                                            width: '12px',
                                                            height: '12px',
                                                            marginTop: '2px',
                                                            flexShrink: 0,
                                                            border: `2px solid ${THEME.colors.info}`,
                                                            borderRadius: '2px',
                                                        }}
                                                    />
                                                    <div>
                                                        <span style={{ fontSize: '11px', color: THEME.colors.muted }}>
                                                            Boundaries:{' '}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: THEME.colors.info }}>
                                                            {flow['aigf-governance']['trust-boundaries-crossed'].join(', ')}
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
