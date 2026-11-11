// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import React, { memo, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.1;
const PAN_STEP = 20;
/** A pointer that moves further than this, in pixels, is a drag and not a click. */
const CLICK_TOLERANCE = 4;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

interface View {
  scale: number;
  x: number;
  y: number;
}

interface Tooltip {
  text: string;
  x: number;
  y: number;
}

// Memoized so that a zoom, pan or tooltip change does not replace the SVG nodes.
const DiagramSvg = memo(function DiagramSvg({ svg }: { svg: string }) {
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
});

export interface InteractiveDiagramProps {
  /** SVG markup made by @finos/calm-diagram, which escapes all text from the architecture and keeps it out of ids. */
  svg: string;
  height: number;
}

/** Zoom, pan and node tooltips over a rendered CALM diagram. */
export function InteractiveDiagram({ svg, height }: InteractiveDiagramProps): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  // Pointer capture makes the click target the host, so keep the element under the pointer at pointerdown.
  const pressRef = useRef<{ target: Element; x: number; y: number } | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // React registers wheel listeners as passive, so preventDefault() needs a native listener.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      setView((v) => ({ ...v, scale: clampScale(v.scale + delta) }));
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    pressRef.current = { target: e.target as Element, x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const last = dragRef.current;
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // A cancelled pointer or lost capture sends no pointerup, so end the drag and drop the press.
  const onPointerCancel = () => {
    pressRef.current = null;
    endDrag();
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_TOLERANCE) return;
    const node = (press?.target ?? (e.target as Element)).closest('[data-node-id]');
    const description = node?.getAttribute('data-description') ?? '';
    if (!node || !description) {
      setTooltip(null);
      return;
    }
    const text = `${node.getAttribute('data-node-id') ?? ''}: ${description}`;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip((current) =>
      current?.text === text ? null : { text, x: e.clientX - rect.left, y: e.clientY - rect.top }
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const change: Partial<Record<string, (v: View) => View>> = {
      ArrowLeft: (v) => ({ ...v, x: v.x + PAN_STEP }),
      ArrowRight: (v) => ({ ...v, x: v.x - PAN_STEP }),
      ArrowUp: (v) => ({ ...v, y: v.y + PAN_STEP }),
      ArrowDown: (v) => ({ ...v, y: v.y - PAN_STEP }),
      '+': (v) => ({ ...v, scale: clampScale(v.scale + SCALE_STEP) }),
      '=': (v) => ({ ...v, scale: clampScale(v.scale + SCALE_STEP) }),
      '-': (v) => ({ ...v, scale: clampScale(v.scale - SCALE_STEP) }),
    };
    if (e.key === 'Escape') {
      setTooltip(null);
      return;
    }
    const apply = change[e.key];
    if (!apply) return;
    e.preventDefault();
    setView(apply);
  };

  return (
    <div
      ref={hostRef}
      className="calm-diagram calm-diagram-interactive"
      style={{ height }}
      role="application"
      aria-label="CALM architecture diagram. Scroll or press + and - to zoom, drag or use the arrow keys to pan, click a node for details."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={endDrag}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div
        className="calm-diagram-viewport"
        data-testid="calm-diagram-viewport"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <DiagramSvg svg={svg} />
      </div>
      {tooltip && (
        <div className="calm-diagram-tooltip" role="tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
