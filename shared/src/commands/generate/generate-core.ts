import { CalmChoice, selectChoices } from './components/options.js';
import { instantiate } from './components/instantiate';
import { flattenAllOf } from './components/flatten-allof';
import { SchemaDirectory } from '../../schema-directory.js';

export interface GenerateOptions {
    debug?: boolean;
    chosenChoices?: CalmChoice[];
}

/**
 * Instantiate an architecture from a pattern. Pure: no filesystem access, errors propagate.
 */
export async function generate(pattern: object, schemaDirectory: SchemaDirectory, options: GenerateOptions = {}): Promise<object> {
    const debug = options.debug ?? false;
    await schemaDirectory.loadSchemas();
    let flattenedPattern = await flattenAllOf(pattern as Record<string, unknown>, schemaDirectory, debug);
    if (options.chosenChoices) {
        flattenedPattern = selectChoices(flattenedPattern, options.chosenChoices, debug);
    }
    return instantiate(flattenedPattern, debug, schemaDirectory) as Promise<object>;
}
