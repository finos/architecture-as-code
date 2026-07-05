import * as path from 'path'

export type DiagramExportFormat = 'svg' | 'png'

/**
 * DiagramExportService - Framework-free service for diagram export logic.
 * Handles default save path computation and data decoding; the panel (View)
 * only handles VSCode-specific I/O (showSaveDialog, workspace.fs.writeFile).
 */
export class DiagramExportService {
    /**
     * Default save path: same directory as the open CALM file (or the
     * workspace root if none is open), named `<arch-basename>-diagram-<n>.<ext>`.
     */
    computeDefaultPath(
        currentFilePath: string | undefined,
        workspaceRoot: string | undefined,
        diagramIndex: number,
        format: DiagramExportFormat
    ): string {
        const dir = currentFilePath ? path.dirname(currentFilePath) : (workspaceRoot ?? '.')
        const baseName = currentFilePath
            ? path.basename(currentFilePath, path.extname(currentFilePath))
            : 'diagram'
        return path.join(dir, `${baseName}-diagram-${diagramIndex}.${format}`)
    }

    decodeExportData(format: DiagramExportFormat, data: string): Buffer {
        return format === 'svg' ? Buffer.from(data, 'utf8') : Buffer.from(data, 'base64')
    }
}
