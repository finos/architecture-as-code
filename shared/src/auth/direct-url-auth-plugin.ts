export interface DirectUrlAuthPlugin {
    getAuthHeaders(url: string, requestBody: unknown): Promise<Record<string, string>>;
}
