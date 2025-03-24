import fs from 'fs';
import { initLogger } from '../logger.js';
import axios from 'axios';

export interface CalmReferenceResolver {
    canResolve(ref: string): boolean;
    resolve(ref: string): Promise<unknown>;
}

export class FileReferenceResolver implements CalmReferenceResolver {

    private static logger = initLogger(process.env.DEBUG === 'true', FileReferenceResolver.name);

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


export class HttpReferenceResolver implements CalmReferenceResolver {
    private static logger = initLogger(process.env.DEBUG === 'true', HttpReferenceResolver.name);

    canResolve(ref: string): boolean {
        return ref.startsWith('http://') || ref.startsWith('https://');
    }

    async resolve(ref: string): Promise<unknown> {
        const logger = HttpReferenceResolver.logger;
        logger.info(`Fetching reference via HTTP: ${ref}`);
        try {
            const response = await axios.get(ref);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`HTTP request failed for ${ref}: ${error.message}`);
            }
            throw error;
        }
    }
}

export class CompositeReferenceResolver implements CalmReferenceResolver {
    private static logger = initLogger(process.env.DEBUG === 'true', CompositeReferenceResolver.name);
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
