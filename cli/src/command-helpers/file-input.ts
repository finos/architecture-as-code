import * as fs from 'node:fs';
import { initLogger } from '@finos/calm-shared';

export async function loadJsonFromFile(path: string, debug: boolean): Promise<object> {
    const logger = initLogger(debug, 'file-input');
    try {
        logger.info('Loading json from file: ' + path);
        const raw = fs.readFileSync(path, 'utf-8');

        logger.debug('Attempting to load json file: ' + raw);
        const pattern = JSON.parse(raw);

        logger.debug('Loaded json file.');
        return pattern;
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.error('File not found!');
        } else {
            logger.error(err);
        }
        throw new Error(err);
    }
}