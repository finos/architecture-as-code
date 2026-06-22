// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { DiagramExportControl } from './diagram-export-control'

describe('DiagramExportControl', () => {
    let parent: HTMLElement

    beforeEach(() => {
        parent = document.createElement('div')
    })

    it('returns null when no export callbacks are provided', () => {
        const control = new DiagramExportControl()
        expect(control.createControl()).toBeNull()
    })

    it('renders a plain button trigger styled like the other toolbar controls', () => {
        const control = new DiagramExportControl({ onExportSvg: vi.fn() })
        const element = control.createControl()
        parent.appendChild(element as HTMLElement)

        const trigger = parent.querySelector('.diagram-export-trigger')
        expect(trigger?.tagName).toBe('BUTTON')
        expect(trigger?.classList.contains('diagram-control-btn')).toBe(true)
    })

    it('renders only the SVG menu item when only onExportSvg is provided, and invokes it on click', () => {
        const onExportSvg = vi.fn()
        const control = new DiagramExportControl({ onExportSvg })
        parent.appendChild(control.createControl() as HTMLElement)

        const items = Array.from(parent.querySelectorAll('.diagram-export-menu-item'))
        expect(items.map(i => i.textContent)).toEqual(['Export as SVG'])

        items[0].dispatchEvent(new Event('click'))
        expect(onExportSvg).toHaveBeenCalledTimes(1)
    })

    it('renders SVG and PNG menu items and invokes the matching callback', () => {
        const onExportSvg = vi.fn()
        const onExportPng = vi.fn()
        const control = new DiagramExportControl({ onExportSvg, onExportPng })
        parent.appendChild(control.createControl() as HTMLElement)

        const items = Array.from(parent.querySelectorAll('.diagram-export-menu-item'))
        expect(items.map(i => i.textContent)).toEqual(['Export as SVG', 'Export as PNG'])

        items[1].dispatchEvent(new Event('click'))
        expect(onExportPng).toHaveBeenCalledTimes(1)
        expect(onExportSvg).not.toHaveBeenCalled()
    })

    it('toggles the menu when the trigger is clicked', () => {
        const control = new DiagramExportControl({ onExportSvg: vi.fn() })
        parent.appendChild(control.createControl() as HTMLElement)

        const trigger = parent.querySelector('.diagram-export-trigger') as HTMLButtonElement
        const menu = parent.querySelector('.diagram-export-menu') as HTMLElement
        expect(menu.hidden).toBe(true)
        expect(trigger.getAttribute('aria-expanded')).toBe('false')

        trigger.dispatchEvent(new Event('click', { bubbles: true }))
        expect(menu.hidden).toBe(false)
        expect(trigger.getAttribute('aria-expanded')).toBe('true')

        trigger.dispatchEvent(new Event('click', { bubbles: true }))
        expect(menu.hidden).toBe(true)
        expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('closes the menu when selecting an item', () => {
        const control = new DiagramExportControl({ onExportSvg: vi.fn() })
        parent.appendChild(control.createControl() as HTMLElement)

        const trigger = parent.querySelector('.diagram-export-trigger') as HTMLButtonElement
        const menu = parent.querySelector('.diagram-export-menu') as HTMLElement
        const item = parent.querySelector('.diagram-export-menu-item') as HTMLElement

        trigger.dispatchEvent(new Event('click', { bubbles: true }))
        expect(menu.hidden).toBe(false)

        item.dispatchEvent(new Event('click'))
        expect(menu.hidden).toBe(true)
    })

    it('closes the menu when clicking outside the control', () => {
        document.body.appendChild(parent)
        const control = new DiagramExportControl({ onExportSvg: vi.fn() })
        parent.appendChild(control.createControl() as HTMLElement)

        const trigger = parent.querySelector('.diagram-export-trigger') as HTMLButtonElement
        const menu = parent.querySelector('.diagram-export-menu') as HTMLElement

        trigger.dispatchEvent(new Event('click', { bubbles: true }))
        expect(menu.hidden).toBe(false)

        document.body.dispatchEvent(new Event('click', { bubbles: true }))
        expect(menu.hidden).toBe(true)

        document.body.removeChild(parent)
    })

    it('removes the control from the DOM and stops listening for outside clicks on destroy', () => {
        document.body.appendChild(parent)
        const control = new DiagramExportControl({ onExportSvg: vi.fn() })
        parent.appendChild(control.createControl() as HTMLElement)
        expect(parent.querySelector('.diagram-export-control')).not.toBeNull()

        control.destroy()

        expect(parent.querySelector('.diagram-export-control')).toBeNull()
        document.body.removeChild(parent)
    })

    describe('keyboard navigation', () => {
        afterEach(() => {
            parent.parentElement?.removeChild(parent)
        })

        function keydown(target: HTMLElement, key: string): void {
            target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
        }

        function setUp(): { trigger: HTMLButtonElement; menu: HTMLElement; items: HTMLButtonElement[] } {
            document.body.appendChild(parent)
            const control = new DiagramExportControl({ onExportSvg: vi.fn(), onExportPng: vi.fn() })
            parent.appendChild(control.createControl() as HTMLElement)
            return {
                trigger: parent.querySelector('.diagram-export-trigger') as HTMLButtonElement,
                menu: parent.querySelector('.diagram-export-menu') as HTMLElement,
                items: Array.from(parent.querySelectorAll('.diagram-export-menu-item')),
            }
        }

        it('opens the menu and focuses the first item when ArrowDown is pressed on the trigger', () => {
            const { trigger, menu, items } = setUp()

            keydown(trigger, 'ArrowDown')

            expect(menu.hidden).toBe(false)
            expect(document.activeElement).toBe(items[0])
        })

        it('opens the menu and focuses the last item when ArrowUp is pressed on the trigger', () => {
            const { trigger, menu, items } = setUp()

            keydown(trigger, 'ArrowUp')

            expect(menu.hidden).toBe(false)
            expect(document.activeElement).toBe(items[items.length - 1])
        })

        it('moves focus to the next item with ArrowDown and wraps from the last item to the first', () => {
            const { trigger, items } = setUp()
            keydown(trigger, 'ArrowDown')
            expect(document.activeElement).toBe(items[0])

            keydown(items[0], 'ArrowDown')
            expect(document.activeElement).toBe(items[1])

            keydown(items[1], 'ArrowDown')
            expect(document.activeElement).toBe(items[0])
        })

        it('moves focus to the previous item with ArrowUp and wraps from the first item to the last', () => {
            const { trigger, items } = setUp()
            keydown(trigger, 'ArrowDown')
            expect(document.activeElement).toBe(items[0])

            keydown(items[0], 'ArrowUp')
            expect(document.activeElement).toBe(items[items.length - 1])
        })

        it('closes the menu and returns focus to the trigger when Escape is pressed', () => {
            const { trigger, menu, items } = setUp()
            keydown(trigger, 'ArrowDown')
            expect(menu.hidden).toBe(false)

            keydown(items[0], 'Escape')

            expect(menu.hidden).toBe(true)
            expect(document.activeElement).toBe(trigger)
        })

        it('does nothing on Escape when the menu is already closed', () => {
            const { trigger, menu } = setUp()

            expect(() => keydown(trigger, 'Escape')).not.toThrow()
            expect(menu.hidden).toBe(true)
        })

        it('closes the menu when focus moves to an element outside the control', () => {
            const outside = document.createElement('button')
            document.body.appendChild(outside)
            const { trigger, menu, items } = setUp()
            keydown(trigger, 'ArrowDown')
            expect(menu.hidden).toBe(false)

            items[0].dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside, bubbles: true }))

            expect(menu.hidden).toBe(true)
            document.body.removeChild(outside)
        })
    })
})
