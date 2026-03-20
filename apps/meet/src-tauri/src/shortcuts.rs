#![cfg(desktop)]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use std::sync::Mutex;

pub const SHORTCUT_AUDIO: &str = "CommandOrControl+Shift+M";
pub const SHORTCUT_VIDEO: &str = "CommandOrControl+Shift+V";
pub const SHORTCUT_SCREEN: &str = "CommandOrControl+Shift+S";
pub const SHORTCUT_LEAVE: &str = "CommandOrControl+Shift+H";
pub const SHORTCUT_SOUND: &str = "CommandOrControl+Shift+O";

pub struct ShortcutBindings {
    // Keyboard bindings (global-shortcut + menu accelerators).
    pub audio_keyboard: Mutex<String>,
    pub video_keyboard: Mutex<String>,
    pub leave_keyboard: Mutex<String>,
    pub sound_keyboard: Mutex<String>,

    // Mouse bindings (used by OS-level hooks).
    pub audio_mouse: Mutex<String>,
    pub video_mouse: Mutex<String>,
    pub leave_mouse: Mutex<String>,
    pub sound_mouse: Mutex<String>,
}

#[derive(Clone, serde::Serialize)]
pub struct MeetingShortcutPayload {
    pub shortcut: String,
}

fn is_shortcut_non_empty(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty() && t.contains('+')
}

fn normalize_keyboard_binding(s: &str, default: &str) -> String {
    let t = s.trim();
    // global-shortcut expects keyboard-style accelerator strings like "CommandOrControl+Shift+M".
    // Mouse values like "Mouse4" must be treated as invalid here.
    if !t.is_empty() && t.contains('+') {
        t.to_string()
    } else {
        default.to_string()
    }
}

fn normalize_mouse_binding(s: &str) -> String {
    let t = s.trim();
    if t.to_ascii_lowercase().starts_with("mouse") {
        // Keep original format written by frontend: "Mouse4"/"Mouse5"
        t.to_string()
    } else {
        "".to_string()
    }
}

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
            let _ = handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "audio".into(),
                },
            );
        }
    })?;

    gs.on_shortcut(video, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: video");
            let _ = handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "video".into(),
                },
            );
        }
    })?;

    gs.on_shortcut(SHORTCUT_SCREEN, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: screen");
            let _ = handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "screen".into(),
                },
            );
        }
    })?;

    gs.on_shortcut(leave, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: leave");
            let _ = handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "leave".into(),
                },
            );
        }
    })?;

    gs.on_shortcut(sound, {
        let handle = handle.clone();
        move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            log::info!("[global-shortcut] сработал: sound");
            let _ = handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "sound".into(),
                },
            );
        }
    })?;

    log::info!(
        "[global-shortcut] новые шорткаты зарегистрированы: audio={}, video={}, leave={}, sound={}",
        audio,
        video,
        leave,
        sound
    );
    Ok(())
}

fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    register_global_shortcuts_with(
        app,
        SHORTCUT_AUDIO,
        SHORTCUT_VIDEO,
        SHORTCUT_LEAVE,
        SHORTCUT_SOUND,
    )
}

pub fn manage_state_defaults(app: &tauri::AppHandle) {
    app.manage(ShortcutBindings {
        audio_keyboard: Mutex::new(SHORTCUT_AUDIO.to_string()),
        video_keyboard: Mutex::new(SHORTCUT_VIDEO.to_string()),
        leave_keyboard: Mutex::new(SHORTCUT_LEAVE.to_string()),
        sound_keyboard: Mutex::new(SHORTCUT_SOUND.to_string()),

        audio_mouse: Mutex::new("".to_string()),
        video_mouse: Mutex::new("".to_string()),
        leave_mouse: Mutex::new("".to_string()),
        sound_mouse: Mutex::new("".to_string()),
    });
}

