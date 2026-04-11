// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { initAllPacks } from '@calmstudio/extensions';

// Initialize all extension packs before any rendering occurs
initAllPacks();

// Side-effect import to register the custom element
import './CalmDiagram.svelte';

export type { CalmDiagramProps } from './types.js';
