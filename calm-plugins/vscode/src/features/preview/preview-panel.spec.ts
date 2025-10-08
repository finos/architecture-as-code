import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'
import { CalmPreviewPanel } from './preview-panel'

// Mock VS Code API
vi.mock('vscode', () => ({
  ViewColumn: {
    Beside: 2,
  },
  Uri: {
    file: vi.fn((path: string) => ({
      fsPath: path,
      toString: () => `file://${path}`,
    })),
    joinPath: vi.fn((base, ...paths) => ({
      fsPath: `${base.fsPath}/${paths.join('/')}`,
      toString: () => `file://${base.fsPath}/${paths.join('/')}`,
    })),
  },
  window: {
    createWebviewPanel: vi.fn(() => ({
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn((uri) => ({
          toString: () => `vscode-webview://${uri.fsPath}`,
        })),
      },
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
    })),
  },
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace',
          toString: () => 'file:///test/workspace',
        },
      },
    ],
  },
  Disposable: {
    from: vi.fn(() => ({ dispose: vi.fn() })),
  },
}))

// Mock other dependencies
vi.mock('../../models/file-types', () => ({
  detectFileType: vi.fn(() => ({
    type: 'architecture',
    isValid: true,
    architecturePath: undefined,
  })),
  FileType: {
    TemplateFile: 'template',
    ArchitectureFile: 'architecture',
  },
}))

vi.mock('../../cli/front-matter', () => ({
  parseFrontMatter: vi.fn(() => null),
}))

vi.mock('../../core/services/model-service', () => ({
  ModelService: vi.fn().mockImplementation(() => ({
    readModel: vi.fn(() => ({})),
    filterBySelection: vi.fn(() => ({})),
  })),
}))

vi.mock('../../cli/template-service', () => ({
  TemplateService: vi.fn().mockImplementation(() => ({
    processTemplateForLabels: vi.fn((content) => content),
    generateTemplateContent: vi.fn(() => Promise.resolve('generated content')),
    getTemplateNameForSelection: vi.fn(() => 'test-template'),
  })),
}))

vi.mock('../../cli/html-builder', () => ({
  HtmlBuilder: vi.fn().mockImplementation(() => ({
    getHtml: vi.fn(() => '<html></html>'),
  })),
}))

vi.mock('../../cli/docify-service', () => ({
  DocifyService: vi.fn().mockImplementation(() => ({
    run: vi.fn(() => Promise.resolve({
      content: '# Test Content\n![Test Image](./test.png)',
      format: 'markdown',
      sourceFile: '/test/source/file.md',
    })),
  })),
}))

