import { colors } from '../../../theme/colors.js';
import { ConventionService } from '../../../service/convention-service.js';
import { NamespaceDefaultConvention } from '../../../model/convention.js';
import { useNamespaceConventions } from './useNamespaceConventions.js';

interface NamespaceConventionsProps {
    namespace: string;
    service?: ConventionService;
}

function DefaultLine({ namespace, defaultConvention }: { namespace: string; defaultConvention?: NamespaceDefaultConvention }) {
    if (!defaultConvention) {
        return <span>No default. Tools use their built-in default.</span>;
    }
    const target = `convention ${defaultConvention.conventionId}, version ${defaultConvention.version}`;
    return defaultConvention.namespace === namespace ? (
        <span>Default: {target}</span>
    ) : (
        <span>
            Default inherited from <span className="font-semibold">{defaultConvention.namespace}</span>: {target}
        </span>
    );
}

/**
 * Read-only list of the namespace's conventions, one group per convention type, with the default that
 * applies to the namespace. Renders nothing when no type has a convention or a default.
 */
export function NamespaceConventions({ namespace, service }: NamespaceConventionsProps) {
    const groups = useNamespaceConventions(namespace, service);
    if (groups.length === 0) {
        return null;
    }

    return (
        <section className="mt-10" aria-labelledby="namespace-conventions-heading" data-testid="namespace-conventions">
            <h2 id="namespace-conventions-heading" className="text-[17px] font-bold" style={{ color: colors.redesign.ink }}>
                Conventions
            </h2>
            {groups.map(({ conventionType, conventions, defaultConvention }) => (
                <div key={conventionType} className="mt-4" data-testid={`convention-group-${conventionType}`}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-mono-jb text-[13px] font-semibold" style={{ color: colors.redesign.bodyStrong }}>
                            {conventionType}
                        </h3>
                        <span className="text-[13px]" style={{ color: colors.redesign.muted }}>
                            <DefaultLine namespace={namespace} defaultConvention={defaultConvention} />
                        </span>
                    </div>
                    {conventions.length > 0 && (
                        <ul
                            className="mt-2 rounded-[10px] border divide-y"
                            style={{ borderColor: colors.redesign.border }}
                        >
                            {conventions.map((convention) => {
                                const isDefault =
                                    defaultConvention?.namespace === namespace && defaultConvention.conventionId === convention.id;
                                return (
                                    <li
                                        key={convention.id}
                                        className="flex items-center gap-3 px-4 py-3"
                                        style={{ borderColor: colors.redesign.border }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[14px] font-semibold truncate"
                                                    style={{ color: colors.redesign.ink }}
                                                >
                                                    {convention.name}
                                                </span>
                                                {isDefault && (
                                                    <span
                                                        className="text-[11px] leading-none rounded-full px-2 py-1"
                                                        style={{
                                                            backgroundColor: colors.redesign.tintBg,
                                                            color: colors.redesign.primaryText,
                                                        }}
                                                    >
                                                        default
                                                    </span>
                                                )}
                                            </div>
                                            {convention.description && (
                                                <p className="text-[13px] truncate" style={{ color: colors.redesign.muted }}>
                                                    {convention.description}
                                                </p>
                                            )}
                                        </div>
                                        <span
                                            className="font-mono-jb text-[11px] whitespace-nowrap"
                                            style={{ color: colors.redesign.mutedAlt }}
                                        >
                                            #{convention.id} · {convention.versionCount}{' '}
                                            {convention.versionCount === 1 ? 'version' : 'versions'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ))}
        </section>
    );
}
