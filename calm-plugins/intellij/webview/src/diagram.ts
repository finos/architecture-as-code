import Handlebars from 'handlebars/runtime';
import { parseOptions } from '../vendor/preview-0.6/calm-widgets/src/widgets/block-architecture/core/options-parser';
import { buildBlockArchVM } from '../vendor/preview-0.6/calm-widgets/src/widgets/block-architecture/core/vm-builder';
import { registerGlobalTemplateHelpers } from '../vendor/preview-0.6/calm-widgets/src/widget-helpers';
import type { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import architectureTemplate from './architecture.hbs';
import containerTemplate from '../vendor/preview-0.6/calm-widgets/src/widgets/block-architecture/container.hbs';
import nodeTemplate from '../vendor/preview-0.6/calm-widgets/src/widgets/block-architecture/typed-node.hbs';
import clickTemplate from '../vendor/preview-0.6/calm-widgets/src/widgets/block-architecture/click-links.hbs';
import { readArchitecture } from './model';

const helpers = registerGlobalTemplateHelpers();
Handlebars.registerHelper(helpers);
Handlebars.registerPartial('container.hbs', containerTemplate);
Handlebars.registerPartial('typed-node.hbs', nodeTemplate);
Handlebars.registerPartial('click-links.hbs', clickTemplate);

export function diagramFor(json: string, showLabels = false) {
  const architecture = readArchitecture(json);
  const options = parseOptions({ theme: 'dark', 'render-node-type-shapes': true,
    'layout-engine': 'elk', 'edge-labels': showLabels ? 'description' : 'none' });
  const viewModel = buildBlockArchVM(architecture as unknown as CalmCoreCanonicalModel, options);
  const connectionsByMermaidId = new Map<string, Record<string, unknown>>();
  const occupied = new Set(architecture.nodes.map(node => String(helpers.mermaidId(node['unique-id']))));
  const edges = viewModel.edges.map((edge, index) => {
    let mermaidEdgeId = `calm_connection_${index}`;
    while (occupied.has(mermaidEdgeId)) mermaidEdgeId += '_';
    occupied.add(mermaidEdgeId);
    const matches = architecture.relationships.filter(relationship => {
      const connects = (relationship['relationship-type'] as any)?.connects;
      return relationship['unique-id'] === edge.id && connects?.source?.node === edge.source && connects?.destination?.node === edge.target;
    });
    if (matches.length === 1) connectionsByMermaidId.set(mermaidEdgeId, matches[0]);
    return { ...edge, mermaidEdgeId };
  });
  const code = architectureTemplate({ ...viewModel, edges }).replace(/^```mermaid\s*\n/, '').replace(/\n```\s*$/, '').trim();
  const nodesByMermaidId = new Map(architecture.nodes.map(node => [String(helpers.mermaidId(node['unique-id'])), node]));
  return { architecture, code, nodesByMermaidId, connectionsByMermaidId, connectionCount: viewModel.edges.length };
}
