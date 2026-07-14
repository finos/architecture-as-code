import type {
    DeploymentDecorator,
    DeploymentDecoratorData,
    DeploymentStatus,
} from '../../../contracts/contracts.js';
import {
    avgDuration,
    formatDateTime,
    formatDuration,
    latestByStartTime,
    relativeTime,
    sortedByStartTime,
} from '../utils/timeUtils.js';

export type DeploymentData = DeploymentDecoratorData;

export interface Filters {
    status: string;
    component: string;
}

/** The wash and label follow the theme; the dot is chromatic and reads on both. */
export const STATUS_STYLES: Record<DeploymentStatus, { background: string; color: string; dot: string }> = {
    completed: {
        background: 'var(--calm-status-completed-bg)',
        color: 'var(--calm-status-completed-fg)',
        dot: '#16a34a',
    },
    failed: {
        background: 'var(--calm-status-failed-bg)',
        color: 'var(--calm-status-failed-fg)',
        dot: '#dc2626',
    },
    'in-progress': {
        background: 'var(--calm-status-inprogress-bg)',
        color: 'var(--calm-status-inprogress-fg)',
        dot: '#2563eb',
    },
    pending: {
        background: 'var(--calm-status-pending-bg)',
        color: 'var(--calm-status-pending-fg)',
        dot: '#6b7280',
    },
    'rolled-back': {
        background: 'var(--calm-status-rolledback-bg)',
        color: 'var(--calm-status-rolledback-fg)',
        dot: '#d97706',
    },
};

export { avgDuration, formatDateTime, formatDuration, relativeTime, sortedByStartTime };

export function latestDeployment(decorators: DeploymentDecorator[]): DeploymentDecorator | undefined {
    return latestByStartTime(decorators);
}
