import { ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { THEME } from '../theme';

export interface FlowTransition {
    sequence: number;
    flowName?: string;
    description?: string;
}

export interface EdgeControl {
    description?: string;
}

export interface Mitigation {
    id?: string;
    name?: string;
}

export interface Risk {
    id?: string;
    name?: string;
}

export interface EdgeTooltipProps {
    description: string;
    protocol?: string;
    direction?: string;
    flowTransitions: FlowTransition[];
    edgeControls: Record<string, EdgeControl>;
    controlsApplied: string[];
    mitigations: (string | Mitigation)[];
    risks: (string | Risk)[];
    labelX: number;
    labelY: number;
}

export function EdgeTooltip({
    description,
    protocol,
    direction,
    flowTransitions,
    edgeControls,
    controlsApplied,
    mitigations,
    risks,
    labelX,
    labelY,
}: EdgeTooltipProps) {
    return (
        <div
            style={{
                position: 'fixed',
                left: labelX,
                top: labelY + 40,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 10000,
            }}
        >
            <div
                style={{
                    background: THEME.colors.card,
                    border: `1px solid ${THEME.colors.border}`,
                    borderRadius: '8px',
                    boxShadow: THEME.shadows.lg,
                    padding: '12px',
                    minWidth: '300px',
                    maxWidth: '400px',
                }}
            >
                <p style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground, marginBottom: '8px' }}>
                    {description}
                </p>
                {protocol && (
                    <p style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '8px' }}>
                        Protocol: <span style={{ fontFamily: 'monospace', color: THEME.colors.accent }}>{protocol}</span>
                    </p>
                )}

                <FlowTransitionsSection transitions={flowTransitions} direction={direction} />
                <EdgeControlsSection controls={edgeControls} />
                <ControlsAppliedSection controls={controlsApplied} />
                <MitigationsSection mitigations={mitigations} />
                <RisksSection risks={risks} />
            </div>
            <TooltipArrow />
        </div>
    );
}

function FlowTransitionsSection({ transitions, direction }: { transitions: FlowTransition[]; direction?: string }) {
    if (transitions.length === 0) return null;

    return (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <ArrowRight style={{ width: '12px', height: '12px', color: THEME.colors.accent }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                    Flow Transitions {direction && <span style={{ color: THEME.colors.muted }}>({direction})</span>}:
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transitions.map((transition, idx) => (
                    <div
                        key={idx}
                        style={{
                            fontSize: '12px',
                            background: THEME.colors.backgroundSecondary,
                            borderRadius: '4px',
                            padding: '8px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.accent, fontWeight: 600 }}>
                                Step {transition.sequence}
                            </span>
                            {transition.flowName && (
                                <span style={{ color: THEME.colors.muted }}>in {transition.flowName}</span>
                            )}
                        </div>
                        {transition.description && (
                            <p style={{ color: THEME.colors.foreground }}>{transition.description}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EdgeControlsSection({ controls }: { controls: Record<string, EdgeControl> }) {
    const entries = Object.entries(controls);
    if (entries.length === 0) return null;

    return (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                    Connection Controls:
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {entries.map(([controlId, control]) => (
                    <div
                        key={controlId}
                        style={{
                            fontSize: '12px',
                            background: `${THEME.colors.success}10`,
                            borderRadius: '4px',
                            padding: '8px',
                        }}
                    >
                        <div style={{ fontFamily: 'monospace', color: THEME.colors.success, fontWeight: 600, marginBottom: '4px' }}>
                            {controlId}
                        </div>
                        {control.description && (
                            <p style={{ color: THEME.colors.foreground }}>{control.description}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ControlsAppliedSection({ controls }: { controls: string[] }) {
    if (controls.length === 0) return null;

    return (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                    Controls Applied:
                </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {controls.map((control, idx) => (
                    <span
                        key={idx}
                        style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: `${THEME.colors.success}20`,
                            color: THEME.colors.success,
                            fontFamily: 'monospace',
                        }}
                    >
                        {control}
                    </span>
                ))}
            </div>
        </div>
    );
}

function MitigationsSection({ mitigations }: { mitigations: (string | Mitigation)[] }) {
    if (mitigations.length === 0) return null;

    return (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                    Mitigations:
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {mitigations.map((mitigation, idx) => (
                    <div key={idx} style={{ fontSize: '12px' }}>
                        {typeof mitigation === 'string' ? (
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.success }}>{mitigation}</span>
                        ) : (
                            <div>
                                <span style={{ fontFamily: 'monospace', color: THEME.colors.success }}>{mitigation.id}</span>
                                {mitigation.name && <span style={{ color: THEME.colors.foreground }}> - {mitigation.name}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function RisksSection({ risks }: { risks: (string | Risk)[] }) {
    if (risks.length === 0) return null;

    return (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <AlertCircle style={{ width: '12px', height: '12px', color: THEME.colors.warning }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                    Risks:
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {risks.map((risk, idx) => (
                    <div key={idx} style={{ fontSize: '12px' }}>
                        {typeof risk === 'string' ? (
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.warning }}>{risk}</span>
                        ) : (
                            <div>
                                <span style={{ fontFamily: 'monospace', color: THEME.colors.warning }}>{risk.id}</span>
                                {risk.name && <span style={{ color: THEME.colors.foreground }}> - {risk.name}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TooltipArrow() {
    return (
        <div
            style={{
                position: 'absolute',
                left: '50%',
                top: '-6px',
                width: '12px',
                height: '12px',
                background: THEME.colors.card,
                borderLeft: `1px solid ${THEME.colors.border}`,
                borderTop: `1px solid ${THEME.colors.border}`,
                transform: 'translateX(-50%) rotate(45deg)',
            }}
        />
    );
}
