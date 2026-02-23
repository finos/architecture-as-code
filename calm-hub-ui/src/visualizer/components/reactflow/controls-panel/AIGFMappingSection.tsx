import { FiShield, FiAlertCircle } from 'react-icons/fi';
import { THEME } from '../theme';

interface AIGFMappingSectionProps {
    mitigations?: string[];
    risks?: string[];
}

export function AIGFMappingSection({ mitigations, risks }: AIGFMappingSectionProps) {
    if (!mitigations?.length && !risks?.length) return null;

    return (
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

                {mitigations && mitigations.length > 0 && (
                    <MitigationsRow mitigations={mitigations} />
                )}

                {risks && risks.length > 0 && <RisksRow risks={risks} />}
            </div>
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
                    {risks.join(', ')}
                </span>
            </div>
        </div>
    );
}
