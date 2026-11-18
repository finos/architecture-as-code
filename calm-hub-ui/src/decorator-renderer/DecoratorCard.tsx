import { useState } from 'react';
import { DecoratorValue } from './DecoratorValue.js';
import { decoratorTypeLabel, isWebUrl } from './value-shape.js';
import { writableDecorator } from './writable.js';

/**
 * The decorator fields the renderer reads. Kept structural so the renderer does not depend on Hub types. The API does
 * not require every field, so the card copes with any of them missing.
 */
export interface RenderableDecorator {
    uniqueId?: string;
    type?: string;
    schema?: string;
    target?: string[];
    targetType?: string[];
    appliesTo?: string[];
    creationDateTime?: string;
    updateDateTime?: string;
    data?: unknown;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

function Timestamp({ label, value }: { label: string; value: unknown }) {
    if (!isText(value)) return null;
    return (
        <span>
            <span className="text-base-content/50">{label}</span> <DecoratorValue value={value} />
        </span>
    );
}

export function DecoratorCard({ decorator }: { decorator: RenderableDecorator }) {
    const [view, setView] = useState<'data' | 'json'>('data');
    const appliesTo = Array.isArray(decorator.appliesTo) ? decorator.appliesTo.filter((id): id is string => typeof id === 'string') : [];
    const type = decoratorTypeLabel(decorator.type);
    const uniqueId = isText(decorator.uniqueId) ? decorator.uniqueId : '';
    const schema = isText(decorator.schema) ? decorator.schema : '';
    const hasTimestamps = [decorator.creationDateTime, decorator.updateDateTime].some(isText);
    const toggleClass = (active: boolean) => `join-item btn btn-xs ${active ? 'btn-active' : ''}`;

    return (
        <article className="card card-border bg-base-100 text-sm" aria-label={`${type} decorator ${uniqueId}`.trim()}>
            <div className="card-body p-3 gap-2">
                <header className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-primary badge-soft badge-sm font-semibold">{type}</span>
                    <span className="font-mono text-xs text-base-content/60 break-all flex-1 min-w-0">{uniqueId}</span>
                    <div className="join" role="group" aria-label="Decorator view">
                        <button type="button" aria-pressed={view === 'data'} className={toggleClass(view === 'data')} onClick={() => setView('data')}>
                            Data
                        </button>
                        <button type="button" aria-pressed={view === 'json'} className={toggleClass(view === 'json')} onClick={() => setView('json')}>
                            JSON
                        </button>
                    </div>
                </header>
                {schema && (
                    <div className="text-xs text-base-content/60 break-all">
                        Schema:{' '}
                        {isWebUrl(schema) ? (
                            <a href={schema} target="_blank" rel="noopener noreferrer" className="link">
                                {schema}
                            </a>
                        ) : (
                            schema
                        )}
                    </div>
                )}
                {appliesTo.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-base-content/50">Applies to</span>
                        {appliesTo.map((id, index) => (
                            <span key={`${id}-${index}`} className="badge badge-ghost badge-sm font-mono">
                                {id}
                            </span>
                        ))}
                    </div>
                )}
                {hasTimestamps && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <Timestamp label="Created" value={decorator.creationDateTime} />
                        <Timestamp label="Updated" value={decorator.updateDateTime} />
                    </div>
                )}
                {view === 'data' ? (
                    <DecoratorValue value={decorator.data} />
                ) : (
                    <>
                        <p className="text-xs text-base-content/60 m-0">
                            The JSON that a decorator write takes. CALM Hub sets the created and updated times, so they are not in it.
                        </p>
                        <pre className="text-xs font-mono bg-base-200 rounded-box p-2 overflow-auto max-h-96 m-0">
                            {JSON.stringify(writableDecorator(decorator), null, 2)}
                        </pre>
                    </>
                )}
            </div>
        </article>
    );
}
