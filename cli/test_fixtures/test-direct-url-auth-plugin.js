export default class TestDirectUrlAuthPlugin {
    constructor(configPath) {
        this.configPath = configPath;
    }

    async getAuthHeaders(url, requestBody) {
        return {
            'Authorization': `Bearer ${this.configPath ?? 'test-token'}`,
            'X-Request-Body': JSON.stringify(requestBody)
        };
    }
}
