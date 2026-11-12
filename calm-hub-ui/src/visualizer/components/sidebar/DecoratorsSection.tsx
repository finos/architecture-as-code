import { useMemo } from 'react';
import { DecoratorCard, decoratorKeys } from '../../../decorator-renderer/index.js';
import { useDecorators } from '../../context/DecoratorsContext.js';
import { Section } from './detail-components.js';

/**
 * The decorators whose `applies-to` names the selected node or relationship. A container also lists those of the
 * containment relationships that it draws, so it lists each decorator that its badges count. A badge can count only the
 * newest decorator of each key, so the title says that this list has all of them.
 */
export function DecoratorsSection({ elementId }: { elementId: string }) {
    const { decorators, drawnAs } = useDecorators();
    const matching = useMemo(
        () => decorators.filter((decorator) => Array.isArray(decorator.appliesTo)
            && decorator.appliesTo.some((id) => id === elementId || drawnAs.get(id) === elementId)),
        [decorators, drawnAs, elementId]
    );
    const keys = useMemo(() => decoratorKeys(matching), [matching]);
    if (matching.length === 0) return null;
    return (
        <Section title="All decorators">
            <p className="text-xs text-base-content/60 mb-2">Also the older ones that a badge does not count.</p>
            <div className="flex flex-col gap-2">
                {matching.map((decorator, index) => (
                    <DecoratorCard key={keys[index]} decorator={decorator} />
                ))}
            </div>
        </Section>
    );
}
