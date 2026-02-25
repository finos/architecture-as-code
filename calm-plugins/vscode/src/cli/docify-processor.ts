/**
 * DocifyProcessor - Pure domain logic for docification process
 * Handles content processing and orchestration without file-system or external dependencies
 */
export class DocifyProcessor {

    detectContentFormat(content: string): 'html' | 'markdown' {
        return content.trim().startsWith('<') ? 'html' : 'markdown'
    }

    generateTempFileNames(tempDir: string) {
        return {
            outFile: `${tempDir}/output.md`,
            autoTemplate: `${tempDir}/auto-template.hbs`
        }
    }

    getDocifyConfiguration(templatePath: string | undefined) {
        if (templatePath) {
            return {
                docifyMode: 'USER_PROVIDED' as const,
                templateMode: 'template' as const
            }
        } else {
            return {
                docifyMode: 'WEBSITE' as const,
                templateMode: 'bundle' as const
            }
        }
    }


    /**
     * Validate docify result and extract content information
     */
    processDocifyResult(files: string[], expectedOutputFile: string) {
        const primaryCandidate = expectedOutputFile
        const candidates = files.filter(f =>
            f.endsWith('.html') || f.endsWith('.md') || f.endsWith('.txt')
        )

        if (candidates.length) {
            return {
                outputPath: candidates[0],
                hasOutput: true
            }
        } else if (files.length) {
            return {
                outputPath: files[0],
                hasOutput: true
            }
        }

        return {
            outputPath: primaryCandidate,
            hasOutput: false
        }
    }

    createLogTemplate(templateContent: string): string {
        return templateContent.replace(/\n/g, '\\n')
    }
}