export default class TestDirectUrlAuthPlugin {
    constructor(options = {}) {
        this.options = options;
    }

    async getAuthHeaders(url, requestBody) {
        return {
            'Authorization': `Bearer ${this.options.token ?? 'test-token'}`,
            'X-Request-Body': JSON.stringify(requestBody)
        };
    }
}
