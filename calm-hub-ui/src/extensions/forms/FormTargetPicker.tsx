import axios from 'axios';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ExtensionContext } from '../../model/extensions.js';
import { CalmService } from '../../service/calm-service.js';

interface Option {
    value: string;
    label: string;
}

type Loader = () => Promise<Option[]>;

interface Options {
    status: 'idle' | 'loading' | 'loaded' | 'failed';
    items: Option[];
    retry: () => void;
}

/** Loads the options of one select. With no loader, the select waits for the choice before it. */
function useOptions(load: Loader | undefined): Options {
    const [tick, setTick] = useState(0);
    const [state, setState] = useState<{ load?: Loader; tick: number; status: Options['status']; items: Option[] }>({
        tick: 0,
        status: 'idle',
        items: [],
    });
    useEffect(() => {
        if (!load) return;
        let cancelled = false;
        load()
            .then((items) => !cancelled && setState({ load, tick, status: 'loaded', items }))
            .catch(() => !cancelled && setState({ load, tick, status: 'failed', items: [] }));
        return () => {
            cancelled = true;
        };
    }, [load, tick]);
    // A result for an earlier choice is not shown, so a slow reply cannot fill a list for the wrong namespace.
    const current =
        load && state.load === load && state.tick === tick ? state : { status: load ? ('loading' as const) : ('idle' as const), items: [] };
    return { status: current.status, items: current.items, retry: () => setTick((n) => n + 1) };
}

type Document = { nodes?: unknown; properties?: { nodes?: { prefixItems?: unknown } } };

/** The nodes of an architecture, or the nodes that a pattern requires. */
function nodeOptions(document: unknown): Option[] {
    const doc = (document ?? {}) as Document;
    const options: Option[] = [];
    const add = (id: unknown, name: unknown) => {
        if (typeof id === 'string' && id !== '')
            options.push({ value: id, label: typeof name === 'string' && name ? `${name} (${id})` : id });
    };
    if (Array.isArray(doc.nodes)) {
        for (const node of doc.nodes as (Record<string, unknown> | null)[]) add(node?.['unique-id'], node?.name);
    } else if (Array.isArray(doc.properties?.nodes?.prefixItems)) {
        for (const item of doc.properties.nodes.prefixItems as ({ properties?: Record<string, { const?: unknown }> } | null)[]) {
            add(item?.properties?.['unique-id']?.const, item?.properties?.name?.const);
        }
    }
    return options;
}

const asOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

interface FormTargetPickerProps {
    /** The choice so far. It can be partial. */
    target: ExtensionContext | undefined;
    /** The form needs a node as well. */
    element: boolean;
    disabled: boolean;
    idPrefix: string;
    error?: string;
    onChange: (target: ExtensionContext) => void;
}

