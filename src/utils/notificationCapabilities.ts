// Capability detection + permission handling for reminder settings.
//
// Two distinct platforms are supported honestly, without ever pretending a
// feature works when it can't:
//   - Native Android (Capacitor): notifications go through the OS via
//     @capacitor/local-notifications, which requests the REAL Android
//     notification permission. The plain web Notification API is unreliable
//     inside an Android WebView (Notification.requestPermission() typically
//     auto-denies because the Chromium WebView isn't wired to OS
//     notifications), which is exactly why the toggle previously could
//     never be enabled in the packaged app.
//   - Web / PWA: the standard browser Notification API is used directly.
//
// Nothing here bypasses a permission requirement — on both platforms the
// user is still asked, and a denied/blocked result is reported truthfully.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const isNative = (): boolean => Capacitor.isNativePlatform();
const hasWebNotifications = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

/** True if notifications can work at all on the current platform: the native
 *  OS path (Capacitor) or the browser Notification API. */
export function supportsNotifications(): boolean {
  return isNative() || hasWebNotifications();
}

/** Maps the Capacitor LocalNotifications permission `display` value onto the
 *  same tri-state the web Notification API uses. */
function mapNativeDisplay(display: string): NotificationPermissionState {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  // 'prompt' | 'prompt-with-rationale' -> not yet decided.
  return 'default';
}

/** Current permission state, resolved asynchronously (the native check is
 *  async). Returns 'unsupported' if neither path exists. */
export async function getNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNative()) {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      return mapNativeDisplay(display);
    } catch {
      return 'unsupported';
    }
  }
  if (hasWebNotifications()) return Notification.permission;
  return 'unsupported';
}

/** Requests permission (if not already decided) and resolves to the
 *  resulting state. Honors the real OS/browser permission prompt. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNative()) {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return mapNativeDisplay(display);
    } catch {
      return 'unsupported';
    }
  }
  if (hasWebNotifications()) {
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return 'unsupported';
}

/** True if the Vibration API is available (Android Chrome/WebView; not iOS
 *  Safari or desktop) — a real feature-detect, not a platform guess. */
export function supportsVibration(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Full-screen alert (an alarm-clock-style takeover that wakes the screen
 * even when locked) needs a dedicated native full-screen-intent
 * implementation this build doesn't ship. Reported as unsupported rather
 * than exposing a checkbox that controls nothing.
 */
export function supportsFullScreenAlert(): boolean {
  return false;
}

/** Whether firing a notification with the platform's default alert sound is
 *  possible at all (there's no cross-platform API for a *custom* sound). */
export function supportsNotificationSound(): boolean {
  return supportsNotifications();
}

/**
 * Fires a one-off reminder for the "Send test reminder" action in Settings,
 * honoring the vibration preference where supported. Native uses the OS
 * notification; web uses the Notification API. Assumes the caller has
 * already confirmed permission is granted.
 */
export async function fireTestReminder(withVibration: boolean): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title: 'GRIT',
            body: 'This is what your daily reminder will look like.',
            // A near-immediate fire; the plugin requires a future instant.
            schedule: { at: new Date(Date.now() + 800) },
          },
        ],
      });
    } catch {
      // Permission may have been revoked between check and fire — ignore.
    }
  } else if (hasWebNotifications() && Notification.permission === 'granted') {
    new Notification('GRIT', {
      body: 'This is what your daily reminder will look like.',
      tag: 'grit-reminder-test',
    });
  }
  if (withVibration && supportsVibration()) {
    navigator.vibrate(200);
  }
}
