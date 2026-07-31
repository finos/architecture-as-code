export type MigrationErrorMessage = string | null;
type Listener = (message: MigrationErrorMessage) => void;

export class MigrationStore {
    private message: MigrationErrorMessage = null;
    private listeners = new Set<Listener>();

    setMigrationError(message: MigrationErrorMessage) {
        this.message = message;
        this.listeners.forEach((l) => l(message));
    }

    getMigrationError(): MigrationErrorMessage {
        return this.message;
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const migrationStore = new MigrationStore();
