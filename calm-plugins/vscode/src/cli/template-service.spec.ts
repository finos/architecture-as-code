import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateService } from './template-service'

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(() => 'auto')
        }))
    }
}))

const mockContext = {
    extensionUri: { fsPath: '/tmp' }
} as any

const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
} as any

describe('TemplateService', () => {
    let service: TemplateService

    beforeEach(() => {
        service = new TemplateService(mockContext, mockLogger)
        vi.clearAllMocks()
    })

    it('should return relationship-focus template when relationship unique-id matches model (no graph edge)', async () => {
        const loadTemplateSpy = vi
            .spyOn(service as any, 'loadTemplate')
            .mockResolvedValue('REL {{focused-relationship-id}}')
        vi
            .spyOn((service as any).modelService, 'readModelAsync')
            .mockResolvedValue({
                relationships: [{ 'unique-id': 'rel-1' }],
                flows: []
            })

        const result = await service.generateTemplateContent(
            'rel-1',
            { nodes: [], edges: [] },
            '/path/to/model.json',
            true,
            false,
            undefined
        )

        expect(loadTemplateSpy).toHaveBeenCalledWith('relationship-focus-template.hbs', true)
        expect(result).toBe('REL rel-1')
    })

    it('should prefer relationship match over flow when ids overlap', async () => {
        const loadTemplateSpy = vi
            .spyOn(service as any, 'loadTemplate')
            .mockResolvedValue('REL {{focused-relationship-id}}')
        vi
            .spyOn((service as any).modelService, 'readModelAsync')
            .mockResolvedValue({
                relationships: [{ 'unique-id': 'shared-id' }],
                flows: [{ 'unique-id': 'shared-id' }]
            })

        const result = await service.generateTemplateContent(
            'shared-id',
            { nodes: [], edges: [] },
            '/path/to/model.json',
            true,
            false,
            undefined
        )

        expect(loadTemplateSpy).toHaveBeenCalledWith('relationship-focus-template.hbs', true)
        expect(result).toBe('REL shared-id')
    })

    it('should return flow-focus template when graph edge type is flow', async () => {
        const loadTemplateSpy = vi
            .spyOn(service as any, 'loadTemplate')
            .mockResolvedValue('FLOW {{focused-flow-id}}')
        const readModelSpy = vi.spyOn((service as any).modelService, 'readModelAsync')

        const result = await service.generateTemplateContent(
            'flow-edge-1',
            { nodes: [], edges: [{ id: 'flow-edge-1', type: 'flow' }] },
            '/path/to/model.json',
            true,
            false,
            undefined
        )

        expect(loadTemplateSpy).toHaveBeenCalledWith('flow-focus-template.hbs', true)
        expect(readModelSpy).not.toHaveBeenCalled()
        expect(result).toBe('FLOW flow-edge-1')
    })

    it('should return flow-focus template when flow unique-id matches model', async () => {
        const loadTemplateSpy = vi
            .spyOn(service as any, 'loadTemplate')
            .mockResolvedValue('FLOW {{focused-flow-id}}')
        vi
            .spyOn((service as any).modelService, 'readModelAsync')
            .mockResolvedValue({
                relationships: [],
                flows: [{ 'unique-id': 'flow-1' }]
            })

        const result = await service.generateTemplateContent(
            'flow-1',
            { nodes: [], edges: [] },
            '/path/to/model.json',
            true,
            false,
            undefined
        )

        expect(loadTemplateSpy).toHaveBeenCalledWith('flow-focus-template.hbs', true)
        expect(result).toBe('FLOW flow-1')
    })
})