/** Picks the target of a form on a page with no resource context: namespace, resource, version and, when needed, node. */
export function FormTargetPicker({ target = {}, element, disabled, idPrefix, error, onChange }: FormTargetPickerProps) {
    // Not apiClient: a failed list stays in the form and must not open the global auth or outage page.
    const calm = useMemo(() => new CalmService(axios.create()), []);
    const { namespace, resourceId, version, selectedElement } = target;
    const resourceType = target.resourceType ?? 'architectures';
    const patterns = resourceType === 'patterns';

    const namespaces = useOptions(useMemo<Loader>(() => () => calm.fetchNamespaces().then(asOptions), [calm]));
    const resources = useOptions(
        useMemo<Loader | undefined>(
            () =>
                namespace
                    ? () =>
                          (patterns ? calm.fetchPatternSummaries(namespace) : calm.fetchArchitectureSummaries(namespace)).then(
                              (summaries) =>
                                  summaries.map(({ id, name }) => ({ value: String(id), label: name ? `${name} (${id})` : String(id) }))
                          )
                    : undefined,
            [calm, namespace, patterns]
        )
    );
    const versions = useOptions(
        useMemo<Loader | undefined>(
            () =>
                namespace && resourceId
                    ? () =>
                          (patterns
                              ? calm.fetchPatternVersions(namespace, resourceId)
                              : calm.fetchArchitectureVersions(namespace, resourceId)
                          ).then((values) => asOptions(Array.isArray(values) ? values : []))
                    : undefined,
            [calm, namespace, resourceId, patterns]
        )
    );
    const nodes = useOptions(
        useMemo<Loader | undefined>(
            () =>
                element && namespace && resourceId && version
                    ? () =>
                          (patterns
                              ? calm.fetchPattern(namespace, resourceId, version)
                              : calm.fetchArchitecture(namespace, resourceId, version)
                          ).then((data) => nodeOptions(data.data))
                    : undefined,
            [calm, element, namespace, resourceId, version, patterns]
        )
    );

    // A change keeps the choices before it and clears the ones after it.
    const choose = (next: ExtensionContext) => onChange({ resourceType, ...next });
    return (
        <fieldset
            className="grid grid-cols-1 @md:grid-cols-2 gap-3 min-w-0"
            disabled={disabled}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
        >
            <legend className="text-sm font-medium mb-1">Target</legend>
            <Choice
                id={`${idPrefix}-namespace`}
                label="Namespace"
                value={namespace}
                options={namespaces}
                invalid={!!error}
                onChange={(value) => choose({ namespace: value })}
            />
            <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor={`${idPrefix}-type`} className="text-sm">
                    Type
                </label>
                <select
                    id={`${idPrefix}-type`}
                    className="select w-full"
                    value={resourceType}
                    onChange={(event) => onChange({ namespace, resourceType: event.target.value })}
                >
                    <option value="architectures">Architecture</option>
                    <option value="patterns">Pattern</option>
                </select>
            </div>
            <Choice
                id={`${idPrefix}-resource`}
                label={patterns ? 'Pattern' : 'Architecture'}
                value={resourceId}
                options={resources}
                invalid={!!error}
                onChange={(value) => choose({ namespace, resourceId: value })}
            />
            <Choice
                id={`${idPrefix}-version`}
                label="Version"
                value={version}
                options={versions}
                invalid={!!error}
                onChange={(value) => choose({ namespace, resourceId, version: value })}
            />
            {element && (
                <Choice
                    id={`${idPrefix}-node`}
                    label="Node"
                    value={selectedElement}
                    options={nodes}
                    invalid={!!error}
                    onChange={(value) => choose({ namespace, resourceId, version, selectedElement: value })}
                />
            )}
            {error && (
                <p id={`${idPrefix}-error`} className="text-xs text-error @md:col-span-2">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

function Choice({
    id,
    label,
    value,
    options,
    invalid,
    onChange,
}: {
    id: string;
    label: string;
    value?: string;
    options: Options;
    invalid: boolean;
    onChange: (value: string) => void;
}) {
    const placeholder: ReactNode =
        options.status === 'idle'
            ? 'Choose the item above first'
            : options.status === 'loading'
              ? 'Loading…'
              : options.items.length === 0
                ? 'None found'
                : `Choose`;
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor={id} className="text-sm">
                {label}
            </label>
            <select
                id={id}
                className={`select w-full${invalid && !value ? ' select-error' : ''}`}
                value={value ?? ''}
                disabled={options.status !== 'loaded' || options.items.length === 0}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{placeholder}</option>
                {/* A chosen value that the list does not have, such as a target from a link, stays shown. */}
                {value && !options.items.some((option) => option.value === value) && <option value={value}>{value}</option>}
                {options.items.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {options.status === 'failed' && (
                <p className="text-xs text-error">
                    {label} could not be loaded.{' '}
                    <button type="button" className="link" onClick={options.retry}>
                        Try again
                    </button>
                </p>
            )}
        </div>
    );
}
