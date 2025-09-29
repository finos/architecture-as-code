import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TemplateViewModel } from './template.view-model'

describe('TemplateViewModel', () => {
    let templateViewModel: TemplateViewModel

    beforeEach(() => {
        templateViewModel = new TemplateViewModel()
    })

    afterEach(() => {
        templateViewModel.dispose()
    })

    describe('initialization', () => {
        it('should create template view model with default state', () => {
            expect(templateViewModel).toBeDefined()
            expect(templateViewModel instanceof TemplateViewModel).toBe(true)
            expect(templateViewModel.getTemplateContent()).toBe('')
            expect(templateViewModel.getTemplateName()).toBe('')
            expect(templateViewModel.getIsTemplateMode()).toBe(false)
            expect(templateViewModel.getTemplateFilePath()).toBeUndefined()
            expect(templateViewModel.getArchitectureFilePath()).toBeUndefined()
            expect(templateViewModel.getShowLabels()).toBe(true)
            expect(templateViewModel.getSelectedId()).toBe('none')
            expect(templateViewModel.hasContent()).toBe(false)
        })

        it('should have proper initial state', () => {
            const state = templateViewModel.getState()

            expect(state).toEqual({
                hasContent: false,
                templateName: '',
                isTemplateMode: false,
                selectedId: 'none',
                showLabels: true,
                hasTemplatePath: false,
                hasArchitecturePath: false
            })
        })
    })

    describe('template content management', () => {
        it('should set and get template content with metadata', () => {
            const mockContent = '<template>{{ name }}</template>'
            const mockName = 'service-template'
            const mockSelectedId = 'element-123'
            const mockIsTemplateMode = true

            templateViewModel.setTemplateContent(mockContent, mockName, mockSelectedId, mockIsTemplateMode)

            expect(templateViewModel.getTemplateContent()).toBe(mockContent)
            expect(templateViewModel.getTemplateName()).toBe(mockName)
            expect(templateViewModel.getSelectedId()).toBe(mockSelectedId)
            expect(templateViewModel.getIsTemplateMode()).toBe(mockIsTemplateMode)
            expect(templateViewModel.hasContent()).toBe(true)
        })

        it('should emit template content changed event', () => {
            const contentChangedSpy = vi.fn()
            templateViewModel.onTemplateContentChanged(contentChangedSpy)

            const mockContent = '<template>content</template>'
            const mockName = 'test-template'
            const mockSelectedId = 'element-123'
            const mockIsTemplateMode = true

            templateViewModel.setTemplateContent(mockContent, mockName, mockSelectedId, mockIsTemplateMode)

            expect(contentChangedSpy).toHaveBeenCalledWith({
                content: mockContent,
                name: mockName,
                selectedId: mockSelectedId,
                isTemplateMode: mockIsTemplateMode
            })
        })

        it('should handle empty template content', () => {
            templateViewModel.setTemplateContent('', '', '', false)

            expect(templateViewModel.getTemplateContent()).toBe('')
            expect(templateViewModel.getTemplateName()).toBe('')
            expect(templateViewModel.hasContent()).toBe(false)
        })
    })

    describe('template mode management', () => {
        it('should set and get template mode with paths', () => {
            const mockTemplatePath = '/path/to/template.hbs'
            const mockArchitecturePath = '/path/to/arch.calm'

            templateViewModel.setTemplateMode(true, mockTemplatePath, mockArchitecturePath)

            expect(templateViewModel.getIsTemplateMode()).toBe(true)
            expect(templateViewModel.getTemplateFilePath()).toBe(mockTemplatePath)
            expect(templateViewModel.getArchitectureFilePath()).toBe(mockArchitecturePath)
        })

        it('should emit template mode changed event', () => {
            const modeChangedSpy = vi.fn()
            templateViewModel.onTemplateModeChanged(modeChangedSpy)

            const mockTemplatePath = '/path/to/template.hbs'
            const mockArchitecturePath = '/path/to/arch.calm'

            templateViewModel.setTemplateMode(true, mockTemplatePath, mockArchitecturePath)

            expect(modeChangedSpy).toHaveBeenCalledWith({
                isTemplateMode: true,
                templatePath: mockTemplatePath,
                architecturePath: mockArchitecturePath
            })
        })

        it('should auto-request template data when entering template mode', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })

        it('should not auto-request template data when exiting template mode', () => {
            // Enter template mode first
            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')

            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            // Exit template mode
            templateViewModel.setTemplateMode(false)

            expect(dataRequestSpy).not.toHaveBeenCalled()
        })

        it('should handle template mode without paths', () => {
            templateViewModel.setTemplateMode(true)

            expect(templateViewModel.getIsTemplateMode()).toBe(true)
            expect(templateViewModel.getTemplateFilePath()).toBeUndefined()
            expect(templateViewModel.getArchitectureFilePath()).toBeUndefined()
        })
    })

    describe('show labels preference', () => {
        it('should set and get show labels preference', () => {
            expect(templateViewModel.getShowLabels()).toBe(true)

            templateViewModel.setShowLabels(false)
            expect(templateViewModel.getShowLabels()).toBe(false)

            templateViewModel.setShowLabels(true)
            expect(templateViewModel.getShowLabels()).toBe(true)
        })

        it('should emit show labels changed event', () => {
            const showLabelsChangedSpy = vi.fn()
            templateViewModel.onShowLabelsChanged(showLabelsChangedSpy)

            templateViewModel.setShowLabels(false)

            expect(showLabelsChangedSpy).toHaveBeenCalledWith(false)
        })

        it('should auto-request template data when labels toggle', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setShowLabels(false)

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })
    })

    describe('selected element management', () => {
        it('should set and get selected element ID', () => {
            templateViewModel.setSelectedId('element-123')
            expect(templateViewModel.getSelectedId()).toBe('element-123')

            templateViewModel.setSelectedId('element-456')
            expect(templateViewModel.getSelectedId()).toBe('element-456')
        })

        it('should default to "none" when setting null or undefined', () => {
            templateViewModel.setSelectedId('')
            expect(templateViewModel.getSelectedId()).toBe('none')

            templateViewModel.setSelectedId('element-123')
            expect(templateViewModel.getSelectedId()).toBe('element-123')

            // @ts-ignore - testing runtime behavior
            templateViewModel.setSelectedId(null)
            expect(templateViewModel.getSelectedId()).toBe('none')

            // @ts-ignore - testing runtime behavior  
            templateViewModel.setSelectedId(undefined)
            expect(templateViewModel.getSelectedId()).toBe('none')
        })

        it('should auto-request template data when selection changes', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setSelectedId('element-123')

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })
    })

    describe('template data requests', () => {
        it('should manually request template data', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.requestTemplateData()

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })

        it('should handle multiple template data requests', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.requestTemplateData()
            templateViewModel.requestTemplateData()
            templateViewModel.requestTemplateData()

            expect(dataRequestSpy).toHaveBeenCalledTimes(3)
        })
    })

    describe('auto-refresh triggers', () => {
        it('should auto-refresh on template mode entry', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setTemplateMode(true, '/template.hbs')

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })

        it('should auto-refresh on show labels change', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setShowLabels(false)

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })

        it('should auto-refresh on selected ID change', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            templateViewModel.setSelectedId('element-123')

            expect(dataRequestSpy).toHaveBeenCalledOnce()
        })

        it('should handle multiple auto-refresh triggers', () => {
            const dataRequestSpy = vi.fn()
            templateViewModel.onTemplateDataRequest(dataRequestSpy)

            // Multiple triggers should each fire a request
            templateViewModel.setTemplateMode(true)
            templateViewModel.setShowLabels(false)
            templateViewModel.setSelectedId('element-123')

            expect(dataRequestSpy).toHaveBeenCalledTimes(3)
        })
    })

    describe('content presence checks', () => {
        it('should return false for hasContent with empty string', () => {
            templateViewModel.setTemplateContent('', 'test', 'none', false)
            expect(templateViewModel.hasContent()).toBe(false)
        })

        it('should return true for hasContent with non-empty string', () => {
            templateViewModel.setTemplateContent('<template>test</template>', 'test', 'none', false)
            expect(templateViewModel.hasContent()).toBe(true)
        })

        it('should return true for hasContent with whitespace', () => {
            templateViewModel.setTemplateContent('   ', 'test', 'none', false)
            expect(templateViewModel.hasContent()).toBe(true)
        })
    })

    describe('state management', () => {
        it('should get complete state for debugging', () => {
            templateViewModel.setTemplateContent('<template>test</template>', 'my-template', 'element-123', true)
            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')
            templateViewModel.setShowLabels(false)

            const state = templateViewModel.getState()

            expect(state).toEqual({
                hasContent: true,
                templateName: 'my-template',
                isTemplateMode: true,
                selectedId: 'element-123',
                showLabels: false,
                hasTemplatePath: true,
                hasArchitecturePath: true
            })
        })

        it('should reset all template state', () => {
            // Set some state first
            templateViewModel.setTemplateContent('<template>test</template>', 'my-template', 'element-123', true)
            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')
            templateViewModel.setShowLabels(false)

            const contentChangedSpy = vi.fn()
            const modeChangedSpy = vi.fn()
            templateViewModel.onTemplateContentChanged(contentChangedSpy)
            templateViewModel.onTemplateModeChanged(modeChangedSpy)

            templateViewModel.reset()

            expect(templateViewModel.getTemplateContent()).toBe('')
            expect(templateViewModel.getTemplateName()).toBe('')
            expect(templateViewModel.getIsTemplateMode()).toBe(false)
            expect(templateViewModel.getTemplateFilePath()).toBeUndefined()
            expect(templateViewModel.getArchitectureFilePath()).toBeUndefined()
            expect(templateViewModel.getSelectedId()).toBe('none')
            expect(templateViewModel.hasContent()).toBe(false)

            expect(contentChangedSpy).toHaveBeenCalledWith({
                content: '',
                name: '',
                selectedId: 'none',
                isTemplateMode: false
            })

            expect(modeChangedSpy).toHaveBeenCalledWith({
                isTemplateMode: false,
                templatePath: undefined,
                architecturePath: undefined
            })
        })

        it('should have proper state after reset', () => {
            // Set complex state first
            templateViewModel.setTemplateContent('<template>test</template>', 'my-template', 'element-123', true)
            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')
            templateViewModel.setShowLabels(false)

            templateViewModel.reset()

            const state = templateViewModel.getState()
            expect(state).toEqual({
                hasContent: false,
                templateName: '',
                isTemplateMode: false,
                selectedId: 'none',
                showLabels: false, // Note: reset doesn't affect showLabels, so it stays false
                hasTemplatePath: false,
                hasArchitecturePath: false
            })
        })
    })

    describe('disposal', () => {
        it('should dispose without errors', () => {
            expect(() => templateViewModel.dispose()).not.toThrow()
        })

        it('should dispose all emitters', () => {
            // Set up event listeners
            const contentChangedSpy = vi.fn()
            const modeChangedSpy = vi.fn()
            const dataRequestSpy = vi.fn()
            const showLabelsChangedSpy = vi.fn()

            templateViewModel.onTemplateContentChanged(contentChangedSpy)
            templateViewModel.onTemplateModeChanged(modeChangedSpy)
            templateViewModel.onTemplateDataRequest(dataRequestSpy)
            templateViewModel.onShowLabelsChanged(showLabelsChangedSpy)

            // Dispose
            templateViewModel.dispose()

            // Try to trigger events after disposal - they should not fire
            templateViewModel.setTemplateContent('<template>test</template>', 'test', 'none', false)
            templateViewModel.setTemplateMode(true, '/template.hbs', '/arch.calm')
            templateViewModel.setShowLabels(false)
            templateViewModel.requestTemplateData()

            // Events should not be called after disposal
            expect(contentChangedSpy).not.toHaveBeenCalled()
            expect(modeChangedSpy).not.toHaveBeenCalled()
            expect(dataRequestSpy).not.toHaveBeenCalled()
            expect(showLabelsChangedSpy).not.toHaveBeenCalled()
        })

        it('should allow multiple dispose calls', () => {
            templateViewModel.dispose()
            expect(() => templateViewModel.dispose()).not.toThrow()
        })
    })
})