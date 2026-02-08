import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import type { NavigationService } from '../core/services/navigation-service'

// Mock vscode
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn((name, callback) => ({ dispose: vi.fn(), callback }))
    },
    window: {
        showWarningMessage: vi.fn()
    }
}))

import { createNavigateToArchitectureCommand } from './navigate-to-architecture-command'

describe('navigate-to-architecture-command', () => {
    let mockNavigation: NavigationService

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigation = {
            navigateToDetailedArchitecture: vi.fn().mockResolvedValue(true),
            navigate: vi.fn(),
            reset: vi.fn()
        } as unknown as NavigationService
    })

    describe('createNavigateToArchitectureCommand', () => {
        it('should register calm.navigateToArchitecture command', () => {
            const disposable = createNavigateToArchitectureCommand(mockNavigation)

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                'calm.navigateToArchitecture',
                expect.any(Function)
            )
            expect(disposable).toBeDefined()
        })

        it('should show warning when architectureRef is empty', async () => {
            createNavigateToArchitectureCommand(mockNavigation)

            const registerCall = vi.mocked(vscode.commands.registerCommand).mock.calls[0]
            const callback = registerCall[1]

            await callback('')

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'No architecture reference found for this moment'
            )
            expect(mockNavigation.navigateToDetailedArchitecture).not.toHaveBeenCalled()
        })

        it('should show warning when architectureRef is undefined', async () => {
            createNavigateToArchitectureCommand(mockNavigation)

            const registerCall = vi.mocked(vscode.commands.registerCommand).mock.calls[0]
            const callback = registerCall[1]

            await callback(undefined)

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'No architecture reference found for this moment'
            )
            expect(mockNavigation.navigateToDetailedArchitecture).not.toHaveBeenCalled()
        })

        it('should call navigateToDetailedArchitecture with architectureRef', async () => {
            createNavigateToArchitectureCommand(mockNavigation)

            const registerCall = vi.mocked(vscode.commands.registerCommand).mock.calls[0]
            const callback = registerCall[1]

            await callback('https://example.com/arch.json')

            expect(mockNavigation.navigateToDetailedArchitecture).toHaveBeenCalledWith('https://example.com/arch.json')
        })
    })
})

