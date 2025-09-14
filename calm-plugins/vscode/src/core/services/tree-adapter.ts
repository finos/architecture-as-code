import type { ModelIndex } from '../../domain/model'

export interface TreeAdapter {
    setModel(model: ModelIndex): void
    setTemplateMode(enabled: boolean): void
}
