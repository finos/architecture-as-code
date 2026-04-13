import { THEME } from '../theme.js';
import type { DeploymentDecorator } from '../../../contracts/contracts.js';
import {
    STATUS_STYLES,
    avgDuration,
    latestDeployment,
    formatDateTime,
    relativeTime,
    formatDuration,
} from './deployment-types.js';

function StatCard({ label, value, accent, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: THEME.colors.card,
                borderRadius: '6px',
                border: `1px solid ${THEME.colors.border}`,
                minWidth: '76px',
                gap: '4px',
            }}
        >
            <span style={{ fontSize: '20px', fontWeight: 700, color: accent ?? THEME.colors.foreground, lineHeight: 1 }}>
                {value}
            </span>
            <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                </div>
                {sub && <div style={{ fontSize: '10px', color: THEME.colors.muted, marginTop: '1px' }}>{sub}</div>}
            </div>
        </div>
    );
}

export function SummarySection({ decorators }: { decorators: DeploymentDecorator[] }) {
    const total      = decorators.length;
    const completed  = decorators.filter((d) => d.data.status === 'completed').length;
    const failed     = decorators.filter((d) => d.data.status === 'failed').length;
    const inProgress = decorators.filter((d) => d.data.status === 'in-progress').length;

    const settled = total - inProgress;
    const successRate = settled > 0 ? Math.round((completed / settled) * 100) : null;
    const successColor = successRate === null ? undefined
        : successRate >= 80 ? '#15803d'
        : successRate >= 50 ? '#92400e'
        : '#b91c1c';

    const avg = avgDuration(decorators);
    const latest = latestDeployment(decorators);
    const latestData = latest ? latest.data : null;
    const latestStatus = latestData?.status;
    const latestStyle = latestStatus ? STATUS_STYLES[latestStatus] : null;
    const lastStart = latestData?.['start-time'];

    return (
        <div
            style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.backgroundSecondary,
                display: 'flex',
                gap: '8px',
                alignItems: 'stretch',
                flexWrap: 'wrap',
            }}
        >
            <StatCard label="Total" value={total} />
            <StatCard label="Completed" value={completed} accent="#15803d" />
            <StatCard label="Failed" value={failed} accent="#b91c1c" />
            {inProgress > 0 && <StatCard label="In Progress" value={inProgress} accent="#1d4ed8" />}
            {successRate !== null && <StatCard label="Success Rate" value={`${successRate}%`} accent={successColor} sub={`${settled} settled`} />}
            {avg !== '—' && <StatCard label="Avg Duration" value={avg} sub="completed runs" />}

            <div style={{ width: '1px', background: THEME.colors.border, alignSelf: 'stretch', margin: '0 4px' }} />

            {latest && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: THEME.colors.card,
                        borderRadius: '6px',
                        border: `1px solid ${THEME.colors.border}`,
                        gap: '6px',
                        flex: 1,
                        minWidth: '160px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Latest Deployment
                        </span>
                        {latestStyle && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: latestStyle.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: latestStyle.dot, flexShrink: 0 }} />
                                {latestStatus}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: THEME.colors.foreground }}>{relativeTime(lastStart)}</span>
                        <span style={{ fontSize: '11px', color: THEME.colors.muted }}>{formatDateTime(lastStart)}</span>
                    </div>
                    {latestData?.['end-time'] && latestData['start-time'] && (
                        <span style={{ fontSize: '11px', color: THEME.colors.muted }}>
                            Duration: {formatDuration(new Date(latestData['end-time']).getTime() - new Date(latestData['start-time']).getTime())}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
