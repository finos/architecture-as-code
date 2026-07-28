import { useSyncExternalStore } from 'react';
import { migrationStore, MigrationErrorMessage } from './migration-store.js';

export function useMigrationError(): MigrationErrorMessage {
    return useSyncExternalStore(
        (onStoreChange) => migrationStore.subscribe(() => onStoreChange()),
        () => migrationStore.getMigrationError()
    );
}
