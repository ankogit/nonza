#![cfg_attr(mobile, tauri::mobile_entry_point)]

#[cfg(desktop)]
use std::sync::Mutex;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

const SHORTCUT_AUDIO: &str = "CommandOrControl+Shift+M";
const SHORTCUT_VIDEO: &str = "CommandOrControl+Shift+V";
const SHORTCUT_SCREEN: &str = "CommandOrControl+Shift+S";
const SHORTCUT_LEAVE: &str = "CommandOrControl+Shift+H";
const SHORTCUT_SOUND: &str = "CommandOrControl+Shift+O";

#[cfg(desktop)]
struct ShortcutBindings {
    audio: Mutex<String>,
    video: Mutex<String>,
    leave: Mutex<String>,
    sound: Mutex<String>,
}

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
struct MeetingShortcutPayload {
    shortcut: String,
}

#[cfg(desktop)]
fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    register_global_shortcuts_with(
        app,
        SHORTCUT_AUDIO,
        SHORTCUT_VIDEO,
        SHORTCUT_LEAVE,
        SHORTCUT_SOUND,
    )
}

#[cfg(desktop)]
fn register_global_shortcuts_with(
    app: &tauri::AppHandle,
    audio: &str,
    video: &str,
    leave: &str,
    sound: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let handle = app.clone();

    gs.on_shortcut(audio, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: audio");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "audio".into() });
        }
    })?;
    gs.on_shortcut(video, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: video");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "video".into() });
        }
    })?;
    gs.on_shortcut(SHORTCUT_SCREEN, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: screen");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "screen".into() });
        }
    })?;
    gs.on_shortcut(leave, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: leave");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "leave".into() });
        }
    })?;
    gs.on_shortcut(sound, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: sound");
            let _ = handle.emit_to("main", "meeting-shortcut", MeetingShortcutPayload { shortcut: "sound".into() });
        }
    })?;
    log::info!(
        "[global-shortcut] новые шорткаты зарегистрированы: audio={}, video={}, leave={}, sound={}",
        audio, video, leave, sound
    );
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn reregister_global_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let bindings = app.state::<ShortcutBindings>();
    let audio = bindings.audio.lock().map_err(|e| e.to_string())?.clone();
    let video = bindings.video.lock().map_err(|e| e.to_string())?.clone();
    let leave = bindings.leave.lock().map_err(|e| e.to_string())?.clone();
    let sound = bindings.sound.lock().map_err(|e| e.to_string())?.clone();
    let audio = if is_shortcut_non_empty(&audio) {
        audio
    } else {
        SHORTCUT_AUDIO.to_string()
    };
    let video = if is_shortcut_non_empty(&video) {
        video
    } else {
        SHORTCUT_VIDEO.to_string()
    };
    let leave = if is_shortcut_non_empty(&leave) {
        leave
    } else {
        SHORTCUT_LEAVE.to_string()
    };
    let sound = if is_shortcut_non_empty(&sound) {
        sound
    } else {
        SHORTCUT_SOUND.to_string()
    };
    if let Err(e) = register_global_shortcuts_with(&app, &audio, &video, &leave, &sound) {
        log::warn!("[global-shortcut] reregister failed: {}, using defaults", e);
        let _ = register_global_shortcuts_with(
            &app,
            SHORTCUT_AUDIO,
            SHORTCUT_VIDEO,
            SHORTCUT_LEAVE,
            SHORTCUT_SOUND,
        );
        return Err(e.to_string());
    }
    Ok(())
}

#[cfg(desktop)]
fn is_shortcut_non_empty(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty() && t.contains('+')
}

#[cfg(desktop)]
#[tauri::command]
fn set_shortcut_bindings(
    app: tauri::AppHandle,
    audio: String,
    video: String,
    leave: String,
    sound: String,
) -> Result<(), String> {
    let audio = if is_shortcut_non_empty(&audio) {
        audio
    } else {
        SHORTCUT_AUDIO.to_string()
    };
    let video = if is_shortcut_non_empty(&video) {
        video
    } else {
        SHORTCUT_VIDEO.to_string()
    };
    let leave = if is_shortcut_non_empty(&leave) {
        leave
    } else {
        SHORTCUT_LEAVE.to_string()
    };
    let sound = if is_shortcut_non_empty(&sound) {
        sound
    } else {
        SHORTCUT_SOUND.to_string()
    };
    {
        let bindings = app.state::<ShortcutBindings>();
        *bindings.audio.lock().map_err(|e| e.to_string())? = audio.clone();
        *bindings.video.lock().map_err(|e| e.to_string())? = video.clone();
        *bindings.leave.lock().map_err(|e| e.to_string())? = leave.clone();
        *bindings.sound.lock().map_err(|e| e.to_string())? = sound.clone();
    }
    if let Err(e) = register_global_shortcuts_with(&app, &audio, &video, &leave, &sound) {
        log::warn!("[global-shortcut] set_shortcut_bindings failed: {}, re-registering defaults", e);
        let _ = register_global_shortcuts_with(
            &app,
            SHORTCUT_AUDIO,
            SHORTCUT_VIDEO,
            SHORTCUT_LEAVE,
            SHORTCUT_SOUND,
        );
        return Err(e.to_string());
    }
    Ok(())
}

