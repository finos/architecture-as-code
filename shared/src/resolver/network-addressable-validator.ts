import { CalmReferenceResolver, HttpReferenceResolver } from './calm-reference-resolver.js';
import { AddressableEntry } from './network-addressable-extractor.js';

export interface ValidationResult {
    entry: AddressableEntry;
    reachable: boolean;
    isSchemaDefinition?: boolean;
    isSchemaImplementation?: boolean;
    error?: string;
}

export class NetworkAddressableValidator {
    private resolver: CalmReferenceResolver;

    constructor(resolver?: CalmReferenceResolver) {
        this.resolver = resolver ?? new HttpReferenceResolver();
    }

    public async validate(
        entries: AddressableEntry[]
    ): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];

        for (const entry of entries) {
            const url = entry.value;
            const result: ValidationResult = { entry, reachable: false, isSchemaDefinition: false, isSchemaImplementation: false };

            try {
                if (!this.resolver.canResolve(url)) {
                    result.error = 'Cannot resolve URL';
                } else {
                    const doc = await this.resolver.resolve(url);
                    result.reachable = true;
                    result.isSchemaDefinition =  this.isJsonSchemaDefinition(doc);
                    result.isSchemaImplementation = this.isJsonSchemaImplementation(doc);
                }
            } catch (err) {
                result.error = err.message;
                result.isSchemaDefinition = false;
                result.isSchemaImplementation = false;
            }

            results.push(result);
        }

        return results;
    }

    /**
     * Detects a JSON Schema _definition_ by presence of schema keywords.
     * These keywords are mandated by a JSON Schema draft and unlikely in arbitrary documents.
     */
    private isJsonSchemaDefinition(doc: unknown): boolean {
        if (typeof doc !== 'object' || doc === null) return false;

        const schemaKeywords = [
            '$schema', 'definitions', '$defs', 'properties', 'patternProperties',
            'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'enum', 'type', 'required'
        ];

        let count = 0;
        for (const key of schemaKeywords) {
            if (key in doc) {
                count++;
                if (count >= 2) return true;
            }
        }

        return false;
    }

    /**
     * Detects a JSON Schema _implementation_ - we expect folks to define the $schema
     */
    private isJsonSchemaImplementation(doc: unknown): boolean {
        if (typeof doc !== 'object' || doc === null) {
            return false;
        }
        return '$schema' in doc && !this.isJsonSchemaDefinition(doc);
    }
}
