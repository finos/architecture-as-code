import { CalmCore } from '@finos/calm-models/model';
import { CalmCoreSchema } from '@finos/calm-models/types';
import { Logger } from '../../logger.js';
import { getErrorMessage } from '../../error-utils.js';

/**
 * Parse a raw architecture object into a {@link CalmCore} model, returning `undefined`
 * (and logging at debug level) if it cannot be parsed.
 *
 * Shared by the node-details and controls validators so the parse guard and its debug
 * message live in exactly one place.
 */
export function tryParseCalmCore(architecture: object, logger: Logger): CalmCore | undefined {
    try {
        return CalmCore.fromSchema(architecture as CalmCoreSchema);
    } catch (err) {
        logger.debug(`Could not parse architecture with CalmCore.fromSchema: ${getErrorMessage(err)}`);
        return undefined;
    }
}
