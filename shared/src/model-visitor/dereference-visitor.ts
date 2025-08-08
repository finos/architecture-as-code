import {CalmReferenceResolver} from '../resolver/calm-reference-resolver';
import {Resolvable,ResolvableAndAdaptable} from '../model/resolvable';
import {CalmModelVisitor} from './calm-model-visitor';

export class DereferencingVisitor implements CalmModelVisitor {
    private resolver: CalmReferenceResolver;

    constructor(resolver: CalmReferenceResolver) {
        this.resolver = resolver;
    }

    async visit(obj: unknown): Promise<void> {
        if (!obj || typeof obj !== 'object') return;

        if (obj instanceof Resolvable || obj instanceof ResolvableAndAdaptable) {
            if (!obj.isResolved && obj.reference) {
                try {
                    await obj.dereference(this.resolver.resolve.bind(this.resolver));
                } catch (err) {
                    console.warn('Failed to dereference Resolvable:', obj.reference, err.message);
                }
            }
            if (obj.isResolved) {
                //allows for recursive dereferencing
                await this.visit(obj.value);
            }
            return;
        }

        if (Array.isArray(obj)) {
            await Promise.all(obj.map(item => this.visit(item)));
            return;
        }

        const values = Object.values(obj);
        for (const value of values) {
            await this.visit(value);
        }
    }
}
