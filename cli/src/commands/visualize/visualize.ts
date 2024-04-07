import { visualize } from '@finos/calm-visualizer';
import * as fs from 'node:fs';
import * as winston from 'winston';

export default async function(input: string, output: string, verbose: boolean) {
    const level = verbose ? 'debug' : 'info';

    const logger: winston.Logger = winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.cli()
    });

    logger.info(`Reading CALM file from [${input}]`);
    const calm = fs.readFileSync(input, 'utf-8');

    logger.info('Generating an SVG from input');
    const svg = await visualize(calm, verbose);

    logger.info(`Outputting file at [${output}]`);
    fs.writeFileSync(output, svg);
}