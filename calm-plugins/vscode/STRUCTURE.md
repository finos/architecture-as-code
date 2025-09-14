calm-plugins/vscode/
├── .DS_Store
├── .vscodeignore
├── LICENSE
├── README.md
├── STRUCTURE.md
├── __mocks__/
├── eslint.config.mjs
├── extension/
│   └── dist/
│       ├── extension.js
│       └── extension.js.map
├── media/
│   ├── icon.png
│   ├── icon.svg
│   ├── preview.css
│   └── preview.html
├── package.json
├── scripts/
│   └── copy-widgets.js
├── src/

│   ├── commands/
│   │   ├── clear-tree-view-search-command.ts
│   │   ├── command-registrar.ts
│   │   ├── open-preview-command.ts
│   │   ├── search-tree-view-command.ts
│   │   └── types.ts
│   ├── core/
│   │   ├── .DS_Store
│   │   ├── calm-extension-controller.ts
│   │   ├── ports/
│   │   │   └── logger.ts
│   │   └── services/
│   │       ├── refresh-service.ts
│   │       ├── config-service.ts
│   │       ├── diagnostics-service.ts
│   │       ├── logging-service.ts
│   │       ├── selection-service.ts
│   │       ├── tree-adapter.ts
│   │       └── watch-service.ts
│   ├── extension.ts
│   ├── preview/
│   │   ├── .DS_Store
│   │   ├── commands.ts
│   │   ├── docify-service.ts
│   │   ├── html-builder.ts
│   │   ├── message-router.ts
│   │   ├── messages.ts
│   │   ├── model-service.ts
│   │   ├── state-store.ts
│   │   ├── template-service.ts
│   │   ├── types.ts
│   │   └── utils/
│   │       ├── async-guard.ts
│   │       └── debounce.ts
│   ├── preview-panel.ts
│   ├── tree-view.ts
│   ├── ui/
│   │   ├── editor-gateway.ts
│   │   ├── language-features-registrar.ts
│   │   ├── preview-manager.ts
│   │   └── tree-view-manager.ts
│   ├── util/
│   │   ├── file-types.ts
│   │   ├── front-matter.ts
│   │   ├── language.ts
│   │   ├── model.ts
│   │   └── web-view.ts
│   └── webview/
│       ├── main.ts
│       ├── mermaid-renderer.ts
│       └── tsconfig.json
├── templates/
│   ├── default-template.hbs
│   ├── flow-focus-template.hbs
│   ├── node-focus-template.hbs
│   └── relationship-focus-template.hbs
├── tsconfig.json
└── tsup.config.ts
