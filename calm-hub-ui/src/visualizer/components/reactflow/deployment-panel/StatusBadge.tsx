import type { DeploymentStatus } from './deployment-types.js';
import { STATUS_STYLES } from './deployment-types.js';

export function StatusBadge({ status }: { status?: DeploymentStatus }) {
    const style = status ? STATUS_STYLES[status] : { background: '#f3f4f6', color: '#4b5563', dot: '#6b7280' };
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '12px',
                background: style.background,
                color: style.color,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
            {status ?? 'unknown'}
        </span>
    );
}
