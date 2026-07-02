import { Link } from 'react-router-dom';
import { IoFolderOpenOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';

interface NamespacePageHeaderProps {
    namespace: string;
    /** Total artefact count for the right-aligned mono meta. */
    total: number;
}

/**
 * Breadcrumb ("Explore / <ns>") + namespace header: rounded icon tile, title,
 * and right-aligned mono "N artefacts" meta. Phase 2 will add the description
 * line and richer meta; Phase 1 keeps it to name + count.
 */
export function NamespacePageHeader({ namespace, total }: NamespacePageHeaderProps) {
    return (
        <div>
            <nav className="text-[13px] mb-4" aria-label="Breadcrumb">
                <Link to="/" className="no-underline hover:underline" style={{ color: colors.redesign.mutedAlt }}>
                    Explore
                </Link>
                <span style={{ color: colors.redesign.mutedAlt }}> / </span>
                <span className="font-semibold" style={{ color: colors.redesign.bodyStrong }}>
                    {namespace}
                </span>
            </nav>

            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center shrink-0 rounded-[11px]"
                    style={{ width: 44, height: 44, backgroundColor: colors.redesign.tintBg }}
                >
                    <IoFolderOpenOutline size={22} style={{ color: colors.redesign.primary }} />
                </div>
                <h1 className="flex-1 min-w-0 truncate text-[27px] font-bold" style={{ color: colors.redesign.ink }}>
                    {namespace}
                </h1>
                <span
                    className="font-mono-jb text-[13px] whitespace-nowrap"
                    style={{ color: colors.redesign.mutedAlt }}
                >
                    {total} {total === 1 ? 'artefact' : 'artefacts'}
                </span>
            </div>
        </div>
    );
}
