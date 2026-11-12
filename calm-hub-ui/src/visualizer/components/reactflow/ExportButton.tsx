import { useState } from 'react';
import { ControlButton, useReactFlow, useStore } from '@xyflow/react';
import { ImageDown } from 'lucide-react';
import { THEME } from './theme.js';
import { colors } from '../../../theme/colors.js';
import { diagramBounds, exportDiagram, exportFileName, getBoundsOfRects, labelRects, type ExportFormat } from './utils/diagramExport.js';

interface ExportButtonProps {
    /** Names the saved file. */
    diagramKey?: string;
}

const FORMATS: ExportFormat[] = ['svg', 'png'];
// The callouts are measured with the edge labels, as drawn.
const NO_CALLOUTS = new Map();

/** Saves the whole diagram, as it is drawn, as an SVG or PNG image. */
export function ExportButton({ diagramKey }: ExportButtonProps) {
    const [open, setOpen] = useState(false);
    const { getNodes, getZoom, getInternalNode } = useReactFlow();
    const flow = useStore((state) => state.domNode);

    const save = (format: ExportFormat) => {
        setOpen(false);
        const viewport = flow?.querySelector<HTMLElement>('.react-flow__viewport');
        if (!flow || !viewport) return;
        exportDiagram(
            viewport,
            labelRects(viewport, getZoom()).reduce(
                getBoundsOfRects,
                diagramBounds(getNodes().map((n) => getInternalNode(n.id) ?? n), NO_CALLOUTS),
            ),
            format,
            exportFileName(diagramKey, format),
            getComputedStyle(flow).backgroundColor,
        ).catch((error) => console.error('%s', 'Diagram export failed:', error));
    };

    return (
        <div style={{ position: 'relative' }} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
            <ControlButton
                onClick={() => setOpen(!open)}
                title="Export image"
                aria-label="Export image"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <ImageDown size={14} color={open ? colors.redesign.primaryText : THEME.colors.muted} />
            </ControlButton>
            {open && (
                <div
                    role="menu"
                    style={{
                        position: 'absolute',
                        left: 'calc(100% + 8px)',
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        background: THEME.colors.card,
                        border: `1px solid ${THEME.colors.border}`,
                        borderRadius: '8px',
                        padding: '4px',
                    }}
                >
                    {FORMATS.map((format) => (
                        <button
                            key={format}
                            role="menuitem"
                            onClick={() => save(format)}
                            className="text-xs font-semibold px-3 py-1 rounded hover:bg-base-200"
                            style={{ color: THEME.colors.foreground }}
                        >
                            {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
