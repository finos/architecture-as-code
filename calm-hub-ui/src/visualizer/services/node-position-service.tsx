export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
}

export function saveNodePositions(title: string, positions: StoredNodePosition[]) {
    try {
        localStorage.setItem(title, JSON.stringify(positions));
    } catch (err) {
        console.error('Failed to save node positions:', err);
    }
}

export function loadStoredNodePositions(title: string): StoredNodePosition[] | null {
    try {
        const data = localStorage.getItem(title);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('Failed to load node positions:', err);
        return null;
    }
}
