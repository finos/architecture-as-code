export interface ItemVM {
    id: string
    label: string
    description?: string
    parentId?: string
    childrenIds?: string[]
    contextValue?: string
    collapsibleState?: 'expanded' | 'collapsed' | 'none'
    iconPath?: string
}