describe('CalmPreviewPanel', () => {
  let mockContext: any
  let mockConfig: any
  let mockLogger: any
  let mockPanel: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    mockContext = {
      extensionUri: {
        fsPath: '/test/extension',
        toString: () => 'file:///test/extension',
      },
    }

    mockConfig = {}

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    }

    mockPanel = {
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn((uri) => ({
          toString: () => `vscode-webview://${uri.fsPath}`,
        })),
      },
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
    }

    // Mock the static createWebviewPanel call
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel)
  })

  afterEach(() => {
    // Clean up any existing panels
    if (CalmPreviewPanel.currentPanel) {
      CalmPreviewPanel.currentPanel.dispose()
    }
  })

  describe('isRelativePath method', () => {
    let panel: CalmPreviewPanel

    beforeEach(() => {
      panel = new (CalmPreviewPanel as any)(mockPanel, mockContext, mockConfig, mockLogger)
    })

    afterEach(() => {
      panel.dispose()
    })

    it('should return true for relative paths starting with ./', () => {
      const result = (panel as any).isRelativePath('./image.png')
      expect(result).toBe(true)
    })

    it('should return true for relative paths starting with ../', () => {
      const result = (panel as any).isRelativePath('../image.png')
      expect(result).toBe(true)
    })

    it('should return true for relative paths without prefix', () => {
      const result = (panel as any).isRelativePath('image.png')
      expect(result).toBe(true)
    })

    it('should return true for relative paths with subdirectories', () => {
      const result = (panel as any).isRelativePath('assets/images/logo.png')
      expect(result).toBe(true)
    })

    it('should return false for absolute URLs with http://', () => {
      const result = (panel as any).isRelativePath('http://example.com/image.png')
      expect(result).toBe(false)
    })

    it('should return false for absolute URLs with https://', () => {
      const result = (panel as any).isRelativePath('https://example.com/image.png')
      expect(result).toBe(false)
    })

    it('should return false for data URLs', () => {
      const result = (panel as any).isRelativePath('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
      expect(result).toBe(false)
    })

    it('should return false for blob URLs', () => {
      const result = (panel as any).isRelativePath('blob:https://example.com/550e8400-e29b-41d4-a716-446655440000')
      expect(result).toBe(false)
    })

    it('should return false for absolute file paths starting with /', () => {
      const result = (panel as any).isRelativePath('/absolute/path/to/image.png')
      expect(result).toBe(false)
    })

    it('should return false for Windows absolute paths', () => {
      const result = (panel as any).isRelativePath('C:\\path\\to\\image.png')
      expect(result).toBe(false)
    })

    it('should return false for VS Code resource URIs', () => {
      const result = (panel as any).isRelativePath('vscode-resource://file///path/to/image.png')
      expect(result).toBe(false)
    })

    it('should return false for VS Code webview URIs', () => {
      const result = (panel as any).isRelativePath('vscode-webview://file///path/to/image.png')
      expect(result).toBe(false)
    })

    it('should handle empty strings', () => {
      const result = (panel as any).isRelativePath('')
      expect(result).toBe(true)
    })

    it('should handle special characters in relative paths', () => {
      const result = (panel as any).isRelativePath('./images/logo-with-special chars & symbols.png')
      expect(result).toBe(true)
    })
  })

  describe('preprocessMarkdownImages method', () => {
    let panel: CalmPreviewPanel

    beforeEach(() => {
      panel = new (CalmPreviewPanel as any)(mockPanel, mockContext, mockConfig, mockLogger)
    })

    afterEach(() => {
      panel.dispose()
    })

    it('should convert relative image paths to webview URIs', () => {
      const markdown = '# Test\n![Logo](./logo.png)\nSome text'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![Logo](vscode-webview:///test/source/logo.png)')
      expect(mockPanel.webview.asWebviewUri).toHaveBeenCalled()
    })

    it('should convert multiple image references', () => {
      const markdown = '![First](./first.png)\n![Second](./images/second.jpg)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![First](vscode-webview:///test/source/first.png)')
      expect(result).toContain('![Second](vscode-webview:///test/source/images/second.jpg)')
      expect(mockPanel.webview.asWebviewUri).toHaveBeenCalledTimes(2)
    })

    it('should handle ../ relative paths', () => {
      const markdown = '![Parent](../parent.png)'
      const sourceFile = '/test/source/subfolder/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![Parent](vscode-webview:///test/source/parent.png)')
    })

    it('should handle relative paths without ./ prefix', () => {
      const markdown = '![Simple](image.png)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![Simple](vscode-webview:///test/source/image.png)')
    })

    it('should leave absolute URLs unchanged', () => {
      const markdown = '![Remote](https://example.com/image.png)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toBe(markdown) // Should be unchanged
      expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
    })

    it('should leave data URLs unchanged', () => {
      const markdown = '![Data](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toBe(markdown) // Should be unchanged
      expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
    })

    it('should leave absolute file paths unchanged', () => {
      const markdown = '![Absolute](/absolute/path/image.png)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toBe(markdown) // Should be unchanged
      expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
    })

    it('should handle images with complex alt text', () => {
      const markdown = '![Complex alt text with "quotes" and symbols](./image.png)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![Complex alt text with "quotes" and symbols](vscode-webview:///test/source/image.png)')
    })

      it('should handle images with titles using double quotes', () => {
          const markdown = '![Logo](./logo.png "This is the logo")'
          const sourceFile = '/test/source/demo.md'

          const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)

          expect(result).toContain('![Logo](vscode-webview:///test/source/logo.png "This is the logo")')
          expect(mockPanel.webview.asWebviewUri).toHaveBeenCalled()
      })

      it('should handle images with titles using single quotes', () => {
          const markdown = "![Logo](./logo.png 'This is the logo')"
          const sourceFile = '/test/source/demo.md'

          const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)

          expect(result).toContain("![Logo](vscode-webview:///test/source/logo.png 'This is the logo')")
          expect(mockPanel.webview.asWebviewUri).toHaveBeenCalled()
      })

      it('should handle reference-style images by leaving them unchanged', () => {
          const markdown = '![Logo][logo-ref]'
          const sourceFile = '/test/source/demo.md'

          const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)

          expect(result).toBe(markdown) // Should be unchanged
          expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
      })

      it('should handle mixed inline and reference-style images', () => {
          const markdown = '![Inline](./inline.png)\n![Reference][ref]\n![Another](./another.jpg "Title")'
          const sourceFile = '/test/source/demo.md'

          const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)

          expect(result).toContain('![Inline](vscode-webview:///test/source/inline.png)')
          expect(result).toContain('![Reference][ref]') // Unchanged
          expect(result).toContain('![Another](vscode-webview:///test/source/another.jpg "Title")')
      })

    it('should handle images with empty alt text', () => {
      const markdown = '![](./image.png)'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![](vscode-webview:///test/source/image.png)')
    })

    it('should handle mixed content with text before and after images', () => {
      const markdown = `# Title
      
Some text before the image.

![Logo](./logo.png)

More text after the image.

![Another](./other.jpg)

End of document.`
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toContain('![Logo](vscode-webview:///test/source/logo.png)')
      expect(result).toContain('![Another](vscode-webview:///test/source/other.jpg)')
      expect(result).toContain('# Title')
      expect(result).toContain('Some text before')
      expect(result).toContain('End of document.')
    })

    it('should handle edge case with no images', () => {
      const markdown = '# Just text\nNo images here.'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toBe(markdown) // Should be unchanged
      expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
    })

    it('should handle malformed image syntax gracefully', () => {
      const markdown = '![Incomplete markdown image'
      const sourceFile = '/test/source/demo.md'
      
      const result = (panel as any).preprocessMarkdownImages(markdown, sourceFile)
      
      expect(result).toBe(markdown) // Should be unchanged
      expect(mockPanel.webview.asWebviewUri).not.toHaveBeenCalled()
    })

    it('should return original content if preprocessing fails', () => {
      // Mock the webview.asWebviewUri to throw an error
      mockPanel.webview.asWebviewUri = vi.fn(() => {
        throw new Error('Mock webview error')
      })
      
      const result = (panel as any).preprocessMarkdownImages('![Test](./image.png)', '/test/source/demo.md')
      
      expect(result).toContain('![Test](./image.png)') // Should return original on error
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('handleRunDocifyImpl integration', () => {
    let panel: CalmPreviewPanel

    beforeEach(() => {
      panel = new (CalmPreviewPanel as any)(mockPanel, mockContext, mockConfig, mockLogger)
      // Set up minimal state for docify to work
      panel.viewModel.setCurrentUri('/test/demo.md')
      panel.viewModel.handleReady()
    })

    afterEach(() => {
      panel.dispose()
    })

    it('should preprocess markdown images when docify returns markdown format', async () => {
      // Mock docify service to return markdown with images
      const mockDocifyService = panel['docifyService']
      vi.mocked(mockDocifyService.run).mockResolvedValue({
        content: '# Test\n![Logo](./logo.png)',
        format: 'markdown',
        sourceFile: '/test/source/demo.md',
      })

      // Trigger docify
      await panel['handleRunDocifyImpl']()

      // Verify that preprocessing was applied
      expect(mockLogger.info).toHaveBeenCalledWith('[preview] Preprocessing markdown images from source: /test/source/demo.md')
    })

    it('should not preprocess non-markdown content', async () => {
      // Mock docify service to return HTML
      const mockDocifyService = panel['docifyService']
      vi.mocked(mockDocifyService.run).mockResolvedValue({
        content: '<h1>Test</h1><img src="./logo.png" alt="Logo">',
        format: 'html',
        sourceFile: '/test/source/demo.md',
      })

      // Trigger docify
      await panel['handleRunDocifyImpl']()

      // Verify that preprocessing was NOT applied (no markdown preprocessing logs)
      const preprocessingLogs = mockLogger.info.mock.calls.filter((call: any) => 
        call[0] && call[0].includes('Preprocessing markdown images')
      )
      expect(preprocessingLogs).toHaveLength(0)
    })
  })
})