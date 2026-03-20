use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use core_foundation::runloop::{CFRunLoop, kCFRunLoopCommonModes};
use core_graphics::event::{
    CallbackResult, CGEventTap, CGEventTapLocation, CGEventTapOptions,
    CGEventTapPlacement, CGEventType, EventField,
};
use tauri::AppHandle;

use tauri::{Emitter, Manager};

use crate::{MeetingShortcutPayload, ShortcutBindings};

pub fn start(app: AppHandle, active: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        log::info!("[mouse-listener] macos thread started");

        // We only need to catch presses for side buttons.
        // NOTE: TapDisabledByTimeout/TapDisabledByUserInput have huge numeric values
        // and core-graphics panics when building the event mask for them.
        let events_of_interest = vec![CGEventType::OtherMouseDown];

        log::info!(
            "[mouse-listener] macos installing CGEventTap events_of_interest={:?}",
            events_of_interest
        );

        // Diagnostic: check whether macOS considers our process trusted for Accessibility.
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        let accessibility_trusted = unsafe { AXIsProcessTrusted() };
        log::info!(
            "[mouse-listener] macos Accessibility trusted={}",
            accessibility_trusted
        );

        let mut tap: Option<CGEventTap<'static>> = None;
        let mut used_location: Option<CGEventTapLocation> = None;

        let debug_invocations = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        for location in [
            CGEventTapLocation::HID,
            CGEventTapLocation::Session,
            CGEventTapLocation::AnnotatedSession,
        ] {
            log::info!(
                "[mouse-listener] macos trying CGEventTap location={:?}",
                location
            );

            let app_handle = app.clone();
            let debug_for_cb = debug_invocations.clone();

            let candidate = unsafe {
                CGEventTap::new_unchecked(
                    location,
                    CGEventTapPlacement::HeadInsertEventTap,
                    CGEventTapOptions::Default,
                    events_of_interest.clone(),
                    move |_proxy, event_type, event| {
                        let n = debug_for_cb.fetch_add(1, Ordering::Relaxed);

                        if !matches!(event_type, CGEventType::OtherMouseDown) {
                            return CallbackResult::Keep;
                        }

                        let button = event.get_integer_value_field(
                            EventField::MOUSE_EVENT_BUTTON_NUMBER,
                        );

                        let mouse_shortcut = match button {
                            3 | 8 => "Mouse4",
                            4 | 9 => "Mouse5",
                            _ => "",
                        };

                        if n < 20 || !mouse_shortcut.is_empty() {
                            log::info!(
                                "[mouse-listener] macos event n={}; event_type={:?}; button={}; mouse_shortcut={}",
                                n,
                                event_type,
                                button,
                                mouse_shortcut
                            );
                        }

                        if mouse_shortcut.is_empty() {
                            return CallbackResult::Keep;
                        }

                        let bindings = app_handle.state::<ShortcutBindings>();
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
                                "[mouse-listener] sidebutton={}; action={}",
                                mouse_shortcut,
                                action
                            );

                            let payload = MeetingShortcutPayload {
                                shortcut: action.to_string(),
                            };
                            let _ = app_handle.emit_to(
                                "main",
                                "meeting-shortcut",
                                payload,
                            );
                        }

                        CallbackResult::Keep
                    },
                )
            };

            match candidate {
                Ok(t) => {
                    tap = Some(t);
                    used_location = Some(location);
                    break;
                }
                Err(_) => {
                    log::warn!(
                        "[mouse-listener] macos CGEventTap install failed for location={:?}",
                        location
                    );
                }
            }
        }

        let tap = match tap {
            Some(t) => t,
            None => {
                log::warn!(
                    "[mouse-listener] macos CGEventTap install failed for all locations (HID/Session/AnnotatedSession). Grant Input Monitoring / Accessibility permissions."
                );
                return;
            }
        };

        log::info!(
            "[mouse-listener] macos CGEventTap installed (location={:?})",
            used_location
        );

        let loop_source = tap
            .mach_port()
            .create_runloop_source(0)
            .expect("Runloop source creation failed");
        CFRunLoop::get_current().add_source(
            &loop_source,
            unsafe { kCFRunLoopCommonModes },
        );

        tap.enable();
        active.store(true, Ordering::Relaxed);
        log::info!("[mouse-listener] enabled (active=true)");

        CFRunLoop::run_current();
    });
}

