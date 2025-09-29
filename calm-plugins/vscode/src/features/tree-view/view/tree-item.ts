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
            if (vm.iconPath === 'info' || vm.iconPath === 'search') {
                this.iconPath = new vscode.ThemeIcon(vm.iconPath)
            } else {
                this.iconPath = vm.iconPath
            }
        }
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