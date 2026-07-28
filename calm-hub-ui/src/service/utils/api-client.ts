import axios from 'axios';
import { authStore } from './auth-store.js';
import { migrationStore } from './migration-store.js';

const DEFAULT_MIGRATION_MESSAGE = 'CalmHub is temporarily unavailable. Please try again shortly.';

export const apiClient = axios.create();

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
            authStore.setAuthError(status);
        }

        if (status === 503) {
            const body = error.response?.data;
            const message = typeof body === 'string' && body.trim().length > 0 ? body : DEFAULT_MIGRATION_MESSAGE;
            migrationStore.setMigrationError(message);
        }

        return Promise.reject(error);
    }
);