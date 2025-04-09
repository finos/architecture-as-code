import * as fs from 'node:fs';
import * as path from 'node:path';
import {mkdirp} from 'mkdirp';

import { CalmChoice, selectChoices } from './components/options.js';
import { instantiate } from './components/instantiate';
import { initLogger } from '../../logger.js';

export async function runGenerate(pattern: object, outputPath: string, debug: boolean, chosenChoices?: CalmChoice[], schemaDirectoryPath?: string): Promise<void> {
    const logger = initLogger(debug, 'calm-generate');
    logger.info('Generating a CALM architecture...');
    try {
        if (chosenChoices) {
            pattern = selectChoices(pattern, chosenChoices, debug);
        }

        const final = await instantiate(pattern, debug, schemaDirectoryPath);
        const output = JSON.stringify(final, null, 2);
        const dirname = path.dirname(outputPath); 

        mkdirp.sync(dirname);
        fs.writeFileSync(outputPath, output);
        logger.info(`Successfully generated architecture to [${outputPath}]`);
    } catch (err) {
        logger.debug('Error while generating architecture from pattern: ' + err.message);
        if (debug) {
            logger.debug(err.stack);
        }
    }
}
