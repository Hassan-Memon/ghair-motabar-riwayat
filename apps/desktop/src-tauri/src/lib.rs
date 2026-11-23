//! The desktop app is the Expo web export in a native window. Everything the reader sees comes
//! from that export (search runs on SQLite wasm with FTS5 inside the page); this shell adds the
//! window, remembered size and position, and opening links in the system browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
