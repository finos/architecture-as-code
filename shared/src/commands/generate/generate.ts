import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import { CalmChoice, selectChoices } from './components/options.js';
import { instantiate } from './components/instantiate';
import { flattenAllOf } from './components/flatten-allof';
import { initLogger } from '../../logger.js';
import { SchemaDirectory } from '../../schema-directory.js';

export async function runGenerate(pattern: object, outputPath: string, debug: boolean, schemaDirectory: SchemaDirectory, chosenChoices?: CalmChoice[]): Promise<void> {
    const logger = initLogger(debug, 'calm-generate');
    logger.info('Generating a CALM architecture...');
    try {
        // Flatten any allOf compositions before processing
        await schemaDirectory.loadSchemas();
        let flattenedPattern = await flattenAllOf(
            pattern as Record<string, unknown>,
            schemaDirectory,
            debug
        );

        if (chosenChoices) {
            flattenedPattern = selectChoices(flattenedPattern, chosenChoices, debug);
        }

        const final = await instantiate(flattenedPattern, debug, schemaDirectory);
        const output = JSON.stringify(final, null, 2);
        const dirname = path.dirname(outputPath);

        mkdirp.sync(dirname);
        fs.writeFileSync(outputPath, output);
        logger.info(`Successfully generated architecture to [${outputPath}]`);
    } catch (err) {
        logger.error('Error while generating architecture from pattern: ' + err.message);
        logger.debug(err.stack);
    }
}
