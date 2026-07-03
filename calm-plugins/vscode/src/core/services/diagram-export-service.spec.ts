import { describe, it, expect } from 'vitest'
import { DiagramExportService } from './diagram-export-service'

describe('DiagramExportService', () => {
    const service = new DiagramExportService()

    describe('computeDefaultPath', () => {
        it('uses the current file\'s directory and basename', () => {
            const result = service.computeDefaultPath('/test/source/arch.json', '/test/workspace', 1, 'svg')
            expect(result).toBe('/test/source/arch-diagram-1.svg')
        })

        it('uses the png extension and diagram index for png exports', () => {
            const result = service.computeDefaultPath('/test/source/arch.json', '/test/workspace', 2, 'png')
            expect(result).toBe('/test/source/arch-diagram-2.png')
        })

        it('falls back to the workspace root and a generic name when no file is open', () => {
            const result = service.computeDefaultPath(undefined, '/test/workspace', 3, 'png')
            expect(result).toBe('/test/workspace/diagram-diagram-3.png')
        })

        it('falls back to the current directory when neither a file nor a workspace root is open', () => {
            const result = service.computeDefaultPath(undefined, undefined, 1, 'svg')
            expect(result).toBe('diagram-diagram-1.svg')
        })
    })

    describe('decodeExportData', () => {
        it('decodes svg data as a utf8 buffer', () => {
            const result = service.decodeExportData('svg', '<svg>diagram</svg>')
            expect(result).toEqual(Buffer.from('<svg>diagram</svg>', 'utf8'))
        })

        it('decodes png data as a base64-decoded buffer', () => {
            const result = service.decodeExportData('png', 'QkJC')
            expect(result).toEqual(Buffer.from('QkJC', 'base64'))
        })
    })
})
