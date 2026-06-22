import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommandRegistry, WebviewCommand, InMsg } from './commands'

function fakeCommand(type: InMsg['type'], execute: (msg: any) => void | Promise<void>): WebviewCommand {
    return { type, execute } as WebviewCommand
}

describe('CommandRegistry', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it('dispatches to the registered command matching the message type', () => {
        const execute = vi.fn()
        const registry = new CommandRegistry()
        registry.register(fakeCommand('ready', execute))

        const msg: InMsg = { type: 'ready' }
        registry.dispatch(msg)

        expect(execute).toHaveBeenCalledWith(msg)
    })

    it('does nothing when no command is registered for the message type', () => {
        const registry = new CommandRegistry()
        expect(() => registry.dispatch({ type: 'ready' })).not.toThrow()
    })

    it('does not log anything when an async command resolves', async () => {
        const registry = new CommandRegistry()
        registry.register(fakeCommand('ready', async () => { }))

        registry.dispatch({ type: 'ready' })
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('catches a rejection from an async command instead of letting it go unhandled', async () => {
        const registry = new CommandRegistry()
        registry.register(fakeCommand('exportDiagram', async () => {
            throw new Error('disposed panel')
        }))

        registry.dispatch({ type: 'exportDiagram', format: 'png', data: '', diagramIndex: 1 })
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('"exportDiagram"'),
            expect.any(Error)
        )
    })
})
