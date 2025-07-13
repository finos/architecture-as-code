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
        const json = JSON.parse(doc);
        const firstPass = await this.replaceUrls(json);
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

        let final: unknown = dereferenced;
        for (let pass = 1; pass <= 5; pass++) {
            logger.debug(`replaceIteration ${pass}: starting`);
            const next = await this.replaceUrls(final);
            if (JSON.stringify(next) === JSON.stringify(final)) {
                break;
            }
            final = next;
        }
        return JSON.stringify(final, null, 2);
    }

    /**
     * Recursively walks the tree and inlines any HTTP URLs it knows about.
     * After resolving, immediately re-walks the resolved value so deeper URLs
     * get inlined in the same pass.
     */
    private async replaceUrls(data: unknown): Promise<unknown> {
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
                const pairs = await Promise.all(
                    Object.entries(node).map(async ([key, val]) => {
                        logger.debug(`replaceUrls.walk: processing key ${key}`);
                        return [
                            key,
                            key === '$id' || key === '$schema'
                                ? val
                                : await walk(val)
                        ];
                    })
                );
                return Object.fromEntries(pairs);
            }

            return node;
        };

        const result = await walk(data);
        logger.debug('replaceUrls: completed');
        return result;
    }
}