import $RefParser from '@apidevtools/json-schema-ref-parser';
import { CalmReferenceResolver } from '../resolver/calm-reference-resolver.js';
import { initLogger } from '../logger.js';
import {
    extractNetworkAddressables,
    AddressableEntry
} from '../resolver/network-addressable-extractor.js';
import { NetworkAddressableValidator } from '../resolver/network-addressable-validator.js';

export type CalmDocument = string;

export class TemplateCalmFileDereferencer {
    private urlFileMapping: Map<string, string>;
    private resolver: CalmReferenceResolver;
    private static logger = initLogger(
        process.env.DEBUG === 'true',
        TemplateCalmFileDereferencer.name
    );

    constructor(
        urlFileMapping: Map<string, string>,
        resolver: CalmReferenceResolver
    ) {
        this.urlFileMapping = urlFileMapping;
        this.resolver = resolver;
    }

    public async dereferenceCalmDoc(doc: CalmDocument): Promise<string> {
        const logger = TemplateCalmFileDereferencer.logger;
        logger.debug('dereferenceCalmDoc: starting');
        const json = JSON.parse(doc);
        logger.debug('dereferenceCalmDoc: first replaceUrls pass');
        const firstPass = await this.replaceUrls(json, new Set());

        logger.debug('dereferenceCalmDoc: calling $RefParser.dereference');
        const dereferenced = await $RefParser.dereference(firstPass, {
            resolve: {
                calmResolver: {
                    order: 1,
                    canRead: (file: { url: string }) =>
                        this.resolver.canResolve(file.url),
                    read: async (file: { url: string }) => {
                        logger.debug(`parser.read: resolving ${file.url}`);
                        return JSON.stringify(await this.resolver.resolve(file.url));
                    }
                }
            }
        });

        logger.debug('dereferenceCalmDoc: final replaceUrls pass');
        const final = await this.replaceUrls(dereferenced, new Set());
        logger.debug('dereferenceCalmDoc: completed');

        return JSON.stringify(final, null, 2);
    }

    /**
     * Walks the tree and inlines any HTTP URLs it knows about.
     * Only inlines mapped files or JSON-Schema implementations; leaves other schemas untouched.
     * Uses `seen` to avoid infinite loops.
     */
    private async replaceUrls(
        data: unknown,
        seen: Set<string>
    ): Promise<unknown> {
        const logger = TemplateCalmFileDereferencer.logger;
        logger.debug('replaceUrls: starting');

        const entries: AddressableEntry[] = extractNetworkAddressables(
            JSON.stringify(data)
        );
        logger.debug(`replaceUrls: found ${entries.length} URL entries`);
        const validator = new NetworkAddressableValidator(this.resolver);
        const results = await validator.validate(entries);

        const walk = async (node: unknown): Promise<unknown> => {
            if (typeof node === 'string' && /^https?:\/\//.test(node)) {
                logger.debug(`replaceUrls.walk: examining URL ${node}`);

                if (seen.has(node)) {
                    logger.debug(`replaceUrls.walk: skipping seen URL ${node}`);
                    return node;
                }
                seen.add(node);

                const mapped = this.urlFileMapping.get(node);
                if (mapped) {
                    logger.debug(`replaceUrls.walk: inlining mapped URL ${node}`);
                    const resolved = await this.resolver.resolve(mapped);
                    return walk(resolved);
                }
                const meta = results.find(r => r.entry.value === node);
                if (meta?.reachable && meta.isSchemaImplementation) {
                    logger.debug(`replaceUrls.walk: inlining schema impl ${node}`);
                    const resolved = await this.resolver.resolve(node);
                    return walk(resolved);
                }
                logger.debug(`replaceUrls.walk: leaving URL as-is ${node}`);
                return node;
            }

            if (Array.isArray(node)) {
                logger.debug('replaceUrls.walk: descending into array');
                return Promise.all(node.map(walk));
            }

            if (node && typeof node === 'object') {
                logger.debug('replaceUrls.walk: descending into object');
                const out: Record<string, unknown> = {};
                for (const [key, val] of Object.entries(node)) {
                    out[key] =
                        key === '$id' || key === '$schema'
                            ? val
                            : await walk(val);
                }
                return out;
            }

            return node;
        };

        const result = await walk(data);
        logger.debug('replaceUrls: completed');
        return result;
    }
}
