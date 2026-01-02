import * as vscode from 'vscode'
import { initLogger } from '@finos/calm-shared'
import type { Logger } from '../ports/logger'

export class LoggingService implements Logger {
    readonly output: vscode.OutputChannel
    private shared: any

    constructor(scope: string) {
        this.output = vscode.window.createOutputChannel('CALM')
        this.shared = initLogger(true, scope)
    }

    info(msg: string) {
        this.output.appendLine(msg)
        if (this.shared?.info) this.shared.info(msg)
    }

    warn(msg: string) {
        this.output.appendLine('[warn] ' + msg)
        if (this.shared?.warn) this.shared.warn(msg)
    }

    error(msg: string) {
        this.output.appendLine('[error] ' + msg)
        if (this.shared?.error) this.shared.error(msg)
    }

    debug(msg: string) {
        this.output.appendLine('[debug] ' + msg)
        if (this.shared?.debug) this.shared.debug(msg)
    }

    dispose() {
        this.output.dispose()
    }
}
