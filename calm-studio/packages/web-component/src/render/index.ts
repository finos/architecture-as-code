// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { initAllPacks } from '@calmstudio/extensions';

// Register extension packs so pack-aware node colors/icons resolve.
// Pure data registration — safe in Node (mcp-server does the same).
initAllPacks();

export { renderELKDiagram } from './elkRender.js';
export type { RenderOptions } from './elkRender.js';
