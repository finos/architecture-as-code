export interface DirectUrlTlsConfig {
    httpsCaCert?: string;
}

export interface DirectUrlAuthPlugin {
    getAuthHeaders(url: string, requestBody: unknown): Promise<Record<string, string>>;
    getTlsConfig?(): Promise<DirectUrlTlsConfig>;
}
