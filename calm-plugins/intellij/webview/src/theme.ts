const colorKeys = ['background', 'foreground', 'muted', 'border', 'button', 'buttonText',
  'input', 'inputText', 'accent', 'accentText', 'selection', 'error', 'node', 'container'] as const;

export function applyTheme(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const { colors, dark } = message as { colors?: Record<string, unknown>; dark?: unknown };
  if (typeof dark !== 'boolean' || !colors || !colorKeys.every(key =>
    typeof colors[key] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[key] as string))) return false;
  for (const key of colorKeys) document.documentElement.style.setProperty(`--calm-${key}`, colors[key] as string);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  return true;
}

// Mermaid emits both inline paint and scoped styles. Bind the final SVG to the IDE
// palette so theme changes preserve zoom, selection and unfinished form edits.
export function themeDiagram(svg: SVGSVGElement) {
  const paint = (selector: string, properties: Record<string, string>) => {
    svg.querySelectorAll<SVGElement>(selector).forEach(element => {
      for (const [property, value] of Object.entries(properties)) element.style.setProperty(property, value, 'important');
    });
  };
  paint('.node rect, .node polygon, .node circle, .node ellipse, .node path',
    { fill: 'var(--calm-node)', stroke: 'var(--calm-accent)' });
  paint('.cluster > rect', { fill: 'var(--calm-container)', stroke: 'var(--calm-border)', 'stroke-dasharray': '5 4' });
  paint('text, tspan', { fill: 'var(--calm-foreground)', color: 'var(--calm-foreground)' });
  paint('.nodeLabel, .cluster-label, .edgeLabel', { color: 'var(--calm-foreground)' });
  paint('.edgeLabel rect, .labelBkg', { fill: 'var(--calm-background)', background: 'var(--calm-background)' });
  paint('path.flowchart-link', { stroke: 'var(--calm-foreground)' });
  paint('marker path', { fill: 'var(--calm-foreground)', stroke: 'var(--calm-foreground)' });
}
