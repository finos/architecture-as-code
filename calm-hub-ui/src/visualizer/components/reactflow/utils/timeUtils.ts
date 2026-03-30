export interface StartTime {
    'start-time': string;
}

export interface Duration extends StartTime {
    'end-time': string;
}

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

export function avgDuration<T extends { data: Duration }>(items: T[]): string {
    const durations = items
        .map((item) => {
            const ms = new Date(item.data['end-time']).getTime() - new Date(item.data['start-time']).getTime();
            return ms >= 0 ? ms : null;
        })
        .filter((n): n is number => n !== null);

    if (durations.length === 0) return '—';
    return formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function sortedByStartTime<T extends { data: StartTime }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const aTime = a.data['start-time'];
        const bTime = b.data['start-time'];
        return bTime.localeCompare(aTime);
    });
}

export function latestByStartTime<T extends { data: StartTime }>(items: T[]): T | undefined {
    return sortedByStartTime(items)[0];
}