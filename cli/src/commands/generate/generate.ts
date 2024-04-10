/* eslint-disable  @typescript-eslint/no-explicit-any */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import * as winston from 'winston';
import { initLogger } from '../helper.js';

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

function instantiateNodeInterfaces(detail: any): any[] {
    const interfaces = [];
    if (!('prefixItems' in detail)) {
        console.error('No items in interfaces block.');
        return [];
    }

    const interfaceDefs = detail.prefixItems;
    for (const interfaceDef of interfaceDefs) {
        if (!('properties' in interfaceDef)) {
            continue;
        }

        const out = {};
        for (const [key, detail] of Object.entries(interfaceDef['properties'])) {
            out[key] = getPropertyValue(key, detail);
        }

        interfaces.push(out);
    }

    return interfaces;
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
            if (key === 'interfaces') {
                const interfaces = instantiateNodeInterfaces(detail);
                out['interfaces'] = interfaces;
            }
            else {
                out[key] = getPropertyValue(key, detail);
            }
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
            out[key] = getPropertyValue(key, detail);
        }

        outputRelationships.push(out);
    }

    return outputRelationships;
}

export const exportedForTesting = {
    getPropertyValue,
    instantiateNodes,
    instantiateRelationships,
    instantiateNodeInterfaces
};

export function runGenerate (patternPath: string, outputPath: string, debug: boolean): void {
    logger = initLogger(debug);

    const pattern = loadFile(patternPath);
    const outputNodes = instantiateNodes(pattern);
    const relationshipNodes = instantiateRelationships(pattern);

    const final = {
        'nodes': outputNodes,
        'relationships': relationshipNodes,
    };

    const output = JSON.stringify(final, null, 2);
    logger.debug('Generated instantiation: ' + output);

    const dirname = path.dirname(outputPath);

    mkdirp.sync(dirname);
    fs.writeFileSync(outputPath, output);
}
