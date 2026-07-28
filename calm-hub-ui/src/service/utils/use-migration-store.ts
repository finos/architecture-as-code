import { useEffect, useState } from 'react';
import { migrationStore, MigrationErrorMessage } from './migration-store.js';

export function useMigrationError(): MigrationErrorMessage {
    const [message, setMessage] = useState<MigrationErrorMessage>(migrationStore.getMigrationError());
    useEffect(() => {
        return migrationStore.subscribe(setMessage);
    }, []);
    return message;
}
