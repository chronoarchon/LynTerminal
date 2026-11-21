// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
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
