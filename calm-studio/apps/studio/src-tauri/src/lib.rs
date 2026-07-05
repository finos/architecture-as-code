// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // argv[1] is the file path when opened via file association (Windows/Linux)
            if let Some(path) = argv.get(1) {
                let _ = app.emit("open-file", path);
            }
            // Focus existing window
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .run(tauri::generate_context!())
        .expect("error while running CalmStudio");
}
