import { initLogger } from "@finos/calm-shared";
import { DocumentLoader } from "@finos/calm-shared/dist/document-loader/document-loader";

export async function loadPatternFromCalmHub(patternId: string, docLoader: DocumentLoader, debug: boolean): Promise<object> {
    const logger = initLogger(debug, 'calmhub-input');
    try {
        logger.info('Loading input pattern from CalmHub with ID: ' + patternId);

        const pattern = await docLoader.loadMissingDocument(patternId, 'pattern');

        logger.debug('Loaded pattern JSON.');
        return pattern;
    } catch (err) {
        logger.error("Error loading input from CalmHub. Status code: ", err.response.status);
        logger.debug("Error loading input from CalmHub: ", err);
        throw new Error(err);
    }
}