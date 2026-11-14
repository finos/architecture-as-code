import { C4_LEVELS, type C4Element, type C4Level } from '@finos/calm-models/c4';
import type { NamespaceC4MappingState } from './useNamespaceC4Mapping.js';

const LEVEL_LABEL: Record<C4Level, string> = {
    context: 'Context',
    container: 'Container',
    component: 'Component',
    deployment: 'Deployment',
};

interface C4ToolbarProps {
    level: C4Level;
    scope?: C4Element;
    scopes: C4Element[];
    /** The scope's chain from the top down, for the breadcrumb. Empty at context and deployment level. */
    breadcrumb: C4Element[];
    guessed: number;
    mappingId: string;
    mappingSource?: NamespaceC4MappingState['source'];
    onLevel: (level: C4Level) => void;
    onScope: (id: string) => void;
    onOpen: (id: string) => void;
}

function mappingTitle(source: C4ToolbarProps['mappingSource']): string {
    if (!source) return 'The default C4 mapping of the C4 standard';
    const from = `config ${source.configId} version ${source.version} of namespace ${source.namespace}`;
    return source.inherited ? `The C4 mapping inherited from ${from}` : `The C4 mapping of this namespace: ${from}`;
}

export function C4Toolbar({ level, scope, scopes, breadcrumb, guessed, mappingId, mappingSource, onLevel, onScope, onOpen }: C4ToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-base-300 bg-base-100 text-sm">
            <div role="radiogroup" aria-label="C4 level" className="join">
                {C4_LEVELS.map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={id === level}
                        className={`join-item btn btn-xs ${id === level ? 'btn-primary' : 'btn-ghost border-base-300'}`}
                        onClick={() => onLevel(id)}
                    >
                        {LEVEL_LABEL[id]}
                    </button>
                ))}
            </div>
            {breadcrumb.length > 1 ? (
                <nav aria-label="C4 scope" className="breadcrumbs text-xs py-0">
                    <ul>
                        {breadcrumb.map((element) => (
                            <li key={element.id}>
                                {element.id === scope?.id ? (
                                    <span aria-current="page">{element.name}</span>
                                ) : (
                                    <button type="button" className="link link-hover" onClick={() => onOpen(element.id)}>
                                        {element.name}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>
            ) : (
                level !== 'deployment' &&
                scopes.length > 0 && (
                    <label className="flex items-center gap-1">
                        <span className="opacity-70">{level === 'component' ? 'Container' : 'System'}</span>
                        <select className="select select-xs select-bordered max-w-48" value={scope?.id} onChange={(e) => onScope(e.target.value)}>
                            {scopes.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )
            )}
            <span className="ml-auto flex items-center gap-2 text-xs">
                <span className="badge badge-ghost badge-sm" title={mappingTitle(mappingSource)}>
                    {mappingId}
                </span>
                {guessed > 0 ? (
                    <span className="badge badge-warning badge-sm" title="Elements whose node type no mapping names">
                        {guessed} guessed from structure
                    </span>
                ) : (
                    <span className="badge badge-success badge-sm">Every element mapped</span>
                )}
            </span>
        </div>
    );
}
