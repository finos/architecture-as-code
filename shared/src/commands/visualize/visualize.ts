import * as fs from 'node:fs';
import * as winston from 'winston';
import { initLogger } from '../helper.js';
import calmToDot from './calmToDot.js';
import { instance } from '@viz-js/viz';
import { renderGraphFromSource } from 'graphviz-cli';
import { generate } from '../generate/generate.js';

let logger: winston.Logger;

export async function visualize(instantiation: string): Promise<string | undefined> {
    try {
        const dot = calmToDot(JSON.parse(instantiation));
        return (await instance()).render(dot, { format: 'svg', engine: 'dot' }).output;
     
    } catch (error: unknown) {
        console.error(error);
        return 'Error creating SVG: Instantiation JSON is invalid';
    }
} 

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
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}

export async function visualizePattern(patternPath: string, output: string, debug: boolean) {
    logger = initLogger(debug);

    // TODO add a path to load schemas and generate intelligently
    const instantiation = await generate(patternPath, debug, true);

    logger.info('Generating an SVG from input');

    try {
        const dot = calmToDot(instantiation, debug);
        logger.debug(`Generated the following dot: 
            ${dot}
        `);

        const svg = await renderGraphFromSource({ input: dot }, { format: 'svg', engine: 'dot' });

        logger.info(`Outputting file at [${output}]`);
        fs.writeFileSync(output, svg);
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}