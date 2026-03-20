use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::AppHandle;
use tauri::{Manager};

#[derive(Clone)]
pub(crate) struct MouseListenerState {
    pub(crate) active: Arc<AtomicBool>,
}

pub fn start(app: AppHandle) {
    let active = Arc::new(AtomicBool::new(false));
    app.manage(MouseListenerState { active: active.clone() });

    #[cfg(target_os = "macos")]
    macos::start(app, active);
    #[cfg(target_os = "windows")]
    windows::start(app, active);
}

#[cfg(all(target_os = "macos", target_os = "windows"))]
compile_error!("Impossible: both macos and windows target");

#[tauri::command]
pub fn is_mouse_listener_active(app: AppHandle) -> bool {
    let state = app.try_state::<MouseListenerState>();
    match state {
        Some(s) => s.active.load(Ordering::Relaxed),
        None => false,
    }
}

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

