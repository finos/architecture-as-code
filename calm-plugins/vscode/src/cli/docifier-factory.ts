/**
 * DocifierFactory - Creates Docifier instances for various use cases
 * Centralizes the import and instantiation of the Docifier from @finos/calm-shared
 */

import { Docifier, DocifyMode, TemplateProcessingMode } from '@finos/calm-shared'

export interface IDocifier {
    docify(): Promise<void>
}

export interface DocifierOptions {
    mode: DocifyMode
    inputPath: string
    outputPath: string
    urlMappingPath?: string
    templateProcessingMode: TemplateProcessingMode
    templatePath?: string
    clearOutputDirectory?: boolean
    scaffoldOnly?: boolean
}

export interface IDocifierFactory {
    create(options: DocifierOptions): IDocifier
}

// Re-export for convenience
export type { DocifyMode, TemplateProcessingMode }

/**
 * Default implementation that creates Docifier instances
 */
export class DocifierFactory implements IDocifierFactory {
    create(options: DocifierOptions): IDocifier {
        return new Docifier(
            options.mode,
            options.inputPath,
            options.outputPath,
            options.urlMappingPath,
            options.templateProcessingMode,
            options.templatePath,
            options.clearOutputDirectory ?? false,
            options.scaffoldOnly ?? false
        )
    }
}

/**
 * Singleton instance for convenience
 */
export const docifierFactory = new DocifierFactory()
