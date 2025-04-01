import * as fs from 'node:fs';
import { initLogger } from '@finos/calm-shared';

export function loadFile(path: string, debug: boolean = false): object {
    const logger = initLogger(debug, 'calm-generate-file-input');
    try {
        logger.info('Loading pattern from file: ' + path);
        const raw = fs.readFileSync(path, 'utf-8');

        logger.debug('Attempting to load pattern file: ' + raw);
        const pattern = JSON.parse(raw);

        logger.debug('Loaded pattern file.');
        return pattern;
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.error('Pattern not found!');
        } else {
            logger.error(err);
        }
        throw new Error(err);
    }
}