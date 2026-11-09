<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# CalmStudio

The CALM Studio app is retired. To edit CALM architectures visually, use the canvas in the
[CALM VS Code extension](../calm-plugins/vscode).

The packages that remain here are not published. They are removed in
[#3527](https://github.com/finos/architecture-as-code/issues/3527), after the docs diagram embed
moves out in [#3526](https://github.com/finos/architecture-as-code/issues/3526).

| Package | Used by |
|---|---|
| `packages/calm-core` (`@calmstudio/calm-core`) | The docs diagram embed, the MCP server |
| `packages/extensions` (`@calmstudio/extensions`) | The docs diagram embed |
| `packages/web-component` (`@calmstudio/diagram`) | The docs diagram embed (`./render`) |
| `packages/docusaurus-plugin` (`@finos/calm-docusaurus-plugin`) | The docs site |
| `packages/mcp-server` (`@calmstudio/mcp`) | Not used in this repository |
| `packages/github-action` (`@calmstudio/github-action`) | Not used in this repository |
| `packages/vscode-extension` (`calmstudio`) | Not used in this repository |
