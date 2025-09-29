import * as fs from 'fs'
import * as path from 'path'

/**
 * Load URL to local path mapping from a JSON file (similar to CLI implementation)
 */
function getUrlToLocalFileMap(urlToLocalFileMapping?: string): Map<string, string> {
    if (!urlToLocalFileMapping) {
        return new Map<string, string>()
    }

    try {
        const basePath = path.dirname(urlToLocalFileMapping)
        const mappingJson = JSON.parse(fs.readFileSync(urlToLocalFileMapping, 'utf-8'))

        return new Map(
            Object.entries(mappingJson).map(([url, relativePath]) => [
                url,
                path.resolve(basePath, String(relativePath))
            ])
        )
    } catch (err) {
        console.error(`Error reading url to local file mapping file: ${urlToLocalFileMapping}`, err)
        return new Map<string, string>()
    }
}

export interface FrontMatter {
    architecture?: string
    urlToLocalPathMapping?: string
    'url-to-local-file-mapping'?: string
    [key: string]: any
}

export interface ParsedTemplate {
    frontMatter: FrontMatter
    content: string
    hasArchitecture: boolean
    architecturePath?: string
    urlToLocalPathMapping?: Map<string, string>
}

/**
 * Parse YAML front-matter from a template file
 */
export function parseFrontMatter(filePath: string): ParsedTemplate | null {
    try {
        const content = fs.readFileSync(filePath, 'utf8')
        return parseFrontMatterFromContent(content, filePath)
    } catch {
        return null
    }
}

/**
 * Parse YAML front-matter from file content
 */
export function parseFrontMatterFromContent(content: string, filePath?: string): ParsedTemplate | null {
    // Check if content starts with front-matter delimiter
    if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
        return {
            frontMatter: {},
            content,
            hasArchitecture: false,
            urlToLocalPathMapping: undefined
        }
    }

    // Find the closing front-matter delimiter
    const lines = content.split(/\r?\n/)
    let endLineIndex = -1

    // Start from line 1 (skip the opening ---)
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            endLineIndex = i
            break
        }
    }

    if (endLineIndex === -1) {
        // Invalid front-matter format - no closing ---
        return {
            frontMatter: {},
            content,
            hasArchitecture: false,
            urlToLocalPathMapping: undefined
        }
    }

    // Extract front-matter YAML (lines 1 to endLineIndex-1)
    const frontMatterLines = lines.slice(1, endLineIndex)
    const frontMatterYaml = frontMatterLines.join('\n')

    // Extract template content (everything after the closing ---)
    const templateContentLines = lines.slice(endLineIndex + 1)
    const templateContent = templateContentLines.join('\n')

    try {
        // Parse YAML front-matter
        const yaml = require('yaml')
        const frontMatter = yaml.parse(frontMatterYaml) || {}

        let architecturePath: string | undefined
        let hasArchitecture = false
        let urlToLocalPathMapping: Map<string, string> | undefined

        if (frontMatter.architecture) {
            hasArchitecture = true
            // Resolve relative paths relative to the template file
            if (filePath && !path.isAbsolute(frontMatter.architecture)) {
                architecturePath = path.resolve(path.dirname(filePath), frontMatter.architecture)
            } else {
                architecturePath = frontMatter.architecture
            }
        }

        // Process URL to local path mapping if specified
        if (frontMatter.urlToLocalPathMapping || frontMatter['url-to-local-file-mapping']) {
            let mappingPath = frontMatter.urlToLocalPathMapping || frontMatter['url-to-local-file-mapping']
            // Resolve relative paths relative to the template file
            if (filePath && !path.isAbsolute(mappingPath!)) {
                mappingPath = path.resolve(path.dirname(filePath), mappingPath!)
            }
            urlToLocalPathMapping = getUrlToLocalFileMap(mappingPath!)
        }

        return {
            frontMatter,
            content: templateContent,
            hasArchitecture,
            architecturePath,
            urlToLocalPathMapping
        }
    } catch {
        // YAML parsing failed
        return {
            frontMatter: {},
            content,
            hasArchitecture: false,
            urlToLocalPathMapping: undefined
        }
    }
}

/**
 * Check if a file is a template file with architecture front-matter
 */
export function isTemplateFileWithArchitecture(filePath: string): boolean {
    // Check any file type - don't restrict by extension
    const parsed = parseFrontMatter(filePath)
    return parsed?.hasArchitecture || false
}

/**
 * Get the architecture file path from a template file
 */
export function getArchitecturePathFromTemplate(filePath: string): string | null {
    const parsed = parseFrontMatter(filePath)
    return parsed?.architecturePath || null
}

/**
 * Get the URL to local path mapping from a template file
 */
export function getUrlToLocalPathMappingFromTemplate(filePath: string): Map<string, string> | null {
    const parsed = parseFrontMatter(filePath)
    return parsed?.urlToLocalPathMapping || null
}