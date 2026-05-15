import { initLogger, Logger } from '../logger';
import { AuthPlugin } from './auth-plugin';

export class NoAuthPlugin implements AuthPlugin {
    private readonly logger: Logger;

    constructor(debug: boolean) {
        this.logger = initLogger(debug, 'no-auth-plugin');
        this.logger.debug('No auth plugin provided. Instantiating NoAuthPlugin');
    }

    async getAuthHeaders(_url: string, _requestBody: unknown): Promise<Record<string, string>> {
        this.logger.debug('Skipping auth request as no plugin provided.');
        return {};
    }
}