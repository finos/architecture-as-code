import { describe, it, expect } from 'vitest'
import {
    getDefaultOutputDir,
    createFormItems,
    validateOutputDirectory,
    getTemplateBundlePath
} from './form-item-factory'
import { WebsiteFormData } from './types'

describe('form-item-factory', () => {
    describe('getDefaultOutputDir', () => {
        it('should return website subdirectory of architecture file directory', () => {
            const result = getDefaultOutputDir('/project/architecture/arch.json')
            expect(result).toBe('/project/architecture/website')
        })

        it('should handle root level files', () => {
            const result = getDefaultOutputDir('/arch.json')
            expect(result).toBe('/website')
        })
    })

    describe('validateOutputDirectory', () => {
        it('should return undefined for valid directory', () => {
            expect(validateOutputDirectory('/valid/path')).toBeUndefined()
        })

        it('should return error message for empty string', () => {
            expect(validateOutputDirectory('')).toBe('Output directory is required')
        })

        it('should return error message for whitespace only', () => {
            expect(validateOutputDirectory('   ')).toBe('Output directory is required')
        })
    })

    describe('getTemplateBundlePath', () => {
        it('should return custom template path when provided', () => {
            const formData: WebsiteFormData = {
                architecturePath: '/test/arch.json',
                outputDir: '/test/output',
                templateBundlePath: '/custom/template'
            }
            expect(getTemplateBundlePath(formData, '/extension')).toBe('/custom/template')
        })

        it('should return default template path when not provided', () => {
            const formData: WebsiteFormData = {
                architecturePath: '/test/arch.json',
                outputDir: '/test/output'
            }
            expect(getTemplateBundlePath(formData, '/extension')).toBe('/extension/dist/template-bundles/docusaurus')
        })
    })

    describe('createFormItems', () => {
        it('should create form items with default values', () => {
            const formState: WebsiteFormData = {
                architecturePath: '/test/arch.json',
                outputDir: '/test/website'
            }

            const items = createFormItems(formState)

            expect(items).toHaveLength(4)
            expect(items[0].id).toBe('outputDir')
            expect(items[0].description).toBe('/test/website')
            expect(items[1].id).toBe('mappingFile')
            expect(items[1].description).toBe('(none)')
            expect(items[2].id).toBe('templateBundle')
            expect(items[2].description).toBe('(default)')
            expect(items[3].id).toBe('create')
        })

        it('should show mapping file name when provided', () => {
            const formState: WebsiteFormData = {
                architecturePath: '/test/arch.json',
                outputDir: '/test/website',
                mappingFilePath: '/path/to/mapping.json'
            }

            const items = createFormItems(formState)

            expect(items[1].description).toBe('mapping.json')
            expect(items[1].detail).toBe('/path/to/mapping.json')
        })

        it('should show template bundle name when provided', () => {
            const formState: WebsiteFormData = {
                architecturePath: '/test/arch.json',
                outputDir: '/test/website',
                templateBundlePath: '/path/to/custom-bundle'
            }

            const items = createFormItems(formState)

            expect(items[2].description).toBe('custom-bundle')
            expect(items[2].detail).toBe('/path/to/custom-bundle')
        })
    })
})

