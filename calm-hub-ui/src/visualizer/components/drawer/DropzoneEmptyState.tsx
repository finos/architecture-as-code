import { IoCloudUploadOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';

interface DropzoneEmptyStateProps {
    /** Whether a file is currently being dragged over the dropzone. */
    isDragActive: boolean;
    /**
     * Message shown when the last dropped file couldn't be read as CALM JSON.
     * When present it replaces the neutral format-helper line with a
     * danger-toned hint. Cleared by {@link Drawer} on a new drag or valid drop.
     */
    error?: string;
}

/**
 * The Visualizer's empty-state dropzone: a bordered, dashed drop area with an
 * upload glyph, a primary "Drag & drop or Browse" line and a format helper line.
 * Purely the resting/idle visual — the `react-dropzone` wiring (root/input props,
 * parse-on-drop) stays in {@link Drawer}; this only restyles what it renders when
 * no diagram is loaded. Drag-active state tints the surface.
 */
export function DropzoneEmptyState({ isDragActive, error }: DropzoneEmptyStateProps) {
    return (
        <div className="flex justify-center items-center h-full w-full p-6">
            <div
                data-testid="dropzone-empty-state"
                className="flex flex-col items-center justify-center text-center gap-2 rounded-[12px] w-full max-w-md px-8 py-12 transition-colors"
                style={{
                    border: `2px dashed ${colors.border.dark}`,
                    backgroundColor: isDragActive ? colors.redesign.tint2 : colors.redesign.surface,
                }}
            >
                <IoCloudUploadOutline
                    size={36}
                    style={{ color: colors.redesign.primary }}
                    aria-hidden="true"
                />
                {isDragActive ? (
                    <p className="text-[15px] font-medium" style={{ color: colors.redesign.primary }}>
                        Drop your file here…
                    </p>
                ) : (
                    <>
                        <p className="text-[15px]" style={{ color: colors.redesign.body }}>
                            Drag &amp; drop or{' '}
                            <span className="font-semibold" style={{ color: colors.redesign.primary }}>
                                Browse
                            </span>
                        </p>
                        {error ? (
                            <p
                                role="alert"
                                className="text-[12px]"
                                style={{ color: colors.status.error }}
                            >
                                {error}
                            </p>
                        ) : (
                            <p className="text-[12px]" style={{ color: colors.redesign.mutedAlt }}>
                                Accepts CALM JSON (architecture / pattern)
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
