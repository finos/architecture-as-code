import { CalmCore } from '../model/core.js';
import fs from 'fs';
import { initLogger } from '../logger.js';
import {CalmCoreSchema} from '../types/core-types.js';

export class CalmParser {

    private static logger = initLogger(process.env.DEBUG === 'true', 'calm-parser');

    parse(coreCalmFilePath: string): CalmCore {
        const logger = CalmParser.logger;
        try {
            const data = fs.readFileSync(coreCalmFilePath, 'utf8');
            const dereferencedData: CalmCoreSchema = JSON.parse(data); // TODO: this needs to use SchemaDirectory to parse the other documents e.g. flows.
            dereferencedData.flows = []; // If this ends up being string documents then this will break CalmFlow.fromJson
            dereferencedData.controls = {}; // If this ends up being string documents then this will break CalmControl.fromJson
            return CalmCore.fromJson(dereferencedData);
        } catch (error) {
            logger.error('Failed to parse calm.json:'+ error);
            throw error;
        }
    }
}
