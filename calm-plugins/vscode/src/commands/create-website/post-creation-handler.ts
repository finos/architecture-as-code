import * as vscode from 'vscode'

export class PostCreationHandler {
    constructor(
        private readonly window: typeof vscode.window,
        private readonly commands: typeof vscode.commands
    ) {}

    async handle(outputDir: string): Promise<void> {
        const action = await this.window.showInformationMessage(
            `Website scaffold created at: ${outputDir}`,
            'Open Folder',
            'Open in Terminal'
        )

        if (action === 'Open Folder') {
            await this.commands.executeCommand('vscode.openFolder', vscode.Uri.file(outputDir), { forceNewWindow: true })
        } else if (action === 'Open in Terminal') {
            const terminal = this.window.createTerminal({ name: 'CALM Website', cwd: outputDir })
            terminal.show()
            terminal.sendText('npm install && npm start')
        }
    }
}

