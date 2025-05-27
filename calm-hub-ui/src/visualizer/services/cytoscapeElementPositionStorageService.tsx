export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
}

const STORAGE_KEY = '_CytoscapeNodePositions';

export const CytoscapeElementPositionStorage = {
    posKey(title: string) {
        return title + STORAGE_KEY;
    },

    save(title: string, positions: StoredNodePosition[]) {
        try {
            localStorage.setItem(this.posKey(title), JSON.stringify(positions));
        } catch (err) {
            console.error('Failed to save node positions:', err);
        }
    },

    load(title: string): StoredNodePosition[] | null {
        try {
            const data = localStorage.getItem(this.posKey(title));
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Failed to load node positions:', err);
            return null;
        }
    },

    clear(title: string) {
        localStorage.removeItem(this.posKey(title));
    },
};
