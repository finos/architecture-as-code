import * as path from 'path'
import { detectCalmModel } from './model'
import { parseFrontMatter } from '../cli/front-matter'

export enum FileType {
    ArchitectureFile = 'architecture',
    TemplateFile = 'template',
    Other = 'other'
}

export interface FileInfo {
    type: FileType
    filePath: string
    architecturePath?: string
    urlToLocalPathMapping?: Map<string, string>
    isValid: boolean
}

/**
 * Detect the file type and validity for the TreeView
 */
export function detectFileType(filePath: string): FileInfo {
    const ext = path.extname(filePath).toLowerCase()

    // Check if it's a potential architecture file (JSON/YAML)
    if (['.json', '.yaml', '.yml'].includes(ext)) {
        try {
            const content = require('fs').readFileSync(filePath, 'utf8')
            const isArchitecture = detectCalmModel(content)

            return {
                type: FileType.ArchitectureFile,
                filePath,
                isValid: isArchitecture
            }
        } catch {
            return {
                type: FileType.ArchitectureFile,
                filePath,
                isValid: false
            }
        }
    }

    // For any other file type, check if it has front-matter with architecture reference
    try {
        const parsed = parseFrontMatter(filePath)
        const hasArchitecture = parsed?.hasArchitecture || false
        const architecturePath = parsed?.architecturePath

        return {
            type: FileType.TemplateFile,
            filePath,
            architecturePath: architecturePath || undefined,
            urlToLocalPathMapping: parsed?.urlToLocalPathMapping,
            isValid: hasArchitecture && !!architecturePath
        }
    } catch {
        return {
            type: FileType.Other,
            filePath,
            isValid: false
        }
    }
}
