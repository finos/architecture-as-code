// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';

/**
 * Opens the given CALM file in the CalmStudio desktop app via a custom URI
 * scheme. Falls back to opening the CalmStudio web app if the desktop app is
 * not installed (indicated by `vscode.env.openExternal` returning `false`).
 *
 * @param uri - The VS Code URI of the .calm.json file to open.
 */
export async function openInCalmStudio(uri: vscode.Uri): Promise<void> {
  const desktopUri = vscode.Uri.parse(
    `calmstudio://open?file=${encodeURIComponent(uri.fsPath)}`
  );

  const opened = await vscode.env.openExternal(desktopUri);

  if (!opened) {
    const webUri = vscode.Uri.parse('https://calmstudio.opsflow.io');
    await vscode.env.openExternal(webUri);
    vscode.window.showInformationMessage(
      'CalmStudio desktop app not found. Opening web version instead.'
    );
  }
}
