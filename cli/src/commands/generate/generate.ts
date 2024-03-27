import * as fs from 'node:fs'
import * as path from 'node:path'
import { mkdirp } from 'mkdirp'

import * as winston from 'winston'

let logger: winston.Logger; // defined later at startup

function loadFile(path: string): any {
    logger.info("Loading pattern from file: " + path)
    const raw = fs.readFileSync(path, { encoding: 'utf8' })

    logger.debug("Attempting to load pattern file: " + raw)
    const pattern = JSON.parse(raw);

    logger.debug("Loaded pattern file.")
    return pattern
}


function getStringPlaceholder(name: string): string {
    return "{{ " + name.toUpperCase().replaceAll("-", "_") + " }}"
}

function getPropertyValue(keyName: string, detail: any) : any {
    if (detail.hasOwnProperty("const")) {
        return detail["const"]
    }

    if (detail.hasOwnProperty("type")) {
        const propertyType = detail["type"]

        if (propertyType === "string") {
            return getStringPlaceholder(keyName)
        }
        if (propertyType === "integer") {
            return -1
        }
    }
}

function instantiateNodes(pattern: any): any {
    const nodes = pattern?.properties?.nodes?.prefixItems
    if (!nodes) {
        console.error("Warning: pattern has no nodes defined.")
        return []
    }
    const outputNodes = []

    for (const node of nodes) {
        if (!node.hasOwnProperty("properties")) {
            continue
        }

        let out = {}
        for (const [key, detail] of Object.entries(node["properties"])) {
            out[key] = getPropertyValue(key, detail)
        }

        outputNodes.push(out)
    }
    return outputNodes
}

function getRelationships(pattern: any): any {
    const relationships = pattern?.properties?.relationships?.prefixItems

    if (!relationships) {
        console.error("Warning: pattern has no relationships defined")
        return []
    }

    const outputRelationships = []
    for (const relationship of relationships) {
        if (!relationship.hasOwnProperty("properties")) {
            continue
        }

        let out = {}
        for (const [key, detail] of Object.entries(relationship["properties"])) {
            if (key === 'relationship-type') {
                out[key] = getPropertyValue(key, detail)
            }
            else {
                out[key] = getPropertyValue(key, detail)
            }
        }

        outputRelationships.push(out)
    }

    return outputRelationships
}

export const exportedForTesting = {
    getPropertyValue
}

export function runGenerate (patternPath: string, outputPath: string, debug: boolean): void {
    const level = debug ? 'debug' : 'info'
    logger = winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.cli()
    });


    const pattern = loadFile(patternPath)
    const outputNodes = instantiateNodes(pattern)
    const relationshipNodes = getRelationships(pattern)


    const final = {
        "nodes": outputNodes,
        "relationships": relationshipNodes
    }
    const output = JSON.stringify(final, null, 2)
    logger.debug("Generated instantiation: " + output)

    const dirname = path.dirname(outputPath);

    mkdirp.sync(dirname)
    fs.writeFileSync(outputPath, output)
}
