import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalmService } from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { colors } from '../../../theme/colors.js';
import {
    type TypeInUI,
    resolveResourceDetailPath,
} from '../tree-navigation/navigation-loaders.js';
import { NamespaceItem } from './useNamespaceItems.js';

interface NamespaceResourceGroupProps {
    type: TypeInUI;
    namespace: string;
    items: NamespaceItem[];
}

/**
 * One resource-type section of the Phase-1 namespace placeholder body: a mono
 * type heading and a list of items. Each item navigates to its detail route
 * (latest version resolved on click) so the full browse → detail flow works.
 */
export function NamespaceResourceGroup({ type, namespace, items }: NamespaceResourceGroupProps) {
    const navigate = useNavigate();
    const calmService = useMemo(() => new CalmService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    if (items.length === 0) return null;

    const openItem = async (id: string) => {
        const path = await resolveResourceDetailPath(id, type, namespace, calmService, adrService);
        if (path) navigate(path);
    };

    return (
        <section className="mb-6">
            <h2
                className="font-mono-jb text-[10px] uppercase tracking-[0.1em] mb-2"
                style={{ color: colors.redesign.faintAlt }}
            >
                {type}
            </h2>
            <ul className="flex flex-col gap-1">
                {items.map((item) => (
                    <li key={`${type}-${item.id}`}>
                        <button
                            className="w-full text-left px-3 py-2 rounded-[7px] text-[14px] hover:bg-base-200"
                            style={{ color: colors.redesign.bodyStrong }}
                            onClick={() => openItem(item.id)}
                        >
                            {item.name}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
