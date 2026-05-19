export default class TestAuthPlugin {
    async getAuthHeaders(url, requestBody) {
        console.log(`AUTH PLUGIN: Calling URL: ${url} with request body: ${JSON.stringify(requestBody)}`);
        return {
            'Test-Header': 'TestValue'
        };
    }
}
