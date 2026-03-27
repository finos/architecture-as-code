import type { Decorator } from '../../../contracts/contracts.js';

export type DeploymentStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';

export interface DeploymentData {
    'start-time'?: string;
    'end-time'?: string;
    status?: DeploymentStatus;
    'deployment-details'?: string;
    notes?: string;
    [key: string]: unknown;
}

export interface Filters {
    status: string;
    component: string;
}

export const STATUS_STYLES: Record<DeploymentStatus, { background: string; color: string; dot: string }> = {
    completed:     { background: '#dcfce7', color: '#15803d', dot: '#16a34a' },
    failed:        { background: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
    'in-progress': { background: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
    pending:       { background: '#f3f4f6', color: '#4b5563', dot: '#6b7280' },
    'rolled-back': { background: '#fef3c7', color: '#92400e', dot: '#d97706' },
};

export function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

export function relativeTime(iso?: string): string {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

export function formatDuration(ms: number): string {
    const totalSecs = Math.round(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function avgDuration(decorators: Decorator[]): string {
    const durations = decorators
        .map((dec) => {
            const d = (dec.data ?? {}) as DeploymentData;
            if (!d['start-time'] || !d['end-time']) return null;
            const ms = new Date(d['end-time']).getTime() - new Date(d['start-time']).getTime();
            return ms >= 0 ? ms : null;
        })
        .filter((n): n is number => n !== null);
    if (durations.length === 0) return '—';
    return formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function sortedByStartTime(decorators: Decorator[]): Decorator[] {
    return [...decorators].sort((a, b) => {
        const aTime = ((a.data as DeploymentData) ?? {})['start-time'] ?? '';
        const bTime = ((b.data as DeploymentData) ?? {})['start-time'] ?? '';
        return bTime.localeCompare(aTime);
    });
}

export function latestDeployment(decorators: Decorator[]): Decorator | undefined {
    return sortedByStartTime(decorators)[0];
}
