import type { ModelIndex } from '../../domain/model-index'

export interface TreeAdapter {
    setModel(model: ModelIndex): void
    setTemplateMode(enabled: boolean): void
}
