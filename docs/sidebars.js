/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Default sidebar - shows when clicking CALM logo (introduction, core-concepts, working-with-calm)
  docsSidebar: [
    'home',
    {
      type: 'category',
      label: 'Introduction',
      link: {type: 'doc', id: 'introduction/introduction-index'},
      items: [
        'introduction/what-is-calm',
        'introduction/why-use-calm', 
        'introduction/key-features',
      ],
    },
    {
      type: 'category', 
      label: 'Core Concepts',
      link: {type: 'doc', id: 'core-concepts/core-concepts-index'},
      items: [
        'core-concepts/nodes',
        'core-concepts/relationships',
        'core-concepts/interfaces',
        'core-concepts/controls',
        'core-concepts/standards',
        'core-concepts/timelines',
        'core-concepts/decorators',
        'core-concepts/metadata',
        'core-concepts/patterns',
        'core-concepts/widgets'
      ],
    },
    {
      type: 'category',
      label: 'Working with CALM',
      link: {type: 'doc', id: 'working-with-calm/working-with-calm-index'},
      items: [
        'working-with-calm/installation',
        'working-with-calm/using-the-cli',
        'working-with-calm/generate',
        'working-with-calm/validate',
        'working-with-calm/docify',
        'working-with-calm/hub',
        'working-with-calm/validation-server',
        'working-with-calm/calm-ai-tools',
        'working-with-calm/voice-mode'
      ],
    },
  ],

  // Learning sidebar - tutorials
  learningSidebar: [
    {
      type: 'category',
      label: 'Tutorials',
      link: {type: 'doc', id: 'tutorials/tutorials'},
      collapsed: false,
      items: [
        {
          type: 'category',
          label: '🟢 Beginner',
          link: {type: 'doc', id: 'tutorials/beginner/beginner-tutorials'},
          items: [
            'tutorials/beginner/01-setup',
            'tutorials/beginner/02-first-node',
            'tutorials/beginner/03-relationships',
            'tutorials/beginner/04-vscode-extension',
            'tutorials/beginner/05-interfaces',
            'tutorials/beginner/06-metadata',
            'tutorials/beginner/07-complete-architecture',
          ],
        },
        {
          type: 'category',
          label: '🟡 Intermediate',
          link: {type: 'doc', id: 'tutorials/intermediate/intermediate-tutorials'},
          items: [
            'tutorials/intermediate/08-controls',
            'tutorials/intermediate/09-business-flows',
            'tutorials/intermediate/10-adr-linking',
            'tutorials/intermediate/11-docify',
            'tutorials/intermediate/12-calm-widgets',
            'tutorials/intermediate/13-handlebars-templates',
            'tutorials/intermediate/14-ai-advisor',
            'tutorials/intermediate/15-ops-advisor',
            'tutorials/intermediate/16-ops-docs',
            'tutorials/intermediate/17-patterns',
            'tutorials/intermediate/18-standards',
            'tutorials/intermediate/19-enforcing-standards',
            'tutorials/intermediate/20-multi-pattern-validation',
          ],
        },
        {
          type: 'category',
          label: '🟠 Advanced',
          link: {type: 'doc', id: 'tutorials/advanced/advanced-tutorials'},
          items: [
            'tutorials/advanced/architecture-discovery-skill-tutorial',
          ],
        },
        {
          type: 'category',
          label: '🛠️ Practitioner',
          link: {type: 'doc', id: 'tutorials/build-a-calm-architecture/build-a-calm-architecture'},
          items: [
            'tutorials/build-a-calm-architecture/tool-setup',
            'tutorials/build-a-calm-architecture/business-context',
            'tutorials/build-a-calm-architecture/define-initial-architecture',
            'tutorials/build-a-calm-architecture/refine-architecture-definition',
            'tutorials/build-a-calm-architecture/generate-documentation',
            'tutorials/build-a-calm-architecture/tutorial-key-takeaways',
           ],
        }
      ],
    },
  ],

  // CALM Studio sidebar — migrated from calm-suite/calm-studio/docs-site/sidebars.ts
  calmStudioSidebar: [
    'calm-studio/intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['calm-studio/getting-started/quick-start'],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: ['calm-studio/user-guide/architecture-overview'],
    },
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'calm-studio/developer-guide/extension-packs',
        'calm-studio/developer-guide/mcp-server',
        'calm-studio/developer-guide/contributing',
      ],
    },
    {
      type: 'category',
      label: 'ADRs',
      items: [
        'calm-studio/adrs/index',
        'calm-studio/adrs/use-svelte-5-over-react',
        'calm-studio/adrs/use-svelte-flow-as-canvas',
        'calm-studio/adrs/use-elk-for-auto-layout',
        'calm-studio/adrs/domain-oriented-control-keys',
        'calm-studio/adrs/defer-calmscript-dsl',
        'calm-studio/adrs/extension-pack-system',
        'calm-studio/adrs/mcp-server-as-primary-ai-integration',
        'calm-studio/adrs/docusaurus-for-documentation',
        'calm-studio/adrs/tsup-for-calm-core-packaging',
        'calm-studio/adrs/github-pages-hosting',
      ],
    },
  ],
};

export default sidebars;
