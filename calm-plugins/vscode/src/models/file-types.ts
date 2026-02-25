import * as path from 'path'
import * as fs from 'fs'
import { detectCalmModel, detectCalmTimeline } from './model'
import { parseFrontMatter } from '@finos/calm-shared'

export enum FileType {
    ArchitectureFile = 'architecture',
    TimelineFile = 'timeline',
    TemplateFile = 'template',
    Other = 'other'
}

export interface FileInfo {
    type: FileType
    filePath: string
    architecturePath?: string
    urlMappingPath?: string
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
            const content = fs.readFileSync(filePath, 'utf8')

            // Check for timeline first (more specific)
            if (detectCalmTimeline(content)) {
                return {
                    type: FileType.TimelineFile,
                    filePath,
                    isValid: true
                }
            }

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
        const hasArchitecture = !!parsed?.architecturePath

        return {
            type: FileType.TemplateFile,
            filePath,
            architecturePath: parsed?.architecturePath,
            urlMappingPath: parsed?.urlMappingPath,
            isValid: hasArchitecture
        }
    } catch {
        return {
            type: FileType.Other,
            filePath,
            isValid: false
        }
    }
}
