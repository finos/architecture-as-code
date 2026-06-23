import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    { type: 'doc', id: 'intro', label: 'Overview' },
    {
      type: 'category',
      label: 'For Users',
      collapsed: false,
      items: ['getting-started', 'uploading-architectures', 'reading-reports'],
    },
    {
      type: 'category',
      label: 'For Developers',
      collapsed: false,
      items: [
        'architecture/system-overview',
        'architecture/agent-system',
        'api/reference',
        'compliance/frameworks',
        'contributing',
        'security',
      ],
    },
  ],
};

export default sidebars;
