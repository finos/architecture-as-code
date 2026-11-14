import { colors } from '../../../theme/colors.js';
import { ConfigService } from '../../../service/config-service.js';
import { NamespaceDefaultConfig } from '../../../model/config.js';
import { useNamespaceConfigs } from './useNamespaceConfigs.js';

interface NamespaceConfigsProps {
    namespace: string;
    service?: ConfigService;
}

function DefaultLine({ namespace, defaultConfig }: { namespace: string; defaultConfig?: NamespaceDefaultConfig }) {
    if (!defaultConfig) {
        return <span>No default. Tools use their built-in default.</span>;
    }
    const target = `config ${defaultConfig.configId}, version ${defaultConfig.version}`;
    return defaultConfig.namespace === namespace ? (
        <span>Default: {target}</span>
    ) : (
        <span>
            Default inherited from <span className="font-semibold">{defaultConfig.namespace}</span>: {target}
        </span>
    );
}

/**
 * Read-only list of the namespace's configs, one group per config type, with the default that
 * applies to the namespace. Renders nothing when no type has a config or a default.
 */
export function NamespaceConfigs({ namespace, service }: NamespaceConfigsProps) {
    const groups = useNamespaceConfigs(namespace, service);
    if (groups.length === 0) {
        return null;
    }

    return (
        <section className="mt-10" aria-labelledby="namespace-configs-heading" data-testid="namespace-configs">
            <h2 id="namespace-configs-heading" className="text-[17px] font-bold" style={{ color: colors.redesign.ink }}>
                Configs
            </h2>
            {groups.map(({ configType, configs, defaultConfig }) => (
                <div key={configType} className="mt-4" data-testid={`config-group-${configType}`}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-mono-jb text-[13px] font-semibold" style={{ color: colors.redesign.bodyStrong }}>
                            {configType}
                        </h3>
                        <span className="text-[13px]" style={{ color: colors.redesign.muted }}>
                            <DefaultLine namespace={namespace} defaultConfig={defaultConfig} />
                        </span>
                    </div>
                    {configs.length > 0 && (
                        <ul
                            className="mt-2 rounded-[10px] border divide-y"
                            style={{ borderColor: colors.redesign.border }}
                        >
                            {configs.map((config) => {
                                const isDefault =
                                    defaultConfig?.namespace === namespace && defaultConfig.configId === config.id;
                                return (
                                    <li
                                        key={config.id}
                                        className="flex items-center gap-3 px-4 py-3"
                                        style={{ borderColor: colors.redesign.border }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[14px] font-semibold truncate"
                                                    style={{ color: colors.redesign.ink }}
                                                >
                                                    {config.name}
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
                                            {config.description && (
                                                <p className="text-[13px] truncate" style={{ color: colors.redesign.muted }}>
                                                    {config.description}
                                                </p>
                                            )}
                                        </div>
                                        <span
                                            className="font-mono-jb text-[11px] whitespace-nowrap"
                                            style={{ color: colors.redesign.mutedAlt }}
                                        >
                                            #{config.id} · {config.versionCount}{' '}
                                            {config.versionCount === 1 ? 'version' : 'versions'}
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
