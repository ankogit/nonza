#![cfg_attr(mobile, tauri::mobile_entry_point)]

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
#[cfg(desktop)]
use tauri::Emitter;

const SHORTCUT_AUDIO: &str = "CommandOrControl+Shift+M";
const SHORTCUT_VIDEO: &str = "CommandOrControl+Shift+V";
const SHORTCUT_SCREEN: &str = "CommandOrControl+Shift+S";
const SHORTCUT_LEAVE: &str = "CommandOrControl+Shift+H";

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
struct MeetingShortcutPayload {
    shortcut: String,
}

#[cfg(desktop)]
fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    register_global_shortcuts_impl(app)
}

#[cfg(desktop)]
fn register_global_shortcuts_impl(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.clone();
    let gs = app.global_shortcut();

    gs.on_shortcut(SHORTCUT_AUDIO, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] pressed: audio");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "audio".into() });
        }
    })?;
    gs.on_shortcut(SHORTCUT_VIDEO, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] pressed: video");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "video".into() });
        }
    })?;
    gs.on_shortcut(SHORTCUT_SCREEN, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] pressed: screen");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "screen".into() });
        }
    })?;
    gs.on_shortcut(SHORTCUT_LEAVE, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] pressed: leave");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "leave".into() });
        }
    })?;
    log::info!("[global-shortcut] registered 4 shortcuts in Rust (M/V/S/H)");
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn reregister_global_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    register_global_shortcuts(&app).map_err(|e| e.to_string())
}

pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }
    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            reregister_global_shortcuts,
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
            if let Err(e) = register_global_shortcuts(&app.handle()) {
                log::warn!("[global-shortcut] failed to register: {}", e);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
