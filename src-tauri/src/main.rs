// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Allow user to fallback to software rendering if their GPU driver specifically requires it
        if std::env::var_os("LYNTERMINAL_SOFTWARE_RENDER").is_some() || std::env::var_os("LYNDESK_SOFTWARE_RENDER").is_some() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
    }

    lynterminal_lib::run()
}
