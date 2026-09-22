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
import { playAlertTune } from './alertSound';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/** Android notification channel that carries our custom alert tune on
 *  Android 8+. Channel-level sound is the only way to attach a custom
 *  sound on modern Android — per-notification `sound` fields are ignored
 *  once a channel is in use. The corresponding audio resource lives at
 *  android/app/src/main/res/raw/alert_tune.mp3. Exported so both the
 *  scheduler (real reminders) and the test-reminder helper below fire on
 *  the same channel. */
export const REMINDER_CHANNEL_ID = 'grit-reminders';
export const REMINDER_SOUND_FILE = 'alert_tune.mp3';

const isNative = (): boolean => Capacitor.isNativePlatform();
const hasWebNotifications = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

/**
 * Idempotently creates the notification channel our reminders fire on.
 * Android's `createNotificationChannel` is a no-op when a channel with
 * the same id already exists — but its sound/importance/vibration are
 * LOCKED at first creation on API 26+. If we ever need to change the
 * channel's tune, we must use a new channel id here (older channel can
 * be deleted separately). The `channelInitialized` flag just skips the
 * cross-plugin IPC on repeat calls within a single app session.
 * Safe (best-effort no-op) on non-native platforms and on failure.
 */
let channelInitialized = false;
export async function ensureReminderChannel(): Promise<void> {
  if (!isNative() || channelInitialized) return;
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'GRIT Reminders',
      description: 'Scheduled reminders for your active commitments.',
      // IMPORTANCE_HIGH — pops up as a heads-up notification AND plays the
      // channel sound. Anything lower and Android silently mutes the tune.
      importance: 4,
      sound: REMINDER_SOUND_FILE,
      vibration: true,
      lights: true,
    });
    channelInitialized = true;
  } catch {
    // Channel creation is best-effort; if it fails the notifications will
    // still fire on the OS default channel (silent), which is the same
    // as pre-fix behavior — no regression.
  }
}

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

export interface FireTestOptions {
  withSound: boolean;
  withVibration: boolean;
}

/**
 * Fires a one-off reminder for the "Send test reminder" action in Settings,
 * honoring the user's Sound and Vibration preferences. Assumes the caller
 * has already confirmed permission is granted.
 *
 *  - Native: goes through the same channel real reminders use, so the
 *    test authentically demonstrates what the user will hear/see. On
 *    Android 8+ the channel's sound is fixed at creation and can't be
 *    per-notification-disabled, so `withSound=false` on native is
 *    effectively ignored (the user can turn the channel sound off in
 *    Android's per-app notification settings if they want silence there).
 *  - Web: fires a Notification and, when `withSound` is true, ALSO plays
 *    the alert tune directly — modern browsers ignore the Notification
 *    API's `silent: false` and produce no sound otherwise.
 */
export async function fireTestReminder(options: FireTestOptions): Promise<void> {
  const { withSound, withVibration } = options;
  if (isNative()) {
    await ensureReminderChannel();
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title: 'GRIT',
            body: 'This is what your daily reminder will look like.',
            // A near-immediate fire; the plugin requires a future instant.
            schedule: { at: new Date(Date.now() + 800) },
            channelId: REMINDER_CHANNEL_ID,
            sound: REMINDER_SOUND_FILE,
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
      silent: !withSound,
    });
    // See tickWebReminders() in reminderScheduler.ts: browsers ignore
    // Notification's silent flag for the AUDIBLE case, so we play the
    // tune ourselves when the user has Sound enabled.
    if (withSound) playAlertTune();
  }
  if (withVibration && supportsVibration()) {
    navigator.vibrate(200);
  }
}
