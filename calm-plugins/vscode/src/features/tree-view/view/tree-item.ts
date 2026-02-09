import * as vscode from 'vscode'
import {ItemVM} from "../view-model/tree-item-view-model";

/**
 * CalmTreeItem - ViewModel wrapper for VSCode TreeItem
 * Presents ItemVM data for VSCode tree UI
 */
export class CalmTreeItem extends vscode.TreeItem {
    constructor(public readonly vm: ItemVM) {
        super(vm.label, CalmTreeItem.getCollapsibleState(vm))

        this.id = vm.id
        this.description = vm.description
        this.contextValue = vm.contextValue
        this.tooltip = vm.description

        if (vm.iconPath) {
            this.iconPath = CalmTreeItem.getIcon(vm.iconPath)
        }

        if (vm.command) {
            this.command = {
                command: vm.command.command,
                title: vm.command.title,
                arguments: vm.command.arguments
            }
        }
    }

    private static getIcon(iconPath: string): vscode.ThemeIcon | string {
        // Map known icon names to VSCode ThemeIcons
        const themeIconMap: Record<string, string> = {
            'info': 'info',
            'search': 'search',
            'calendar': 'calendar',
            'star-full': 'star-full',
            'circle-outline': 'circle-outline',
            'link-external': 'link-external',
            'milestone': 'milestone',
            'history': 'history'
        }

        if (themeIconMap[iconPath]) {
            return new vscode.ThemeIcon(themeIconMap[iconPath])
        }

        return iconPath
    }

    private static getCollapsibleState(vm: ItemVM): vscode.TreeItemCollapsibleState {
        switch (vm.collapsibleState) {
            case 'expanded':
                return vscode.TreeItemCollapsibleState.Expanded
            case 'collapsed':
                return vscode.TreeItemCollapsibleState.Collapsed
            case 'none':
            default:
                return vscode.TreeItemCollapsibleState.None
        }
    }
}