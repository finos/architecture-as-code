import { create, type StoreApi } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ModelIndex } from './models/model-index'
import type { CalmTimeline } from '@finos/calm-models/model'
import * as vscode from 'vscode'

export interface ApplicationState {
    currentModelIndex: ModelIndex | undefined
    currentDocumentUri: vscode.Uri | undefined
    currentTimeline: CalmTimeline | undefined
    isTimelineMode: boolean
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
    setTimeline: (timeline: CalmTimeline | undefined) => void
    setTimelineMode: (enabled: boolean) => void
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
            currentTimeline: undefined,
            isTimelineMode: false,
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

            setTimeline: (timeline) =>
                set({ currentTimeline: timeline, isTimelineMode: !!timeline }),

            setTimelineMode: (enabled) =>
                set({ isTimelineMode: enabled, currentTimeline: enabled ? _get().currentTimeline : undefined }),

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
                    currentTimeline: undefined,
                    isTimelineMode: false,
                    isTemplateMode: false,
                    templateFilePath: undefined,
                    architectureFilePath: undefined,
                    selectedElementId: undefined
                }),
        }))
    )
}
