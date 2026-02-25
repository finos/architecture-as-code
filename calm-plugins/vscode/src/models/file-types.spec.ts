import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileType } from './file-types'

// We need to mock the dependencies before importing detectFileType
vi.mock('./model', () => ({
    detectCalmModel: vi.fn(),
    detectCalmTimeline: vi.fn()
}))

vi.mock('@finos/calm-shared', () => ({
    parseFrontMatter: vi.fn()
}))

// Import after mocks are set up
import { detectFileType } from './file-types'
import { detectCalmModel, detectCalmTimeline } from './model'
import { parseFrontMatter } from '@finos/calm-shared'

// Mock fs.readFileSync at module level
vi.mock('fs', () => ({
    readFileSync: vi.fn()
}))

import * as fs from 'fs'

describe('file-types', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('detectFileType', () => {
        describe('JSON/YAML files', () => {
            it('should detect timeline files when detectCalmTimeline returns true', () => {
                vi.mocked(fs.readFileSync).mockReturnValue('{"moments":[]}')
                vi.mocked(detectCalmTimeline).mockReturnValue(true)
                vi.mocked(detectCalmModel).mockReturnValue(false)

                const result = detectFileType('/path/to/timeline.json')

                expect(result.type).toBe(FileType.TimelineFile)
                expect(result.isValid).toBe(true)
                expect(detectCalmTimeline).toHaveBeenCalled()
            })

            it('should detect architecture files when detectCalmModel returns true', () => {
                vi.mocked(fs.readFileSync).mockReturnValue('{"nodes":[]}')
                vi.mocked(detectCalmTimeline).mockReturnValue(false)
                vi.mocked(detectCalmModel).mockReturnValue(true)

                const result = detectFileType('/path/to/architecture.json')

                expect(result.type).toBe(FileType.ArchitectureFile)
                expect(result.isValid).toBe(true)
            })

            it('should return invalid architecture file when neither timeline nor model detected', () => {
                vi.mocked(fs.readFileSync).mockReturnValue('{"foo":"bar"}')
                vi.mocked(detectCalmTimeline).mockReturnValue(false)
                vi.mocked(detectCalmModel).mockReturnValue(false)

                const result = detectFileType('/path/to/other.json')

                expect(result.type).toBe(FileType.ArchitectureFile)
                expect(result.isValid).toBe(false)
            })

            it('should prioritize timeline detection over architecture', () => {
                vi.mocked(fs.readFileSync).mockReturnValue('{"moments":[]}')
                vi.mocked(detectCalmTimeline).mockReturnValue(true)
                vi.mocked(detectCalmModel).mockReturnValue(true) // Both match

                const result = detectFileType('/path/to/file.json')

                expect(result.type).toBe(FileType.TimelineFile)
            })

            it('should handle file read errors gracefully', () => {
                vi.mocked(fs.readFileSync).mockImplementation(() => {
                    throw new Error('File not found')
                })

                const result = detectFileType('/path/to/missing.json')

                expect(result.type).toBe(FileType.ArchitectureFile)
                expect(result.isValid).toBe(false)
            })

            it('should handle YAML files', () => {
                vi.mocked(fs.readFileSync).mockReturnValue('nodes: []')
                vi.mocked(detectCalmTimeline).mockReturnValue(false)
                vi.mocked(detectCalmModel).mockReturnValue(true)

                const result = detectFileType('/path/to/architecture.yaml')

                expect(result.type).toBe(FileType.ArchitectureFile)
                expect(result.isValid).toBe(true)
            })
        })

        describe('template files', () => {
            it('should detect template files with architecture reference', () => {
                vi.mocked(parseFrontMatter).mockReturnValue({
                    frontMatter: { architecture: './arch.json' },
                    content: 'template content',
                    architecturePath: './arch.json',
                    urlMappingPath: './mapping.json'
                })

                const result = detectFileType('/path/to/template.md')

                expect(result.type).toBe(FileType.TemplateFile)
                expect(result.isValid).toBe(true)
                expect(result.architecturePath).toBe('./arch.json')
                expect(result.urlMappingPath).toBe('./mapping.json')
            })

            it('should return invalid template when no architecture reference', () => {
                vi.mocked(parseFrontMatter).mockReturnValue({
                    frontMatter: {},
                    content: 'template content'
                })

                const result = detectFileType('/path/to/template.md')

                expect(result.type).toBe(FileType.TemplateFile)
                expect(result.isValid).toBe(false)
            })

            it('should return Other file type when parseFrontMatter throws', () => {
                vi.mocked(parseFrontMatter).mockImplementation(() => {
                    throw new Error('Invalid front matter')
                })

                const result = detectFileType('/path/to/file.txt')

                expect(result.type).toBe(FileType.Other)
                expect(result.isValid).toBe(false)
            })
        })
    })
})

