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
          label: '🛠️ Build a Calm Architecture',
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
};

export default sidebars;
