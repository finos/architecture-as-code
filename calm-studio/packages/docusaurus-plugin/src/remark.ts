// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { MdxJsxFlowElement, MdxJsxTextElement, MdxJsxAttribute } from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';

const COMPONENT_NAME = 'CalmDiagram';

function isRelativePath(value: string): boolean {
  return value.startsWith('./') || value.startsWith('../');
}

function bundleAttribute(identifier: string): MdxJsxAttribute {
  const attr = {
    type: 'mdxJsxAttribute',
    name: '__bundle',
    value: {
      type: 'mdxJsxAttributeValueExpression',
      value: identifier,
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExpressionStatement',
              expression: { type: 'Identifier', name: identifier },
            },
          ],
        },
      },
    },
  } as unknown as MdxJsxAttribute;
  return attr;
}

function hoistedImports(entries: Array<{ identifier: string; path: string }>): MdxjsEsm {
  const imports = {
    type: 'mdxjsEsm',
    value: entries.map((e) => `import ${e.identifier} from '${e.path}';`).join('\n'),
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: entries.map((e) => ({
          type: 'ImportDeclaration',
          specifiers: [
            {
              type: 'ImportDefaultSpecifier',
              local: { type: 'Identifier', name: e.identifier },
            },
          ],
          source: { type: 'Literal', value: e.path, raw: JSON.stringify(e.path) },
          attributes: [],
        })),
      },
    },
  } as unknown as MdxjsEsm;
  return imports;
}

/**
 * Rewrites <CalmDiagram src="./x.calm.json"> (relative paths only) into a
 * hoisted default import of the .calm.json module (processed by this
 * package's webpack loader) passed as the __bundle prop. Absolute and
 * http(s) src values pass through untouched (remote mode).
 */
const remarkCalmDiagram: Plugin<[], Root> = () => {
  return (tree) => {
    let counter = 0;
    const entries: Array<{ identifier: string; path: string }> = [];

    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
      const el = node as MdxJsxFlowElement | MdxJsxTextElement;
      if (el.name !== COMPONENT_NAME) return;
      const srcAttr = el.attributes.find(
        (attr): attr is MdxJsxAttribute => attr.type === 'mdxJsxAttribute' && attr.name === 'src'
      );
      if (!srcAttr || typeof srcAttr.value !== 'string' || !isRelativePath(srcAttr.value)) return;

      const identifier = `__calmDiagramBundle${counter}`;
      counter += 1;
      entries.push({ identifier, path: srcAttr.value });
      el.attributes = el.attributes.filter((attr) => attr !== srcAttr);
      el.attributes.push(bundleAttribute(identifier));
    });

    if (entries.length > 0) {
      tree.children.unshift(hoistedImports(entries));
    }
  };
};

export default remarkCalmDiagram;
