/**
 * DiagramExportControl - "Export" button with an SVG/PNG dropdown menu.
 * Built from plain elements styled via `.diagram-control-btn` so it matches the
 * existing zoom/pan controls, rather than pulling in a separate UI component library.
 */

export interface DiagramExportControlOptions {
    onExportSvg?: () => void
    onExportPng?: () => void
}

type ExportFormat = 'svg' | 'png'

export class DiagramExportControl {
    private container: HTMLElement | null = null
    private trigger: HTMLButtonElement | null = null
    private menu: HTMLElement | null = null
    private isOpen = false

    private readonly handleOutsideClick = (event: MouseEvent): void => {
        if (this.container && !this.container.contains(event.target as Node)) {
            this.close()
        }
    }

    private readonly handleFocusOut = (event: FocusEvent): void => {
        const next = event.relatedTarget as Node | null
        if (this.container && !this.container.contains(next)) {
            this.close()
        }
    }

    private readonly handleKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            if (!this.isOpen) return
            event.preventDefault()
            this.close()
            this.trigger?.focus()
            return
        }

        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

        const items = this.getMenuItems()
        if (items.length === 0) return

        if (!this.isOpen) {
            event.preventDefault()
            this.open()
            this.focusItemAt(event.key === 'ArrowDown' ? 0 : items.length - 1)
            return
        }

        const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
        if (currentIndex === -1) return
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        this.focusItemAt((currentIndex + delta + items.length) % items.length)
    }

    constructor(private options: DiagramExportControlOptions = {}) {}

    private getMenuItems(): HTMLButtonElement[] {
        return this.menu ? Array.from(this.menu.querySelectorAll('.diagram-export-menu-item')) : []
    }

    private focusItemAt(index: number): void {
        this.getMenuItems()[index]?.focus()
    }

    /**
     * Builds the "Export" trigger and its dropdown menu.
     * Returns null if neither export callback was provided.
     */
    public createControl(): HTMLElement | null {
        const items: { label: string; value: ExportFormat }[] = []
        if (this.options.onExportSvg) {
            items.push({ label: 'Export as SVG', value: 'svg' })
        }
        if (this.options.onExportPng) {
            items.push({ label: 'Export as PNG', value: 'png' })
        }
        if (items.length === 0) {
            return null
        }

        const wrapper = document.createElement('div')
        wrapper.className = 'diagram-export-control diagram-control-group-start'

        const trigger = document.createElement('button')
        trigger.className = 'diagram-control-btn diagram-export-trigger'
        trigger.textContent = 'Export ▾'
        trigger.title = 'Export diagram'
        trigger.setAttribute('aria-label', 'Export diagram')
        trigger.setAttribute('aria-haspopup', 'menu')
        trigger.setAttribute('aria-expanded', 'false')
        trigger.addEventListener('click', (event) => {
            event.stopPropagation()
            this.toggle()
        })

        const menu = document.createElement('div')
        menu.className = 'diagram-export-menu'
        menu.setAttribute('role', 'menu')
        menu.hidden = true

        items.forEach(item => {
            const menuItem = document.createElement('button')
            menuItem.className = 'diagram-export-menu-item'
            menuItem.setAttribute('role', 'menuitem')
            menuItem.textContent = item.label
            menuItem.addEventListener('click', () => {
                this.close()
                if (item.value === 'svg') {
                    this.options.onExportSvg?.()
                } else {
                    this.options.onExportPng?.()
                }
            })
            menu.appendChild(menuItem)
        })

        wrapper.appendChild(trigger)
        wrapper.appendChild(menu)
        wrapper.addEventListener('keydown', this.handleKeydown)
        wrapper.addEventListener('focusout', this.handleFocusOut)

        this.container = wrapper
        this.trigger = trigger
        this.menu = menu
        return wrapper
    }

    private toggle(): void {
        if (this.isOpen) {
            this.close()
        } else {
            this.open()
        }
    }

    private open(): void {
        if (!this.menu || !this.trigger) return
        this.isOpen = true
        this.menu.hidden = false
        this.trigger.setAttribute('aria-expanded', 'true')
        document.addEventListener('click', this.handleOutsideClick)
    }

    private close(): void {
        if (!this.menu || !this.trigger) return
        this.isOpen = false
        this.menu.hidden = true
        this.trigger.setAttribute('aria-expanded', 'false')
        document.removeEventListener('click', this.handleOutsideClick)
    }

    /**
     * Remove the control from the DOM and detach its listeners.
     */
    public destroy(): void {
        this.close()
        if (this.container?.parentElement) {
            this.container.parentElement.removeChild(this.container)
        }
        this.container = null
        this.trigger = null
        this.menu = null
    }
}
