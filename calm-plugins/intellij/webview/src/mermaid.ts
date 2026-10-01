import mermaid from 'mermaid';
import elkLayouts from '@mermaid-js/layout-elk';

mermaid.registerLayoutLoaders(elkLayouts);
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', deterministicIds: true,
  logLevel: 'error', flowchart: { padding: 15, nodeSpacing: 40, rankSpacing: 60, htmlLabels: false, useMaxWidth: true },
  maxTextSize: 2_000_000, maxEdges: 10_000 });
let nextId = 0;
export async function renderDiagram(code: string): Promise<string> {
  const { svg } = await mermaid.render(`calm-diagram-${++nextId}`, code);
  return svg;
}
