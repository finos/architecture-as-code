import { create, type StoreApi } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ModelIndex } from './models/model-index'
import * as vscode from 'vscode'

export interface ApplicationState {
    currentModelIndex: ModelIndex | undefined
    currentDocumentUri: vscode.Uri | undefined
    isTemplateMode: boolean
    templateFilePath: string | undefined
    architectureFilePath: string | undefined
    selectedElementId: string | undefined
    searchFilter: string
    showLabels: boolean
    forceCreatePreview: boolean
}

export interface ApplicationActions {
    setModelIndex: (modelIndex: ModelIndex | undefined) => void
    setCurrentDocument: (uri: vscode.Uri | undefined) => void
    setTemplateMode: (enabled: boolean, templatePath?: string, architecturePath?: string) => void
    setSelectedElement: (id: string | undefined) => void
    setSearchFilter: (filter: string) => void
    setShowLabels: (show: boolean) => void
    setForceCreatePreview: (force: boolean) => void
    clearSelection: () => void
    resetDocument: () => void
}

export type ApplicationStore = ApplicationState & ApplicationActions
export type ApplicationStoreApi = StoreApi<ApplicationStore>

export function createApplicationStore(): ApplicationStoreApi {
    return create<ApplicationStore>()(
        subscribeWithSelector((set, _get) => ({
            currentModelIndex: undefined,
            currentDocumentUri: undefined,
            isTemplateMode: false,
            templateFilePath: undefined,
            architectureFilePath: undefined,
            selectedElementId: undefined,
            searchFilter: '',
            showLabels: true,
            forceCreatePreview: false,

            setModelIndex: (modelIndex) =>
                set({ currentModelIndex: modelIndex }),

            setCurrentDocument: (uri) =>
                set({ currentDocumentUri: uri }),

            setTemplateMode: (enabled, templatePath, architecturePath) =>
                set({
                    isTemplateMode: enabled,
                    templateFilePath: templatePath,
                    architectureFilePath: architecturePath
                }),

            setSelectedElement: (id) =>
                set({ selectedElementId: id }),

            setSearchFilter: (filter) =>
                set({ searchFilter: filter }),

            setShowLabels: (show) =>
                set({ showLabels: show }),

            setForceCreatePreview: (force) =>
                set({ forceCreatePreview: force }),

            clearSelection: () =>
                set({ selectedElementId: undefined }),

            resetDocument: () =>
                set({
                    currentModelIndex: undefined,
                    currentDocumentUri: undefined,
                    isTemplateMode: false,
                    templateFilePath: undefined,
                    architectureFilePath: undefined,
                    selectedElementId: undefined
                }),
        }))
    )
}
