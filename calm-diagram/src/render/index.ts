// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { initAllPacks } from '../packs/index.js';

// Register extension packs so pack-aware node colors/icons resolve.
// Pure data registration, so it is safe at build time in Node.
initAllPacks();

export { renderELKDiagram } from './elkRender.js';
export type { RenderOptions } from './elkRender.js';
