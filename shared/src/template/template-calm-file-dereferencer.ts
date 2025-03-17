import $RefParser from '@apidevtools/json-schema-ref-parser';
import {CalmReferenceResolver} from '../resolver/calm-reference-resolver';


export type CalmDocument = string;

export class TemplateCalmFileDereferencer {
    private urlFileMapping: Map<string, string>;
    private resolver: CalmReferenceResolver;

    constructor(urlFileMapping: Map<string, string>, resolver: CalmReferenceResolver) {
        this.urlFileMapping = urlFileMapping;
        this.resolver = resolver;
    }

    private replaceUrlsWithRefs(data: unknown): unknown {
        if (typeof data === 'string') {
            const ref = this.urlFileMapping.get(data);
            return ref ? { $ref: ref } : data;
        } else if (Array.isArray(data)) {
            return data.map(this.replaceUrlsWithRefs.bind(this));
        } else if (typeof data === 'object' && data !== null) {
            return Object.fromEntries(
                Object.entries(data).map(([key, value]) =>
                    key === '$id' || key === '$schema' ? [key, value] : [key, this.replaceUrlsWithRefs(value)]
                )
            );
        }
        return data;
    }

    public async dereferenceCalmDoc(doc: CalmDocument): Promise<string> {
        const partiallyDereferenced = this.replaceUrlsWithRefs(JSON.parse(doc));

        const fullyDereferenced = await $RefParser.dereference(partiallyDereferenced, {
            resolve: {
                calmResolver: {
                    order: 1,
                    canRead: (file: { url: string }) => {
                        console.log(`Checking if canRead: ${file.url}`);
                        return this.resolver.canResolve(file.url);
                    },
                    read: async (file: { url: string }) => {
                        console.log(`Resolving: ${file.url}`);
                        const result = await this.resolver.resolve(file.url);
                        const mappedContent = this.replaceUrlsWithRefs(result);
                        return JSON.stringify(mappedContent);
                    }
                }
            }
        });

        return JSON.stringify(fullyDereferenced, null, 2);
    }
}
