import { FiShield, FiAlertCircle } from 'react-icons/fi';
import { THEME } from '../theme';
import type { AIGFGovernance } from '../FlowsPanel';

interface AIGFGovernanceSectionProps {
    governance: AIGFGovernance;
}

export function AIGFGovernanceSection({ governance }: AIGFGovernanceSectionProps) {
    const hasMitigations = governance['mitigations-applied']?.length;
    const hasRisks = governance['risks-addressed']?.length;
    const hasBoundaries = governance['trust-boundaries-crossed']?.length;

    if (!hasMitigations && !hasRisks && !hasBoundaries) return null;

    return (
        <div style={{ padding: '0 8px 8px 8px' }}>
            <div
                style={{
                    borderRadius: '8px',
                    background: `${THEME.colors.success}10`,
                    border: `1px solid ${THEME.colors.success}30`,
                    padding: '8px',
                }}
            >
                <GovernanceHeader />

                {hasMitigations && (
                    <MitigationsRow mitigations={governance['mitigations-applied']!} />
                )}

                {hasRisks && <RisksRow risks={governance['risks-addressed']!} />}

                {hasBoundaries && (
                    <BoundariesRow boundaries={governance['trust-boundaries-crossed']!} />
                )}
            </div>
        </div>
    );
}

function GovernanceHeader() {
    return (
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
    );
}

function MitigationsRow({ mitigations }: { mitigations: string[] }) {
    return (
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
                <span style={{ fontSize: '11px', color: THEME.colors.muted }}>Mitigations: </span>
                <span
                    style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: THEME.colors.success,
                    }}
                >
                    {mitigations.join(', ')}
                </span>
            </div>
        </div>
    );
}

function RisksRow({ risks }: { risks: string[] }) {
    return (
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
                    {risks.join(', ')}
                </span>
            </div>
        </div>
    );
}

function BoundariesRow({ boundaries }: { boundaries: string[] }) {
    return (
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
                <span style={{ fontSize: '11px', color: THEME.colors.muted }}>Boundaries: </span>
                <span style={{ fontSize: '11px', color: THEME.colors.info }}>{boundaries.join(', ')}</span>
            </div>
        </div>
    );
}
