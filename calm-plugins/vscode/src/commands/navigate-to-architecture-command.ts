import * as vscode from 'vscode'
import type { NavigationService } from '../core/services/navigation-service'

/**
 * Command to navigate to an architecture file from a timeline moment.
 * Uses NavigationService to resolve URLs to local files via url mapping.
 */
export function createNavigateToArchitectureCommand(navigation: NavigationService): vscode.Disposable {
    return vscode.commands.registerCommand(
        'calm.navigateToArchitecture',
        async (architectureRef: string) => {
            if (!architectureRef) {
                vscode.window.showWarningMessage('No architecture reference found for this moment')
                return
            }

            await navigation.navigateToDetailedArchitecture(architectureRef)
        }
    )
}
