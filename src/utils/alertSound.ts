// One shared in-app alert tune, played in two moments where the app wants
// to grab the user's ear:
//
//   1. A duration-tracked timer session hits its daily target and
//      transitions to DONE — both the auto-complete path (ticking clock
//      detects target reached) and the manual-stop path (user hits Stop
//      with elapsed >= target) route through here from AppContext.
//      COMPLETION-tracked habits (no timer) never call this.
//
//   2. A scheduled reminder fires ON WEB. On native the OS notification
//      channel plays this same audio file directly (see
//      android/app/src/main/res/raw/alert_tune.mp3), so we don't double-
//      play it from JS; on web there's no reliable way to attach custom
//      sound to a Notification, so we play the file ourselves here right
//      after the notification is dispatched.
//
// The completion path always plays this — no setting. The reminder path
// gates on the existing "Sound" toggle in Settings, since that toggle's
// whole reason for existing is to control reminder sound.

const TUNE_URL = '/alert-tune.mp3';

// Module-level cache: one HTMLAudioElement, reused across every play.
// Constructing an Audio() per fire would re-download the file each time
// (browsers don't reliably reuse blob decoding across separate elements)
// and delay the sound by the network fetch on every completion.
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  // Guard for non-browser contexts: vitest + jsdom does define Audio, but
  // an SSR/Node run without a DOM shim wouldn't — return null and let the
  // caller silently no-op.
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(TUNE_URL);
    audio.preload = 'auto';
  }
  return audio;
}

/**
 * Fires the alert tune. Best-effort by design:
 *  - Silently no-ops when there's no DOM Audio (SSR / bare Node tests).
 *  - Silently swallows autoplay-policy rejections. Modern browsers block
 *    Audio.play() unless it happens within a user-gesture window; in
 *    practice this still fires because the user pressed Start recently
 *    (which counts as a gesture in the same tab). If a session started
 *    hours ago and completes unattended on a background tab, some
 *    browsers may refuse — that's acceptable behavior for an SFX.
 *  - Rewinds to 0 before playing so back-to-back plays replay from the
 *    start instead of picking up where the previous one left off.
 */
export function playAlertTune(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
  } catch {
    // Some browsers throw if the source hasn't loaded yet — safe to ignore.
  }
  a.play().catch(() => {
    // Autoplay blocked, hardware unavailable, or file not yet loaded —
    // silently ignore. This is a nice-to-have SFX, never a correctness
    // requirement.
  });
}
