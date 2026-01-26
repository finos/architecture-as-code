import * as vscode from 'vscode'
import * as fs from 'fs'
import { DocifierFactory } from '../../cli/docifier-factory'
import { Dependencies } from './types'
import { ArchitecturePathResolver } from './architecture-path-resolver'
import { WebsiteFormController } from './website-form-controller'
import { DocifyScaffoldRunner } from './docify-scaffold-runner'
import { PostCreationHandler } from './post-creation-handler'
export * from './types'
export { ArchitecturePathResolver } from './architecture-path-resolver'
export { WebsiteFormController } from './website-form-controller'
export { DocifyScaffoldRunner } from './docify-scaffold-runner'
export { PostCreationHandler } from './post-creation-handler'
export * from './form-item-factory'

export class CreateWebsiteCommandHandler {
    private readonly pathResolver: ArchitecturePathResolver
    private readonly formController: WebsiteFormController
    private readonly scaffoldRunner: DocifyScaffoldRunner
    private readonly postCreationHandler: PostCreationHandler

    constructor(deps: Dependencies) {
        this.pathResolver = new ArchitecturePathResolver(deps.window)
        this.formController = new WebsiteFormController(deps.window)
        this.scaffoldRunner = new DocifyScaffoldRunner(deps.window, deps.fs, deps.docifierFactory, deps.extensionPath)
        this.postCreationHandler = new PostCreationHandler(deps.window, deps.commands)
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        const architecturePath = await this.pathResolver.resolve(uri)
        if (!architecturePath) return

        const formData = await this.formController.show(architecturePath)
        if (!formData) return

        await this.scaffoldRunner.run(formData)
        await this.postCreationHandler.handle(formData.outputDir)
    }
}

function createDefaultDependencies(context: vscode.ExtensionContext): Dependencies {
    return {
        window: vscode.window,
        commands: vscode.commands,
        fs: fs,
        docifierFactory: new DocifierFactory(),
        extensionPath: context.extensionPath
    }
}

export function createCreateWebsiteCommand(
    contextOrDeps: vscode.ExtensionContext | Dependencies
): vscode.Disposable {
    const deps = 'extensionPath' in contextOrDeps && 'window' in contextOrDeps && 'docifierFactory' in contextOrDeps
        ? contextOrDeps as Dependencies
        : createDefaultDependencies(contextOrDeps as vscode.ExtensionContext)

    const handler = new CreateWebsiteCommandHandler(deps)

    return deps.commands.registerCommand('calm.createWebsite', async (uri?: vscode.Uri) => {
        try {
            await handler.execute(uri)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            deps.window.showErrorMessage(`Failed to create website: ${message}`)
        }
    })
}
