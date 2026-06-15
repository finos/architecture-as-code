import axios from 'axios';
import { authStore } from './auth-store.js';

export const apiClient = axios.create();

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
            authStore.setAuthError(status);
        }

        return Promise.reject(error);         
    }
);