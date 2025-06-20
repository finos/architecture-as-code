import $RefParser from '@apidevtools/json-schema-ref-parser';
import { CalmReferenceResolver } from '../resolver/calm-reference-resolver.js';
import { initLogger } from '../logger.js';
import { extractNetworkAddressables, AddressableEntry } from '../resolver/network-addressable-extractor.js';
import { NetworkAddressableValidator } from '../resolver/network-addressable-validator.js';
export type CalmDocument = string;

export class TemplateCalmFileDereferencer {
    private urlFileMapping: Map<string, string>;
    private resolver: CalmReferenceResolver;
    private static logger = initLogger(process.env.DEBUG === 'true', TemplateCalmFileDereferencer.name);

    constructor(urlFileMapping: Map<string, string>, resolver: CalmReferenceResolver) {
        this.urlFileMapping = urlFileMapping;
        this.resolver = resolver;
    }

    public async dereferenceCalmDoc(doc: CalmDocument): Promise<string> {
        const logger = TemplateCalmFileDereferencer.logger;
        const json = JSON.parse(doc);

        const entries: AddressableEntry[] = extractNetworkAddressables(doc);

        const validator = new NetworkAddressableValidator(this.resolver);
        const results = await validator.validate(entries);

        const replacer = (data: unknown): unknown => {
            if (typeof data === 'string' && /^https?:\/\//.test(data)) {
                const entry = results.find(r => r.entry.value === data);
                const mappedRef = this.urlFileMapping.get(data);
                if (mappedRef) {
                    return { $ref: mappedRef };
                }
                if (entry?.reachable && entry?.isSchemaImplementation) {
                    return { $ref: data };
                }
                logger.info(`Will not attempt to dereference URL: ${data}`);
                return data;
            } else if (Array.isArray(data)) {
                return data.map(replacer);
            } else if (typeof data === 'object' && data !== null) {
                return Object.fromEntries(
                    Object.entries(data).map(([key, value]) =>
                        key === '$id' || key === '$schema'
                            ? [key, value]
                            : [key, replacer(value)]
                    )
                );
            }
            return data;
        };

        const partiallyDereferenced = replacer(json);

        const fullyDereferenced = await $RefParser.dereference(partiallyDereferenced, {
            resolve: {
                calmResolver: {
                    order: 1,
                    canRead: (file: { url: string }) => this.resolver.canResolve(file.url),
                    read: async (file: { url: string }) => {
                        logger.debug(`Resolving via parser: ${file.url}`);
                        const result = await this.resolver.resolve(file.url);
                        return JSON.stringify(result);
                    }
                }
            }
        });

        return JSON.stringify(fullyDereferenced, null, 2);
    }
}
