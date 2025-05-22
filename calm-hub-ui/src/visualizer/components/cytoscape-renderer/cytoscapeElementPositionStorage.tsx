export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
  }
  
  const STORAGE_KEY = 'cytoscapeNodePositions';
  
  export const CytoscapeElementPositionStorage = {
    save(positions: StoredNodePosition[]) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      } catch (err) {
        console.error('Failed to save node positions:', err);
      }
    },
  
    load(): StoredNodePosition[] | null {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Failed to load node positions:', err);
        return null;
      }
    },
  
    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };
  