import { visualize } from '@finos/calm-visualizer';
import * as fs from 'node:fs';
import * as winston from 'winston';
import { initLogger } from '../helper';

export default async function(input: string, output: string, debug: boolean) {
    const logger = initLogger(debug);

    logger.info(`Reading CALM file from [${input}]`);
    const calm = fs.readFileSync(input, 'utf-8');

    logger.info('Generating an SVG from input');
    const svg = await visualize(calm, debug);

    logger.info(`Outputting file at [${output}]`);
    fs.writeFileSync(output, svg);
}