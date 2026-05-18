export interface AuthPlugin {
    getAuthHeaders(url: string, requestBody: unknown): Promise<Record<string, string>>;
}