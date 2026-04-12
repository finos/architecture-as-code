// SPDX-FileCopyrightText: 2024 FINOS CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// The TypeDoc plugin generates docs/api/ and docs/api/typedoc-sidebar.cjs at build time.
// We load it conditionally so the sidebar works whether the API docs are built or not.
let typedocSidebarItems: unknown[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  typedocSidebarItems = require('./docs/api/typedoc-sidebar.cjs') as unknown[];
} catch {
  // API docs not yet generated (will be generated during build by docusaurus-plugin-typedoc)
}

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/quick-start'],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: ['user-guide/architecture-overview'],
    },
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'developer-guide/extension-packs',
        'developer-guide/mcp-server',
        'developer-guide/contributing',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      link: {
        type: 'doc',
        id: 'api/index',
      },
      items: typedocSidebarItems as [],
    },
    {
      type: 'category',
      label: 'ADRs',
      items: ['adrs/index'],
    },
  ],
};

export default sidebars;
