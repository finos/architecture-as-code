// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

declare module '@calmstudio/diagram/render' {
  export interface RenderOptions {
    theme?: 'light' | 'dark';
    direction?: 'DOWN' | 'RIGHT';
    flow?: string;
  }
  export function renderELKDiagram(arch: unknown, options?: RenderOptions): Promise<string>;
}

declare module '@calmstudio/diagram' {
  export interface CalmDiagramProps {
    src?: string;
    data?: string;
    theme?: 'light' | 'dark';
    flow?: string;
  }
}
