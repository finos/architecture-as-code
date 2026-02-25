import * as path from 'path'
import { WebsiteFormData, FormQuickPickItem } from './types'

export function getDefaultOutputDir(architecturePath: string): string {
    return path.join(path.dirname(architecturePath), 'website')
}

export function createFormItems(formState: WebsiteFormData): FormQuickPickItem[] {
    return [
        {
            id: 'outputDir',
            label: '$(folder) Output Directory',
            description: formState.outputDir,
            detail: 'Click to change the output directory'
        },
        {
            id: 'mappingFile',
            label: '$(file) URL Mapping File',
            description: formState.mappingFilePath ? path.basename(formState.mappingFilePath) : '(none)',
            detail: formState.mappingFilePath ?? 'Optional: Click to select a URL mapping file'
        },
        {
            id: 'templateBundle',
            label: '$(package) Template Bundle',
            description: formState.templateBundlePath ? path.basename(formState.templateBundlePath) : '(default)',
            detail: formState.templateBundlePath ?? 'Optional: Click to select a custom template bundle'
        },
        {
            id: 'create',
            label: '$(check) Create Website',
            description: '',
            detail: 'Generate the website scaffold with the configured options'
        }
    ]
}

export function validateOutputDirectory(value: string): string | undefined {
    return value.trim() ? undefined : 'Output directory is required'
}

export function getTemplateBundlePath(formData: WebsiteFormData, extensionPath: string): string {
    return formData.templateBundlePath ?? path.join(extensionPath, 'dist', 'template-bundles', 'docusaurus')
}

