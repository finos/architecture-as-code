import type { AuthPlugin } from '@finos/calm-shared'

export default class TestAuthPlugin implements AuthPlugin {
    async getAuthHeaders(url: string, requestBody: unknown): Promise<Record<string, string>> {
        console.log(`Generating auth headers for URL: ${url} with request body: ${JSON.stringify(requestBody)}`);
        return {
            'Test-Header': 'TestValue'
        };
    }
}