#[cfg(desktop)]
fn build_app_submenu(
    app: &tauri::AppHandle,
    logout_visible: bool,
    audio: &str,
    video: &str,
    leave: &str,
    sound: &str,
) -> Result<tauri::menu::Submenu<tauri::Wry>, String> {
    let mut builder = SubmenuBuilder::new(app, "Nonza Meet");
    if logout_visible {
        let logout_item = MenuItemBuilder::with_id("logout", "Выйти из аккаунта")
            .build(app)
            .map_err(|e| e.to_string())?;
        builder = builder.item(&logout_item);
    }
    let mic_item = MenuItemBuilder::with_id("shortcut-mic", "Микрофон")
        .accelerator(audio)
        .build(app)
        .map_err(|e| e.to_string())?;
    let video_item = MenuItemBuilder::with_id("shortcut-video", "Видео")
        .accelerator(video)
        .build(app)
        .map_err(|e| e.to_string())?;
    let sound_item = MenuItemBuilder::with_id("shortcut-sound", "Отключить звук")
        .accelerator(sound)
        .build(app)
        .map_err(|e| e.to_string())?;
    let leave_item = MenuItemBuilder::with_id("shortcut-leave", "Завершить звонок")
        .accelerator(leave)
        .build(app)
        .map_err(|e| e.to_string())?;
    builder = builder
        .item(&mic_item)
        .item(&video_item)
        .item(&sound_item)
        .item(&leave_item);
    builder.quit().build().map_err(|e| e.to_string())
}

#[cfg(desktop)]
#[tauri::command]
fn update_app_menu(
    app: tauri::AppHandle,
    logout_visible: bool,
    audio_shortcut: String,
    video_shortcut: String,
    leave_shortcut: String,
    sound_shortcut: String,
) -> Result<(), String> {
    let account_submenu = build_app_submenu(
        &app,
        logout_visible,
        &audio_shortcut,
        &video_shortcut,
        &leave_shortcut,
        &sound_shortcut,
    )?;
    let menu = MenuBuilder::new(&app)
        .item(&account_submenu)
        .build()
        .map_err(|e| e.to_string())?;
    app.set_menu(menu).map(|_| ()).map_err(|e| e.to_string())
}

pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }
    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            reregister_global_shortcuts,
            #[cfg(desktop)]
            set_shortcut_bindings,
            #[cfg(desktop)]
            update_app_menu,
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
                app.manage(ShortcutBindings {
                    audio: Mutex::new(SHORTCUT_AUDIO.to_string()),
                    video: Mutex::new(SHORTCUT_VIDEO.to_string()),
                    leave: Mutex::new(SHORTCUT_LEAVE.to_string()),
                    sound: Mutex::new(SHORTCUT_SOUND.to_string()),
                });
            }
            #[cfg(desktop)]
            if let Err(e) = register_global_shortcuts(&app.handle()) {
                log::warn!("[global-shortcut] failed to register: {}", e);
            }
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                let account_submenu = build_app_submenu(
                    &handle,
                    false,
                    SHORTCUT_AUDIO,
                    SHORTCUT_VIDEO,
                    SHORTCUT_LEAVE,
                    SHORTCUT_SOUND,
                )
                .map_err(|e| tauri::Error::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e,
                )))?;
                let menu = MenuBuilder::new(&handle)
                    .item(&account_submenu)
                    .build()
                    .map_err(tauri::Error::from)?;
                app.set_menu(menu)?;
                app.on_menu_event(move |app_handle, event| {
                    let id = event.id().as_ref();
                    if id == "logout" {
                        let _ = app_handle.emit_to("main", "app-menu-logout", ());
                    } else if id == "shortcut-mic" {
                        let _ = app_handle.emit_to(
                            "main",
                            "meeting-shortcut",
                            MeetingShortcutPayload { shortcut: "audio".into() },
                        );
                    } else if id == "shortcut-video" {
                        let _ = app_handle.emit_to(
                            "main",
                            "meeting-shortcut",
                            MeetingShortcutPayload { shortcut: "video".into() },
                        );
                    } else if id == "shortcut-leave" {
                        let _ = app_handle.emit_to(
                            "main",
                            "meeting-shortcut",
                            MeetingShortcutPayload { shortcut: "leave".into() },
                        );
                    } else if id == "shortcut-sound" {
                        let _ = app_handle.emit_to(
                            "main",
                            "meeting-shortcut",
                            MeetingShortcutPayload { shortcut: "sound".into() },
                        );
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
