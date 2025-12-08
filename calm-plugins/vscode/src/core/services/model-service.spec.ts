import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModelService } from './model-service'
import * as fs from 'fs'

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    promises: {
        readFile: vi.fn()
    }
}))

describe('ModelService', () => {
    let modelService: ModelService

    beforeEach(() => {
        modelService = new ModelService()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('readModel (sync)', () => {
        it('should parse JSON files', () => {
            const mockJson = '{"nodes": [], "relationships": []}'
            vi.mocked(fs.readFileSync).mockReturnValue(mockJson)

            const result = modelService.readModel('/path/to/file.json')

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.json', 'utf8')
            expect(result).toEqual({ nodes: [], relationships: [] })
        })

        it('should parse YAML files', () => {
            const mockYaml = 'nodes: []\nrelationships: []'
            vi.mocked(fs.readFileSync).mockReturnValue(mockYaml)

            const result = modelService.readModel('/path/to/file.yaml')

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.yaml', 'utf8')
            expect(result).toEqual({ nodes: [], relationships: [] })
        })

        it('should parse YML files', () => {
            const mockYaml = 'nodes: []\nrelationships: []'
            vi.mocked(fs.readFileSync).mockReturnValue(mockYaml)

            const result = modelService.readModel('/path/to/file.yml')

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.yml', 'utf8')
            expect(result).toEqual({ nodes: [], relationships: [] })
        })

        it('should return raw content for unknown file types', () => {
            const mockContent = 'some unknown content'
            vi.mocked(fs.readFileSync).mockReturnValue(mockContent)

            const result = modelService.readModel('/path/to/file.txt')

            expect(result).toEqual({ raw: mockContent, format: 'unknown' })
        })
    })

    describe('readModelAsync', () => {
        it('should parse JSON files asynchronously', async () => {
            const mockJson = '{"nodes": [], "relationships": []}'
            vi.mocked(fs.promises.readFile).mockResolvedValue(mockJson)

            const result = await modelService.readModelAsync('/path/to/file.json')

            expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/file.json', 'utf8')
            expect(result).toEqual({ nodes: [], relationships: [] })
        })

        it('should parse YAML files asynchronously', async () => {
            const mockYaml = 'nodes: []\nrelationships: []'
            vi.mocked(fs.promises.readFile).mockResolvedValue(mockYaml)

            const result = await modelService.readModelAsync('/path/to/file.yaml')

            expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/file.yaml', 'utf8')
            expect(result).toEqual({ nodes: [], relationships: [] })
        })

        it('should return raw content for unknown file types asynchronously', async () => {
            const mockContent = 'some unknown content'
            vi.mocked(fs.promises.readFile).mockResolvedValue(mockContent)

            const result = await modelService.readModelAsync('/path/to/file.txt')

            expect(result).toEqual({ raw: mockContent, format: 'unknown' })
        })

        it('should not block the event loop for large files', async () => {
            const largeJson = JSON.stringify({ nodes: Array(1000).fill({ id: 'test' }) })
            vi.mocked(fs.promises.readFile).mockResolvedValue(largeJson)

            const startTime = Date.now()
            await modelService.readModelAsync('/path/to/large.json')
            const endTime = Date.now()

            // Async read should complete quickly (mocked)
            expect(endTime - startTime).toBeLessThan(100)
        })
    })

    describe('filterBySelection', () => {
        const mockModelData = {
            nodes: [
                { 'unique-id': 'node-1', name: 'Node 1' },
                { 'unique-id': 'node-2', name: 'Node 2' }
            ],
            relationships: [
                { 'unique-id': 'rel-1', source: 'node-1', target: 'node-2' }
            ],
            flows: [
                { 'unique-id': 'flow-1', name: 'Flow 1' }
            ]
        }

        it('should return full model when no selection', () => {
            const result = modelService.filterBySelection(mockModelData, undefined)
            expect(result).toEqual(mockModelData)
        })

        it('should return full model when selection starts with group:', () => {
            const result = modelService.filterBySelection(mockModelData, 'group:nodes')
            expect(result).toEqual(mockModelData)
        })

        it('should return specific node when node is selected', () => {
            const result = modelService.filterBySelection(mockModelData, 'node-1')
            expect(result).toEqual({ 'unique-id': 'node-1', name: 'Node 1' })
        })

        it('should return specific relationship when relationship is selected', () => {
            const result = modelService.filterBySelection(mockModelData, 'rel-1')
            expect(result).toEqual({ 'unique-id': 'rel-1', source: 'node-1', target: 'node-2' })
        })

        it('should return specific flow when flow is selected', () => {
            const result = modelService.filterBySelection(mockModelData, 'flow-1')
            expect(result).toEqual({ 'unique-id': 'flow-1', name: 'Flow 1' })
        })

        it('should return full model when selection not found', () => {
            const result = modelService.filterBySelection(mockModelData, 'unknown-id')
            expect(result).toEqual(mockModelData)
        })
    })
})
