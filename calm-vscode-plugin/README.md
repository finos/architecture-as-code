# CALM VS Code Plugin

Live-visualize CALM architecture models, validate, and generate docs.

Features

- CALM Preview webview with interactive Cytoscape graph (fcose layout)
- Sidebar tree: Nodes, Relationships, Flows
- Commands: Open Preview, Validate Model, Generate Docs, Reveal In Tree
- Hovers and CodeLens for quick navigation
- Auto-refresh on save and watched file changes

Getting started

- Open a CALM JSON/YAML file under `calm/` and run “CALM: Open Preview”.
- Configure `calm.cli.path` if you want to use the local CLI for validation/docify.

Development

- npm run watch
- Press F5 to start “Run Extension”.
