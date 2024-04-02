/* eslint-disable  @typescript-eslint/no-explicit-any */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import * as winston from 'winston';

let logger: winston.Logger; // defined later at startup

function loadFile(path: string): any {
    logger.info('Loading pattern from file: ' + path);
    const raw = fs.readFileSync(path, { encoding: 'utf8' });

    logger.debug('Attempting to load pattern file: ' + raw);
    const pattern = JSON.parse(raw);

    logger.debug('Loaded pattern file.');
    return pattern;
}


function getStringPlaceholder(name: string): string {
    return '{{ ' + name.toUpperCase().replaceAll('-', '_') + ' }}';
}

function getPropertyValue(keyName: string, detail: any) : any {
    if ('const' in detail) {
        return detail['const'];
    }

    if ('type' in detail) {
        const propertyType = detail['type'];

        if (propertyType === 'string') {
            return getStringPlaceholder(keyName);
        }
        if (propertyType === 'integer') {
            return -1;
        }
        if (propertyType === 'array') {
            return [ 
                getStringPlaceholder(keyName) 
            ];
        }
    }
}

function instantiateNodes(pattern: any): any {
    const nodes = pattern?.properties?.nodes?.prefixItems;
    if (!nodes) {
        logger.error('Warning: pattern has no nodes defined.');
        if (pattern?.properties?.nodes?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }
    const outputNodes = [];

    for (const node of nodes) {
        if (!('properties' in node)) {
            continue;
        }

        const out = {};
        for (const [key, detail] of Object.entries(node['properties'])) {
            out[key] = getPropertyValue(key, detail);
        }

        outputNodes.push(out);
    }
    return outputNodes;
}

function instantiateRelationships(pattern: any): any {
    const relationships = pattern?.properties?.relationships?.prefixItems;

    if (!relationships) {
        logger.error('Warning: pattern has no relationships defined');
        if (pattern?.properties?.relationships?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }

    const outputRelationships = [];
    for (const relationship of relationships) {
        if (!('properties' in relationship)) {
            continue;
        }

        const out = {};
        for (const [key, detail] of Object.entries(relationship['properties'])) {
            if (key === 'relationship-type') {
                out[key] = getPropertyValue(key, detail);
            }
            else {
                out[key] = getPropertyValue(key, detail);
            }
        }

        outputRelationships.push(out);
    }

    return outputRelationships;
}

function instantiateAdditionalTopLevelProperties(pattern: any): any {
    const properties = pattern?.properties;
    if (!properties) {
        logger.error('Warning: pattern has no properties defined.');
        return [];
    }

    const extraProperties = {};
    for (const [additionalProperty, detail] of Object.entries(properties)) {
        // additional properties only
        if (['nodes', 'relationships'].includes(additionalProperty)) {
            continue;
        }

        extraProperties[additionalProperty] = getPropertyValue(additionalProperty, detail);
    }

    return extraProperties;
}

export const exportedForTesting = {
    getPropertyValue,
    instantiateNodes,
    instantiateRelationships,
    instantiateAdditionalTopLevelProperties
};

export function runGenerate (patternPath: string, outputPath: string, debug: boolean): void {
    const level = debug ? 'debug' : 'info';
    logger = winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.cli()
    });


    const pattern = loadFile(patternPath);
    const outputNodes = instantiateNodes(pattern);
    const relationshipNodes = instantiateRelationships(pattern);

    const additionalProperties = instantiateAdditionalTopLevelProperties(pattern);

    const final = {
        'nodes': outputNodes,
        'relationships': relationshipNodes,
        ...additionalProperties // object spread operator to insert additional props at top level
    };

    const output = JSON.stringify(final, null, 2);
    logger.debug('Generated instantiation: ' + output);

    const dirname = path.dirname(outputPath);

    mkdirp.sync(dirname);
    fs.writeFileSync(outputPath, output);
}
