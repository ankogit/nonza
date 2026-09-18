use std::ptr::null_mut;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, OnceLock,
};

use tauri::AppHandle;
use tauri::{Emitter, Manager};
use windows_sys::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, MSG, MSLLHOOKSTRUCT,
    WH_MOUSE_LL, WM_XBUTTONDOWN,
};

use crate::{MeetingShortcutPayload, ShortcutBindings};

pub fn start(app: AppHandle, active: Arc<AtomicBool>) {
    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
    static mut HOOK_HANDLE: HHOOK = null_mut();

    let _ = APP_HANDLE.set(app.clone());

    unsafe extern "system" fn hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code < 0 {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        }

        if wparam != WM_XBUTTONDOWN as WPARAM {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        }

        let ms = &*(lparam as *const MSLLHOOKSTRUCT);
        let xbutton = ((ms.mouseData >> 16) & 0xffff) as i32;

        let mouse_shortcut = match xbutton {
            1 => Some("Mouse4"),
            2 => Some("Mouse5"),
            _ => None,
        };

        let Some(mouse_shortcut) = mouse_shortcut else {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        };

        if let Some(app) = APP_HANDLE.get() {
            let bindings = app.state::<ShortcutBindings>();
            let audio = bindings
                .audio_mouse
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default();
            let video = bindings
                .video_mouse
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default();
            let leave = bindings
                .leave_mouse
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default();
            let sound = bindings
                .sound_mouse
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default();

            let action = if audio == mouse_shortcut {
                Some("audio")
            } else if video == mouse_shortcut {
                Some("video")
            } else if sound == mouse_shortcut {
                Some("sound")
            } else if leave == mouse_shortcut {
                Some("leave")
            } else {
                None
            };

            if let Some(action) = action {
                log::info!(
                    "[mouse-listener] windows xbutton={}; action={}",
                    xbutton,
                    action
                );
                let payload = MeetingShortcutPayload {
                    shortcut: action.to_string(),
                };
                let _ = app.emit_to("main", "meeting-shortcut", payload);
            }
        }

        CallNextHookEx(HOOK_HANDLE, code, wparam, lparam)
    }

    unsafe {
        let hinst: HINSTANCE = GetModuleHandleW(null_mut());
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(hook_proc), hinst, 0);
        HOOK_HANDLE = hook;
        if HOOK_HANDLE.is_null() {
            log::warn!("[mouse-listener] SetWindowsHookExW failed");
            active.store(false, Ordering::Relaxed);
            return;
        }

        active.store(true, Ordering::Relaxed);
        log::info!("[mouse-listener] windows mouse hook enabled");

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        UnhookWindowsHookEx(HOOK_HANDLE);
    }
}
