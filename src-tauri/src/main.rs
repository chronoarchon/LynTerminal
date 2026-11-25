// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
fn configure_windows_webview2_fallback() {
    use std::path::{Path, PathBuf};

    let is_valid_webview2_dir = |dir: &Path| -> bool {
        dir.join("msedgewebview2.exe").is_file()
            && dir.join("EBWebView").join("x64").join("EmbeddedBrowserWebView.dll").is_file()
    };

    if let Some(existing) = std::env::var_os("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER") {
        if is_valid_webview2_dir(Path::new(&existing)) {
            return;
        }
        // Existing env var points to a stale/removed EdgeWebView version; clear it so discovery/fallback succeeds.
        unsafe {
            std::env::remove_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER");
        }
    }

    let find_latest_version_in = |base: &Path| -> Option<PathBuf> {
        let entries = std::fs::read_dir(base).ok()?;
        let mut candidates: Vec<(Vec<u32>, PathBuf)> = Vec::new();
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            let parts: Vec<u32> = name_str
                .split('.')
                .filter_map(|s| s.parse::<u32>().ok())
                .collect();
            if parts.len() >= 3 && is_valid_webview2_dir(&path) {
                candidates.push((parts, path));
            }
        }
        candidates.sort_by(|a, b| b.0.cmp(&a.0));
        candidates.into_iter().next().map(|(_, p)| p)
    };

    // If system-wide Evergreen WebView2 exists in Program Files, let standard loader handle it cleanly
    for pf_var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(pf) = std::env::var(pf_var) {
            let sys_base = PathBuf::from(pf).join("Microsoft").join("EdgeWebView").join("Application");
            if find_latest_version_in(&sys_base).is_some() {
                return;
            }
        }
    }

    // Fallback: EdgeUpdate per-user registry sometimes breaks across updates while the binary remains in LocalAppData
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let user_base = PathBuf::from(local_app_data)
            .join("Microsoft")
            .join("EdgeWebView")
            .join("Application");
        if let Some(valid_dir) = find_latest_version_in(&user_base) {
            unsafe {
                std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", valid_dir);
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    configure_windows_webview2_fallback();

    #[cfg(target_os = "linux")]
    {
        // Fix for Linux (Arch Linux, Ubuntu, Fedora, Debian) on Wayland and X11:
        // WebKitGTK 2.42+/2.54+ DMA-BUF renderer causes severe UI freezes, stuttering, and protocol hangs.
        // Disabling both the DMA-BUF renderer AND compositing mode forces smooth, rock-solid
        // software compositing (Cairo/pixman), eliminating all GPU driver deadlocks and Wayland freezes.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            }
        }
        if std::env::var_os("WEBKIT_DMABUF_RENDERER_FORCE_SHM").is_none() {
            unsafe {
                std::env::set_var("WEBKIT_DMABUF_RENDERER_FORCE_SHM", "1");
            }
        }
    }

    lynterminal_lib::run()
}
