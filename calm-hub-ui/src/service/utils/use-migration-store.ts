import { useSyncExternalStore } from 'react';
import { migrationStore, MigrationErrorMessage } from './migration-store.js';

function subscribeToMigrationStore(onStoreChange: () => void): () => void {
    return migrationStore.subscribe(() => onStoreChange());
}

function getMigrationErrorSnapshot(): MigrationErrorMessage {
    return migrationStore.getMigrationError();
}

export function useMigrationError(): MigrationErrorMessage {
    return useSyncExternalStore(subscribeToMigrationStore, getMigrationErrorSnapshot);
}
