import { Docifier } from './docifier';
import { TemplateProcessor } from '../template/template-processor';
import { Mock } from 'vitest';
import * as urlMapping from '../template/url-mapping';
import * as browserLaunch from './diagram-rendering/browser-launch';
import * as diagramProcessor from './diagram-rendering/markdown-diagram-processor';
import { MermaidBrowserRenderer } from './diagram-rendering/mermaid-browser-renderer';
import { BrowserLaunchError, BrowserOverrideError } from './diagram-rendering/errors';
import type { Browser } from 'playwright-core';
import type { Logger } from '../logger';

vi.mock('../template/template-processor');
vi.mock('../template/url-mapping');
vi.mock('./diagram-rendering/browser-launch');
vi.mock('./diagram-rendering/mermaid-browser-renderer');
vi.mock('./diagram-rendering/markdown-diagram-processor');

const mockLogger: Logger = {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../logger')>();
    return { ...actual, initLogger: vi.fn(() => mockLogger) };
});

const MockedTemplateProcessor: Mock = vi.mocked(TemplateProcessor);

describe('Docifier', () => {
    const inputPath = 'some/input/path';
    const outputPath = 'some/output/path';
    const urlMappingPath = 'some/mapping/path.json';
    const mockUrlMap = new Map<string, string>();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(urlMapping.readUrlMappingFile).mockReturnValue(mockUrlMap);
    });

    it('should throw an error when mode is "SAD"', () => {
        expect(() => {
            new Docifier('SAD', inputPath, outputPath);
        }).toThrowError('Mode "SAD" is not supported.');
    });

    it('should instantiate TemplateProcessor for mode "WEBSITE" and call processTemplate', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(function () { return {
            processTemplate: processTemplateMock,
        }; });

        const docifier = new Docifier('WEBSITE', inputPath, outputPath);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            mockUrlMap,
            'bundle',
            true,
            false,
            false,
            undefined
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should pass clear-output-directory through to template processor', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(function () { return {
            processTemplate: processTemplateMock,
        }; });

        const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlMappingPath, 'bundle', undefined, true);
        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            expect.stringContaining('template-bundles/docusaurus'),
            outputPath,
            mockUrlMap,
            'bundle',
            true,
            true,
            false,
            urlMappingPath
        );
        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should throw if USER_PROVIDED mode is used without templatePath', () => {
        expect(() => {
            new Docifier('USER_PROVIDED', inputPath, outputPath);
        }).toThrowError('USER_PROVIDED mode requires an explicit templatePath.');
    });

    it('should use provided templatePath in USER_PROVIDED mode', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(function () { return {
            processTemplate: processTemplateMock,
        }; });

        const customTemplatePath = '/custom/templates/';
        const docifier = new Docifier(
            'USER_PROVIDED',
            inputPath,
            outputPath,
            undefined,
            'template-directory',
            customTemplatePath
        );

        await docifier.docify();

        expect(MockedTemplateProcessor).toHaveBeenCalledWith(
            inputPath,
            customTemplatePath,
            outputPath,
            mockUrlMap,
            'template-directory',
            true,
            false,
            false,
            undefined
        );

        expect(processTemplateMock).toHaveBeenCalled();
    });

    it('should use fallback path from TEMPLATE_BUNDLE_PATHS if templatePath not provided', async () => {
        const processTemplateMock = vi.fn().mockResolvedValue(undefined);
        MockedTemplateProcessor.mockImplementationOnce(function () { return {
            processTemplate: processTemplateMock,
        }; });

        const docifier = new Docifier('WEBSITE', inputPath, outputPath);
        await docifier.docify();

        const [[calledInput, calledTemplatePath]] = MockedTemplateProcessor.mock.calls;

        expect(calledInput).toBe(inputPath);
        expect(calledTemplatePath).toMatch(/template-bundles\/docusaurus/);
    });

    describe('widget engine support', () => {
        it('should enable widget engine for WEBSITE mode', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(function () { return {
                processTemplate: processTemplateMock,
            }; });

            const docifierWebsite = new Docifier('WEBSITE', inputPath, outputPath);
            await docifierWebsite.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                expect.stringContaining('template-bundles/docusaurus'),
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                false,
                false,
                undefined
            );
        });

        it('should enable widget engine for USER_PROVIDED mode', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementation(function () { return {
                processTemplate: processTemplateMock,
            }; });

            const customTemplatePath = '/custom/template/path';
            const docifierUserProvided = new Docifier('USER_PROVIDED', inputPath, outputPath, undefined, 'bundle', customTemplatePath);
            await docifierUserProvided.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                customTemplatePath,
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                false,
                false,
                undefined
            );
        });
    });

    describe('WEBSITE mode', () => {
        it('should use docusaurus bundle path', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementationOnce(function () { return {
                processTemplate: processTemplateMock,
            }; });

            const docifier = new Docifier('WEBSITE', inputPath, outputPath);
            await docifier.docify();

            const [[, calledTemplatePath]] = MockedTemplateProcessor.mock.calls;
            expect(calledTemplatePath).toMatch(/template-bundles\/docusaurus/);
        });

        it('should pass through all parameters correctly', async () => {
            const processTemplateMock = vi.fn().mockResolvedValue(undefined);
            MockedTemplateProcessor.mockImplementationOnce(function () { return {
                processTemplate: processTemplateMock,
            }; });

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, urlMappingPath, 'bundle', undefined, true);
            await docifier.docify();

            expect(MockedTemplateProcessor).toHaveBeenCalledWith(
                inputPath,
                expect.stringContaining('template-bundles/docusaurus'),
                outputPath,
                mockUrlMap,
                'bundle',
                true,
                true,
                false,
                urlMappingPath
            );
        });
    });

    describe('export diagrams', () => {
        beforeEach(() => {
            MockedTemplateProcessor.mockImplementation(function () { return {
                processTemplate: vi.fn().mockResolvedValue(undefined),
            }; });
        });

        it('does not attempt diagram export when exportDiagrams is not set', async () => {
            const docifier = new Docifier('WEBSITE', inputPath, outputPath);
            await docifier.docify();

            expect(browserLaunch.launchBrowser).not.toHaveBeenCalled();
        });

        it('warns and skips the export pass when no browser can be launched', async () => {
            vi.mocked(browserLaunch.launchBrowser).mockRejectedValue(new BrowserLaunchError('No browser found.'));

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, undefined, 'bundle', undefined, false, false, 'svg');

            await expect(docifier.docify()).resolves.toBeUndefined();
            expect(MermaidBrowserRenderer).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ No browser found.');
        });

        it('propagates BrowserOverrideError from an invalid --browser-path', async () => {
            const overrideError = new BrowserOverrideError('--browser-path \'/bad/path\' does not exist or is not a file.');
            vi.mocked(browserLaunch.launchBrowser).mockRejectedValue(overrideError);

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, undefined, 'bundle', undefined, false, false, 'svg', '/bad/path');

            await expect(docifier.docify()).rejects.toThrow(overrideError);
        });

        it('renders diagrams and logs the summary on success', async () => {
            vi.mocked(browserLaunch.launchBrowser).mockResolvedValue({
                browser: {} as unknown as Browser,
                displayName: 'Google Chrome'
            });

            const startMock = vi.fn().mockResolvedValue(undefined);
            const disposeMock = vi.fn().mockResolvedValue(undefined);
            vi.mocked(MermaidBrowserRenderer).mockImplementation(function () { return {
                start: startMock,
                render: vi.fn(),
                dispose: disposeMock,
            } as unknown as MermaidBrowserRenderer; });

            const summary = { filesScanned: 1, diagramsFound: 1, diagramsRendered: 1, diagramsFailed: 0, failures: [] };
            vi.mocked(diagramProcessor.processDiagramsInDirectory).mockResolvedValue(summary);
            vi.mocked(diagramProcessor.formatDiagramSummary).mockReturnValue('✅ Exported 1/1 diagrams to SVG via Google Chrome in 0.1s.');

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, undefined, 'bundle', undefined, false, false, 'svg');
            await docifier.docify();

            expect(startMock).toHaveBeenCalled();
            expect(diagramProcessor.processDiagramsInDirectory).toHaveBeenCalledWith(outputPath, expect.any(Object), mockLogger);
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Exported 1/1 diagrams to SVG via Google Chrome in 0.1s.');
            expect(disposeMock).toHaveBeenCalled();
        });

        it('passes renderTimeoutMs through to the MermaidBrowserRenderer when provided', async () => {
            vi.mocked(browserLaunch.launchBrowser).mockResolvedValue({
                browser: {} as unknown as Browser,
                displayName: 'Google Chrome'
            });

            const startMock = vi.fn().mockResolvedValue(undefined);
            const disposeMock = vi.fn().mockResolvedValue(undefined);
            vi.mocked(MermaidBrowserRenderer).mockImplementation(function () { return {
                start: startMock,
                render: vi.fn(),
                dispose: disposeMock,
            } as unknown as MermaidBrowserRenderer; });

            const summary = { filesScanned: 1, diagramsFound: 1, diagramsRendered: 1, diagramsFailed: 0, failures: [] };
            vi.mocked(diagramProcessor.processDiagramsInDirectory).mockResolvedValue(summary);
            vi.mocked(diagramProcessor.formatDiagramSummary).mockReturnValue('✅ Exported 1/1 diagrams to SVG via Google Chrome in 0.1s.');

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, undefined, 'bundle', undefined, false, false, 'svg', undefined, 30000);
            await docifier.docify();

            expect(MermaidBrowserRenderer).toHaveBeenCalledWith(expect.objectContaining({ renderTimeoutMs: 30000 }));
        });

        it('processes a single file when --output points at a .md file rather than a directory', async () => {
            vi.mocked(browserLaunch.launchBrowser).mockResolvedValue({
                browser: {} as unknown as Browser,
                displayName: 'Google Chrome'
            });

            const startMock = vi.fn().mockResolvedValue(undefined);
            const disposeMock = vi.fn().mockResolvedValue(undefined);
            vi.mocked(MermaidBrowserRenderer).mockImplementation(function () { return {
                start: startMock,
                render: vi.fn(),
                dispose: disposeMock,
            } as unknown as MermaidBrowserRenderer; });

            const summary = { filesScanned: 1, diagramsFound: 1, diagramsRendered: 1, diagramsFailed: 0, failures: [] };
            vi.mocked(diagramProcessor.processDiagramsInFile).mockResolvedValue(summary);
            vi.mocked(diagramProcessor.formatDiagramSummary).mockReturnValue('✅ Exported 1/1 diagrams to SVG via Google Chrome in 0.1s.');

            const fileOutputPath = 'some/output/path/basic-structures_svg.md';
            const docifier = new Docifier('USER_PROVIDED', inputPath, fileOutputPath, undefined, 'template', 'some/template.hbs', false, false, 'svg');
            await docifier.docify();

            expect(diagramProcessor.processDiagramsInFile).toHaveBeenCalledWith(fileOutputPath, expect.any(Object), mockLogger);
            expect(diagramProcessor.processDiagramsInDirectory).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Exported 1/1 diagrams to SVG via Google Chrome in 0.1s.');
            expect(disposeMock).toHaveBeenCalled();
        });

        it('warns and disposes the renderer when the markdown processing pass throws', async () => {
            vi.mocked(browserLaunch.launchBrowser).mockResolvedValue({
                browser: {} as unknown as Browser,
                displayName: 'Google Chrome'
            });

            const disposeMock = vi.fn().mockResolvedValue(undefined);
            vi.mocked(MermaidBrowserRenderer).mockImplementation(function () { return {
                start: vi.fn().mockResolvedValue(undefined),
                render: vi.fn(),
                dispose: disposeMock,
            } as unknown as MermaidBrowserRenderer; });

            vi.mocked(diagramProcessor.processDiagramsInDirectory).mockRejectedValue(new Error('disk full'));

            const docifier = new Docifier('WEBSITE', inputPath, outputPath, undefined, 'bundle', undefined, false, false, 'png');
            await expect(docifier.docify()).resolves.toBeUndefined();

            expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ Diagram export failed: disk full. Markdown output is unchanged.');
            expect(disposeMock).toHaveBeenCalled();
        });
    });
});

