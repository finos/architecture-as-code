import fs from 'fs';
import { initLogger, Logger } from '../logger.js';
import type { DocumentLoader } from '../document-loader/document-loader.js';
import { DirectUrlDocumentLoader } from '../document-loader/direct-url-document-loader.js';
import { getErrorMessage } from '../error-utils.js';

export interface CalmReferenceResolver {
    canResolve(ref: string): boolean;
    resolve(ref: string): Promise<unknown>;
}

export class FileReferenceResolver implements CalmReferenceResolver {
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', FileReferenceResolver.name);
        }
        return this._logger;
    }

    canResolve(ref: string): boolean {
        return fs.existsSync(ref);
    }

    async resolve(ref: string): Promise<unknown> {
        const logger = FileReferenceResolver.logger;
        logger.info(`Resolving reference: ${ref}`);

        if (!fs.existsSync(ref)) {
            throw new Error(`File not found: ${ref}`);
        }

        return JSON.parse(fs.readFileSync(ref, 'utf-8'));
    }
}

export class InMemoryResolver implements CalmReferenceResolver {
    private data: Record<string, unknown>;

    constructor(data: Record<string, unknown>) {
        this.data = data;
    }

    canResolve(ref: string): boolean {
        return ref in this.data;
    }

    async resolve(ref: string): Promise<unknown> {
        if (!this.data[ref]) {
            throw new Error(`Mocked reference not found: ${ref}`);
        }
        return this.data[ref];
    }
}


/**
 * Fetches http(s) references through a {@link DocumentLoader}, so they get the same host checks as
 * `calm validate`. The default loader allows only calm.finos.org.
 */
export class HttpReferenceResolver implements CalmReferenceResolver {
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', HttpReferenceResolver.name);
        }
        return this._logger;
    }

    constructor(private readonly loader: DocumentLoader = new DirectUrlDocumentLoader(process.env.DEBUG === 'true')) {}

    canResolve(ref: string): boolean {
        return ref.startsWith('http://') || ref.startsWith('https://');
    }

    async resolve(ref: string): Promise<unknown> {
        HttpReferenceResolver.logger.info(`Fetching reference via HTTP: ${ref}`);
        try {
            return await this.loader.loadMissingDocument(ref, 'schema');
        } catch (error) {
            const cause = (error as { cause?: unknown }).cause;
            throw new Error(`HTTP request failed for ${ref}: ${getErrorMessage(error)}${cause ? `: ${getErrorMessage(cause)}` : ''}`);
        }
    }
}

export class CompositeReferenceResolver implements CalmReferenceResolver {
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', CompositeReferenceResolver.name);
        }
        return this._logger;
    }

    private httpResolver: HttpReferenceResolver;
    private fileResolver: FileReferenceResolver;

    constructor() {
        this.httpResolver = new HttpReferenceResolver();
        this.fileResolver = new FileReferenceResolver();
    }

    canResolve(ref: string): boolean {
        return this.fileResolver.canResolve(ref) || this.httpResolver.canResolve(ref);
    }

    async resolve(ref: string): Promise<unknown> {
        if (this.fileResolver.canResolve(ref)) {
            try {
                return await this.fileResolver.resolve(ref);
            } catch (error) {
                CompositeReferenceResolver.logger.debug(`File resolution failed for ${ref} with ${error} - falling back to http-based resolver`);
            }
        }
        if (this.httpResolver.canResolve(ref)) {
            try {
                return await this.httpResolver.resolve(ref);
            } catch (error) {
                CompositeReferenceResolver.logger.info(`HTTP resolution failed for ${ref} with ${error}`);
            }
        }
        throw new Error(`Composite resolver: Unable to resolve reference ${ref}`);
    }
}


export class MappedReferenceResolver implements CalmReferenceResolver {
    constructor(
        private mapping: Map<string, string>,
        private delegate: CalmReferenceResolver
    ) { }

    canResolve(ref: string): boolean {
        const effective = this.getEffectiveRef(ref);
        return this.delegate.canResolve(effective);
    }

    async resolve(ref: string): Promise<unknown> {
        const effective = this.getEffectiveRef(ref);
        return this.delegate.resolve(effective);
    }

    private getEffectiveRef(ref: string): string {
        return this.mapping.get(ref) ?? ref;
    }
}
