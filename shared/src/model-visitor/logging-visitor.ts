import { Resolvable, ResolvableAndAdaptable } from '../model/resolvable';
import { CalmModelVisitor } from './calm-model-visitor';
import { initLogger, Logger } from '../logger.js';

export class LoggingVisitor implements CalmModelVisitor {
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', LoggingVisitor.name);
        }
        return this._logger;
    }
    // Setter for testing purposes
    private static set logger(value: Logger) {
        this._logger = value;
    }

    async visit(obj: unknown, path: string[] = []): Promise<void> {
        const logger = LoggingVisitor.logger;
        if (!obj || typeof obj !== 'object') return;
        const keys = Object.keys(obj);
        for (const key of keys) {
            const value = (obj as unknown)[key];
            const fullPath = [...path, key].join('.');

            if (value instanceof Resolvable) {
                logger.info(`[Resolvable] ${fullPath} = ${value.reference ?? '<resolved>'}`);
                if (value.isResolved) {
                    await this.visit(value.value, [...path, key]);
                }
            } else if (value instanceof ResolvableAndAdaptable) {
                logger.info(`[ResolvableAndAdaptable] ${fullPath} = ${value.reference ?? '<resolved>'}`);
                if (value.isResolved) {
                    await this.visit(value.value, [...path, key]);
                }
            }
            else if (Array.isArray(value)) {
                logger.info(`[Array] ${fullPath}`);
                for (let i = 0; i < value.length; i++) {
                    await this.visit(value[i], [...path, key, `[${i}]`]);
                }
            } else if (typeof value === 'object') {
                logger.info(`[Object] ${fullPath}`);
                await this.visit(value, [...path, key]);
            } else {
                logger.info(`[Primitive] ${fullPath} = ${value}`);
            }
        }
    }
}
