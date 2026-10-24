import { THEME } from './theme.js';
import { newestFirst } from './utils/controlEvaluations.js';
import { FindingText } from './FindingText.js';
import type { ControlEvaluationDecorator, ControlEvaluationStatus } from '../../contracts/contracts.js';

interface Chip {
    label: string;
    /** Label colour: a text token, so it stays legible in dark. */
    text: string;
    /** Chip border and the row's left stripe. */
    accent: string;
    /** Chip fill. A hex accent can take an alpha suffix; the neutral is a CSS var and cannot, so it has its own. */
    fill: string;
}

const NEUTRAL_CHIP = { text: THEME.colors.muted, accent: THEME.colors.border, fill: THEME.colors.backgroundSecondary };

const STATUS_CHIPS: Record<ControlEvaluationStatus, Chip> = {
    'not-met': { label: 'Not met', text: THEME.colors.errorText, accent: THEME.colors.error, fill: `${THEME.colors.error}18` },
    met: { label: 'Met', text: THEME.colors.successText, accent: THEME.colors.success, fill: `${THEME.colors.success}18` },
    'not-applicable': { label: 'Not applicable', ...NEUTRAL_CHIP },
};

const chipFor = (status: string): Chip => STATUS_CHIPS[status as ControlEvaluationStatus] ?? { label: status, ...NEUTRAL_CHIP };

function EvaluationRow({ evaluation }: { evaluation: ControlEvaluationDecorator }) {
    const { data } = evaluation;
    const chip = chipFor(data.status);
    const findings = data.status === 'not-met' ? (data.findings ?? []) : [];
    const evaluatedAt = new Date(data['evaluated-at']);

    return (
        <div
            data-testid="control-evaluation-row"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 12px',
                borderBottom: `1px solid ${THEME.colors.border}`,
                borderLeft: `3px solid ${chip.accent}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                    data-testid="control-evaluation-chip"
                    style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        color: chip.text,
                        backgroundColor: chip.fill,
                        border: `1px solid ${chip.accent}`,
                    }}
                >
                    {chip.label}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: THEME.colors.foreground }}>
                    {data.control?.['control-id'] ?? data.control?.['unique-id']}
                </span>
                {data.control?.['control-id'] && (
                    <span style={{ fontSize: '12px', color: THEME.colors.muted }}>{data.control['unique-id']}</span>
                )}
                <span style={{ fontSize: '12px', color: THEME.colors.muted, marginLeft: 'auto' }}>
                    {Number.isNaN(evaluatedAt.getTime()) ? data['evaluated-at'] : evaluatedAt.toLocaleString()}
                </span>
            </div>
            <div style={{ fontSize: '12px', color: THEME.colors.muted }}>
                Applies to: <span style={{ color: THEME.colors.foreground }}>{(evaluation.appliesTo ?? []).join(', ')}</span>
            </div>
            {findings.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: THEME.colors.foreground }}>
                    {findings.map((finding, index) => (
                        <li key={index} data-testid="evaluation-finding" style={{ fontWeight: index === 0 ? 600 : 400 }}>
                            <FindingText finding={finding} />
                        </li>
                    ))}
                </ul>
            )}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: THEME.colors.muted }}>
                {data.change?.commit && (
                    <span>
                        Commit <code style={{ color: THEME.colors.foreground }}>{data.change.commit.slice(0, 7)}</code>
                    </span>
                )}
                {data.change?.spec && <span>Spec {data.change.spec}</span>}
                {data.actors?.approver && <span>approved by {data.actors.approver}</span>}
            </div>
        </div>
    );
}

export function ControlEvaluationsPanel({ evaluations }: { evaluations: ControlEvaluationDecorator[] }) {
    const sorted = newestFirst(evaluations ?? []);

    if (sorted.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.colors.muted, fontSize: '13px', fontStyle: 'italic' }}>
                No control evaluations for this version.
            </div>
        );
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                overflow: 'hidden',
                background: THEME.colors.backgroundSecondary,
            }}
        >
            <div
                style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: THEME.colors.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.card,
                }}
            >
                Evaluations ({sorted.length})
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: THEME.colors.card }}>
                {sorted.map((evaluation, index) => (
                    <EvaluationRow key={evaluation.uniqueId ?? index} evaluation={evaluation} />
                ))}
            </div>
        </div>
    );
}
