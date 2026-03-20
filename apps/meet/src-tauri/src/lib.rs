#![cfg_attr(mobile, tauri::mobile_entry_point)]

#[cfg(desktop)]
mod mouse_listener;
#[cfg(desktop)]
mod shortcuts;

#[cfg(desktop)]
pub use shortcuts::{MeetingShortcutPayload, ShortcutBindings};

pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            shortcuts::reregister_global_shortcuts,
            #[cfg(desktop)]
            shortcuts::set_shortcut_bindings,
            #[cfg(desktop)]
            shortcuts::trigger_meeting_shortcut,
            #[cfg(desktop)]
            shortcuts::update_app_menu,
            #[cfg(all(desktop, any(target_os = "macos", target_os = "windows")))]
            mouse_listener::is_mouse_listener_active,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                shortcuts::manage_state_defaults(&app.handle());

                #[cfg(all(desktop, any(target_os = "macos", target_os = "windows")))]
                {
                    mouse_listener::start(app.handle().clone());
                }

                shortcuts::init_menu_and_shortcuts(&app.handle())?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
