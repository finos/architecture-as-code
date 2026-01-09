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
        'core-concepts/metadata',
        'core-concepts/standards',
      ],
    },
    {
      type: 'category',
      label: 'Working with CALM',
      link: {type: 'doc', id: 'working-with-calm/working-with-calm-index'},
      items: [
        'working-with-calm/installation',
        'working-with-calm/using-the-cli',
        'working-with-calm/validate',
        'working-with-calm/generate',
        'working-with-calm/copilot-chatmode',
        'working-with-calm/voice-mode',
      ],
    },
  ],

  // Learning sidebar - tutorials and how-to guides
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
          label: '🏆 Challenges',
          link: {type: 'doc', id: 'tutorials/challenges/challenges-index'},
          items: [
            'tutorials/challenges/enterprise-architect',
            'tutorials/challenges/product-developer',
            'tutorials/challenges/security-sme',
            'tutorials/challenges/mastering-calm',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'How-To Guides',
      link: {type: 'doc', id: 'how-to/how-to-index'},
      collapsed: false,
      items: [
        {
          type: 'category',
          label: '🏗️ Modeling',
          link: {type: 'doc', id: 'how-to/modeling/modeling-index'},
          items: [
            'how-to/modeling/controls',
            'how-to/modeling/flows',
            'how-to/modeling/adrs',
          ],
        },
        {
          type: 'category',
          label: '📄 Documentation',
          link: {type: 'doc', id: 'how-to/documentation/documentation-index'},
          items: [
            'how-to/documentation/docify',
            'how-to/documentation/custom-widgets',
            'how-to/documentation/handlebars',
            'how-to/documentation/ai-advisor',
          ],
        },
        {
          type: 'category',
          label: '⚙️ Operations',
          link: {type: 'doc', id: 'how-to/operations/operations-index'},
          items: [
            'how-to/operations/ops-advisor',
            'how-to/operations/ops-docs',
          ],
        },
        {
          type: 'category',
          label: '🛡️ Governance',
          link: {type: 'doc', id: 'how-to/governance/governance-index'},
          items: [
            'how-to/governance/patterns',
            'how-to/governance/standards',
            'how-to/governance/standards-from-patterns',
            'how-to/governance/multi-pattern-validation',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
