use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::AppHandle;
use tauri::{Emitter, Manager};
use windows_sys::Win32::Foundation::{LRESULT, LPARAM, WPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, MSG, WM_XBUTTONDOWN, WH_MOUSE_LL,
};
use windows_sys::Win32::Foundation::HINSTANCE;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;

use crate::{MeetingShortcutPayload, ShortcutBindings};

pub fn start(app: AppHandle, active: Arc<AtomicBool>) {
    use std::ptr::null_mut;
    use std::sync::OnceLock;

    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
    static mut HOOK_HANDLE: isize = 0;

    let _ = APP_HANDLE.set(app.clone());

    unsafe extern "system" fn hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        use windows_sys::Win32::UI::WindowsAndMessaging::CallNextHookEx;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MSLLHOOKSTRUCT,
        };

        // nCode < 0: must pass through without processing.
        if code < 0 {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        }

        // Only handle side-button down events.
        if wparam != WM_XBUTTONDOWN as usize {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        }

        let ms = &*(lparam as *const MSLLHOOKSTRUCT);
        // For WH_MOUSE_LL, MSLLHOOKSTRUCT.mouseData contains the xbutton in HIWORD.
        let xbutton = ((ms.mouseData >> 16) & 0xffff) as i32;

        let mouse_shortcut = match xbutton {
            1 => Some("Mouse4"), // XBUTTON1 = Back
            2 => Some("Mouse5"), // XBUTTON2 = Forward
            _ => None,
        };

        let Some(mouse_shortcut) = mouse_shortcut else {
            return CallNextHookEx(HOOK_HANDLE, code, wparam, lparam);
        };

        if let Some(app) = APP_HANDLE.get() {
            let bindings = app.state::<ShortcutBindings>();
            let audio = bindings.audio_mouse.lock().unwrap_or_default().clone();
            let video = bindings.video_mouse.lock().unwrap_or_default().clone();
            let leave = bindings.leave_mouse.lock().unwrap_or_default().clone();
            let sound = bindings.sound_mouse.lock().unwrap_or_default().clone();

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
                let _ =
                    app.emit_to("main", "meeting-shortcut", payload);
            }
        }

        CallNextHookEx(HOOK_HANDLE, code, wparam, lparam)
    }

    unsafe {
        let hinst: HINSTANCE = GetModuleHandleW(null_mut()) as HINSTANCE;
        let hook = SetWindowsHookExW(
            WH_MOUSE_LL,
            Some(hook_proc),
            hinst,
            0,
        );
        HOOK_HANDLE = hook;
        if HOOK_HANDLE == 0 {
            log::warn!("[mouse-listener] SetWindowsHookExW failed");
            active.store(false, Ordering::Relaxed);
            return;
        }

        active.store(true, Ordering::Relaxed);
        log::info!("[mouse-listener] windows mouse hook enabled");

        // Message loop keeps hook alive.
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, 0, 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        UnhookWindowsHookEx(HOOK_HANDLE);
    }
}

