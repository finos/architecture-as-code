import * as fs from 'node:fs';
import * as winston from 'winston';
import { initLogger } from '../helper.js';
import calmToDot from './calmToDot.js';
import { renderGraphFromSource } from 'graphviz-cli';
import { generate } from '../generate/generate.js';

let logger: winston.Logger;

export async function visualizeInstantiation(instantiationPath: string, output: string, debug: boolean) {
    logger = initLogger(debug);

    logger.info(`Reading CALM file from [${instantiationPath}]`);
    const calm = fs.readFileSync(instantiationPath, 'utf-8');

    logger.info('Generating an SVG from input');

    try {
        const dot = calmToDot(JSON.parse(calm), debug);
        logger.debug(`Generated the following dot: 
            ${dot}
        `);

        const svg = await renderGraphFromSource({ input: dot }, { format: 'svg', engine: 'dot' });

        logger.info(`Outputting file at [${output}]`);
        fs.writeFileSync(output, svg);
        return;
    } catch (err) {
        logger.error(err);
        return;
    }
}

export async function visualizePattern(patternPath: string, output: string, debug: boolean) {
    logger = initLogger(debug);

    const instantiation = generate(patternPath, debug);

    logger.info('Generating an SVG from input');

    try {
        const dot = calmToDot(instantiation, debug);
        logger.debug(`Generated the following dot: 
            ${dot}
        `);

        const svg = await renderGraphFromSource({ input: dot }, { format: 'svg', engine: 'dot' });

        logger.info(`Outputting file at [${output}]`);
        fs.writeFileSync(output, svg);
        return;
    } catch (err) {
        logger.error(err);
        return;
    }
}