import React, { useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useSvgExport } from './useSvgExport';
import { requestSvgExport } from './commands';
import type { CanvasFeatureRuntime } from '../types';

export function ImportExportFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const canvasMode = useCanvasStore((state) => state.canvasMode);
    const exportSvg = useSvgExport(runtime.containerRef as React.RefObject<HTMLDivElement | null>, runtime.nodes, canvasMode);

    // The exporter stays in this module and is invoked through a local feature command.
    useEffect(() => requestSvgExport.subscribe(() => { void exportSvg(); }), [exportSvg]);

    return null;
}