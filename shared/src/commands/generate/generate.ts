import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import { CalmChoice } from './components/options.js';
import { initLogger } from '../../logger.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { generate } from './generate-core.js';

export { generate, type GenerateOptions } from './generate-core.js';

export async function runGenerate(pattern: object, outputPath: string, debug: boolean, schemaDirectory: SchemaDirectory, chosenChoices?: CalmChoice[]): Promise<void> {
    const logger = initLogger(debug, 'calm-generate');
    logger.info('Generating a CALM architecture...');
    try {
        const final = await generate(pattern, schemaDirectory, { debug, chosenChoices });
        const output = JSON.stringify(final, null, 2);
        mkdirp.sync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, output);
        logger.info(`Successfully generated architecture to [${outputPath}]`);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Error while generating architecture from pattern: ' + error.message);
        logger.debug(error.stack ?? '');
    }
}
