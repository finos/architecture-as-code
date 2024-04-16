// import { visualize } from '@finos/calm-visualizer';
import * as fs from 'node:fs';
import * as winston from 'winston';
import { initLogger } from '../helper.js';
import { calmToDot } from './calmToDot.js';
import { renderGraphFromSource } from 'graphviz-cli';

export default async function(input: string, output: string, debug: boolean) {
    const logger: winston.Logger = initLogger(debug);

    logger.info(`Reading CALM file from [${input}]`);
    const calm = fs.readFileSync(input, 'utf-8');

    logger.info('Generating an SVG from input');

    const dot = calmToDot(JSON.parse(calm));
    logger.debug(`Creating the following dot: 
    ${dot}
    `);

    const svg = await renderGraphFromSource({ input: dot }, { format: 'svg', engine: 'dot' });

    logger.info(`Outputting file at [${output}]`);
    fs.writeFileSync(output, svg);
}