#[tauri::command]
pub fn reregister_global_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let bindings = app.state::<ShortcutBindings>();

    let mut audio = bindings
        .audio_keyboard
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mut video = bindings
        .video_keyboard
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mut leave = bindings
        .leave_keyboard
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mut sound = bindings
        .sound_keyboard
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    if !is_shortcut_non_empty(&audio) {
        audio = SHORTCUT_AUDIO.to_string();
    }
    if !is_shortcut_non_empty(&video) {
        video = SHORTCUT_VIDEO.to_string();
    }
    if !is_shortcut_non_empty(&leave) {
        leave = SHORTCUT_LEAVE.to_string();
    }
    if !is_shortcut_non_empty(&sound) {
        sound = SHORTCUT_SOUND.to_string();
    }

    if let Err(e) = register_global_shortcuts_with(&app, &audio, &video, &leave, &sound) {
        log::warn!(
            "[global-shortcut] reregister failed: {}, using defaults",
            e
        );
        let _ = register_global_shortcuts_with(&app, SHORTCUT_AUDIO, SHORTCUT_VIDEO, SHORTCUT_LEAVE, SHORTCUT_SOUND);
        return Err(e.to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn set_shortcut_bindings(
    app: tauri::AppHandle,
    audio: String,
    video: String,
    leave: String,
    sound: String,
) -> Result<(), String> {
    // Front sends either keyboard strings (with '+') or mouse strings ("Mouse4"/"Mouse5").
    // We store them in separate fields.
    let audio_keyboard = normalize_keyboard_binding(&audio, SHORTCUT_AUDIO);
    let video_keyboard = normalize_keyboard_binding(&video, SHORTCUT_VIDEO);
    let leave_keyboard = normalize_keyboard_binding(&leave, SHORTCUT_LEAVE);
    let sound_keyboard = normalize_keyboard_binding(&sound, SHORTCUT_SOUND);

    let audio_mouse = normalize_mouse_binding(&audio);
    let video_mouse = normalize_mouse_binding(&video);
    let leave_mouse = normalize_mouse_binding(&leave);
    let sound_mouse = normalize_mouse_binding(&sound);

    {
        let bindings = app.state::<ShortcutBindings>();
        *bindings
            .audio_keyboard
            .lock()
            .map_err(|e| e.to_string())? = audio_keyboard.clone();
        *bindings
            .video_keyboard
            .lock()
            .map_err(|e| e.to_string())? = video_keyboard.clone();
        *bindings
            .leave_keyboard
            .lock()
            .map_err(|e| e.to_string())? = leave_keyboard.clone();
        *bindings
            .sound_keyboard
            .lock()
            .map_err(|e| e.to_string())? = sound_keyboard.clone();

        *bindings
            .audio_mouse
            .lock()
            .map_err(|e| e.to_string())? = audio_mouse.clone();
        *bindings
            .video_mouse
            .lock()
            .map_err(|e| e.to_string())? = video_mouse.clone();
        *bindings
            .leave_mouse
            .lock()
            .map_err(|e| e.to_string())? = leave_mouse.clone();
        *bindings
            .sound_mouse
            .lock()
            .map_err(|e| e.to_string())? = sound_mouse.clone();
    }

    if let Err(e) = register_global_shortcuts_with(
        &app,
        &audio_keyboard,
        &video_keyboard,
        &leave_keyboard,
        &sound_keyboard,
    ) {
        log::warn!(
            "[global-shortcut] set_shortcut_bindings failed: {}, re-registering defaults",
            e
        );
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

#[tauri::command]
pub fn trigger_meeting_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    log::info!("[mouse-shortcut] invoke trigger_meeting_shortcut shortcut={}", shortcut);
    let payload = MeetingShortcutPayload { shortcut };
    app.emit_to("main", "meeting-shortcut", payload)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

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

#[tauri::command]
pub fn update_app_menu(
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

pub fn init_menu_and_shortcuts(app: &tauri::AppHandle) -> Result<(), tauri::Error> {
    if let Err(e) = register_global_shortcuts(app) {
        log::warn!("[global-shortcut] failed to register: {}", e);
    }

    let handle = app.clone();
    let account_submenu = build_app_submenu(
        &handle,
        false,
        SHORTCUT_AUDIO,
        SHORTCUT_VIDEO,
        SHORTCUT_LEAVE,
        SHORTCUT_SOUND,
    )
    .map_err(|e| {
        tauri::Error::from(std::io::Error::new(
            std::io::ErrorKind::Other,
            e,
        ))
    })?;

    let menu = MenuBuilder::new(&handle)
        .item(&account_submenu)
        .build()
        .map_err(tauri::Error::from)?;

    app.set_menu(menu)?;

    // One menu event handler for fixed item ids.
    handle.on_menu_event(move |app_handle, event| {
        let id = event.id().as_ref();
        if id == "logout" {
            let _ = app_handle.emit_to("main", "app-menu-logout", ());
        } else if id == "shortcut-mic" {
            let _ = app_handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "audio".into(),
                },
            );
        } else if id == "shortcut-video" {
            let _ = app_handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "video".into(),
                },
            );
        } else if id == "shortcut-leave" {
            let _ = app_handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "leave".into(),
                },
            );
        } else if id == "shortcut-sound" {
            let _ = app_handle.emit_to(
                "main",
                "meeting-shortcut",
                MeetingShortcutPayload {
                    shortcut: "sound".into(),
                },
            );
        }
    });

    Ok(())
}

