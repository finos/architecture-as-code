import { initLogger, Logger } from "@finos/calm-shared";
import { AuthPlugin } from "./auth-plugin";

export class NoAuthPlugin implements AuthPlugin {
    private readonly logger: Logger;

    constructor(debug: boolean) {
        this.logger = initLogger(debug, 'no-auth-plugin');
        this.logger.debug('No auth plugin provided. Instantiating NoAuthPlugin');
    }

    async getAuthHeaders(url: string, requestBody: any): Promise<Record<string, string>> {
        this.logger.debug('Skipping auth request as no plugin provided.');
        return {};
    }
}