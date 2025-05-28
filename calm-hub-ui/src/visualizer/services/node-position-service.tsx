export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
}

const STORAGE_KEY = '-calmhub-node-positions';

export function saveNodePositions(title: string, positions: StoredNodePosition[]) {
    const key = createKey(title);
    try {
        localStorage.setItem(key, JSON.stringify(positions));
    } catch (err) {
        console.error('Failed to save node positions:', err);
    }
}

export function loadStoredNodePositions(title: string): StoredNodePosition[] | null {
    const key = createKey(title);
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('Failed to load node positions:', err);
        return null;
    }
}

function createKey(title: string) {
    return title + STORAGE_KEY;
}
