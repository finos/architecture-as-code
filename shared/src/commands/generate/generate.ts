import * as fs from 'node:fs';
import * as path from 'node:path';
import {mkdirp} from 'mkdirp';

import * as winston from 'winston';
import {initLogger} from '../../logger.js';
let logger: winston.Logger; // defined later at startup
import { instantiate } from './components/instantiate';

export async function runGenerate(patternPath: string, outputPath: string, debug: boolean, schemaDirectoryPath?: string): Promise<void> {
    logger = initLogger(debug);
    try {
        const final = await instantiate(patternPath, debug, schemaDirectoryPath);
        const output = JSON.stringify(final, null, 2);
        const dirname = path.dirname(outputPath);

        mkdirp.sync(dirname);
        fs.writeFileSync(outputPath, output);
    }
    catch (err) {
        logger.debug('Error while generating architecture from pattern: ' + err.message);
        if (debug) {
            logger.debug(err.stack);
        }
    }
}
