import type {
    Decorator,
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
} from './time-utils.js';

const DEPLOYMENT_STATUSES: DeploymentStatus[] = ['pending', 'in-progress', 'completed', 'failed', 'rolled-back'];

export type DeploymentData = DeploymentDecoratorData;

function isDeploymentStatus(value: unknown): value is DeploymentStatus {
    return typeof value === 'string' && DEPLOYMENT_STATUSES.includes(value as DeploymentStatus);
}

export function isDeploymentDecorator(decorator: Decorator): decorator is DeploymentDecorator {
    if (!decorator.data || typeof decorator.data !== 'object') return false;

    const data = decorator.data as Record<string, unknown>;
    return (
        typeof data['start-time'] === 'string' &&
        typeof data['end-time'] === 'string' &&
        isDeploymentStatus(data.status)
    );
}

export interface Filters {
    status: string;
    component: string;
}

export const STATUS_STYLES: Record<DeploymentStatus, { background: string; color: string; dot: string }> = {
    completed: { background: '#dcfce7', color: '#15803d', dot: '#16a34a' },
    failed: { background: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
    'in-progress': { background: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
    pending: { background: '#f3f4f6', color: '#4b5563', dot: '#6b7280' },
    'rolled-back': { background: '#fef3c7', color: '#92400e', dot: '#d97706' },
};

export { avgDuration, formatDateTime, formatDuration, relativeTime, sortedByStartTime };

export function latestDeployment(decorators: DeploymentDecorator[]): DeploymentDecorator | undefined {
    return latestByStartTime(decorators);
}
