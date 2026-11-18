import { AxiosInstance, isAxiosError } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { PersonalNamespaceState } from '../model/personal-namespace.js';
import { apiClient } from './utils/api-client.js';

const PATH = '/api/calm/me/namespace';

interface PersonalNamespaceResponse {
    name: string;
    exists: boolean;
    owned: boolean;
}

function toState(body: PersonalNamespaceResponse): PersonalNamespaceState {
    if (!body.exists) return { status: 'available', name: body.name };
    return body.owned ? { status: 'owned', name: body.name } : { status: 'taken', name: body.name };
}

function knownErrorState(error: unknown): PersonalNamespaceState | undefined {
    if (!isAxiosError(error)) return undefined;
    if (error.response?.status === 404) return { status: 'unavailable' };
    if (error.response?.status === 422) return { status: 'unsupported' };
    return undefined;
}

/** Reads and creates the caller's personal namespace. See calm-hub/PERSONAL_NAMESPACES.md. */
export class PersonalNamespaceService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async fetchPersonalNamespace(): Promise<PersonalNamespaceState> {
        const headers = await getAuthHeaders();
        return this.ax
            .get<PersonalNamespaceResponse>(PATH, { headers })
            .then((res) => toState(res.data))
            .catch((error) => {
                const known = knownErrorState(error);
                if (known) return known;
                const errorMessage = 'Error fetching personal namespace:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /** Creates the namespace. A 409 means another user holds the name, so the state is read again. */
    public async createPersonalNamespace(): Promise<PersonalNamespaceState> {
        const headers = await getAuthHeaders();
        return this.ax
            .put<PersonalNamespaceResponse>(PATH, undefined, { headers })
            .then((res) => toState(res.data))
            .catch((error) => {
                if (isAxiosError(error) && error.response?.status === 409) {
                    return this.fetchPersonalNamespace();
                }
                const known = knownErrorState(error);
                if (known) return known;
                const errorMessage = 'Error creating personal namespace:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
