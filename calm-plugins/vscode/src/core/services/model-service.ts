import * as fs from 'fs'

/**
 * ModelService - Pure domain service for model file operations
 * Framework-free service for reading and processing CALM model files
 */
export class ModelService {
    constructor() { }

    /**
     * Read and parse a model file asynchronously
     * Prevents blocking the extension host for large files
     */
    async readModelAsync(filePath: string): Promise<any> {
        const content = await fs.promises.readFile(filePath, 'utf8')
        return this.parseContent(filePath, content)
    }

    /**
     * Read and parse a model file synchronously
     * @deprecated Use readModelAsync for better performance with large files
     */
    readModel(filePath: string): any {
        const content = fs.readFileSync(filePath, 'utf8')
        return this.parseContent(filePath, content)
    }

    /**
     * Parse file content based on file extension
     */
    private parseContent(filePath: string, content: string): any {
        if (filePath.endsWith('.json')) {
            return JSON.parse(content)
        }

        if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
            try {
                const yaml = require('yaml')
                return yaml.parse(content)
            } catch {
                return { raw: content, format: 'yaml' }
            }
        }

        return { raw: content, format: 'unknown' }
    }

    /**
     * Filter model data by selected element ID
     */
    filterBySelection(fullModelData: any, selectedId?: string): any {
        if (!selectedId || selectedId.startsWith('group:')) {
            return fullModelData
        }

        // Check nodes
        if (fullModelData?.nodes) {
            const node = fullModelData.nodes.find((x: any) => x['unique-id'] === selectedId)
            if (node) return node
        }

        // Check relationships
        if (fullModelData?.relationships) {
            const relationship = fullModelData.relationships.find((x: any) => x['unique-id'] === selectedId)
            if (relationship) return relationship
        }

        // Check flows
        if (fullModelData?.flows) {
            const flow = fullModelData.flows.find((x: any) => x['unique-id'] === selectedId)
            if (flow) return flow
        }

        return fullModelData
    }
}