// Typed data-access functions for app Settings.

import { STORES, getById, put } from './db';
import type { ReminderFrequency, Settings } from '../types';

const SETTINGS_KEY = 'app';

export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_KEY,
  // Deep is the default theme for a new installation / first launch.
  theme: 'dark',
  notificationsEnabled: false,
  hasOnboarded: false,
  reminderSound: true,
  reminderVibration: true,
  reminderFrequency: 'EVERY_1H',
  dailyResetHour: 0,
};

const VALID_REMINDER_FREQUENCIES: ReminderFrequency[] = [
  'EVERY_1H',
  'EVERY_2H',
  'EVERY_3H',
  'EVERY_4H',
  'EVERY_5H',
];

/**
 * Back-fills any reminder/reset fields missing from a previously-saved
 * Settings record (pre-existing users upgrading from an older version that
 * didn't have them yet) with their defaults, without touching fields the
 * user already set (theme, notificationsEnabled, hasOnboarded stay exactly
 * as persisted). Centralizing this here means every read path — including
 * import — gets the same backward-compatible shape.
 */
export function withSettingsDefaults(settings: Settings): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
  // Migrate a reminderFrequency saved under the old scheme (e.g.
  // 'ONCE_DAILY'/'TWICE_DAILY'/'HOURLY') — or any unrecognized value — to
  // the current hourly-interval default, so the stored choice always maps
  // to a real option in the picker.
  if (!VALID_REMINDER_FREQUENCIES.includes(merged.reminderFrequency)) {
    merged.reminderFrequency = DEFAULT_SETTINGS.reminderFrequency;
  }
  return merged;
}

export async function getSettings(): Promise<Settings> {
  const existing = await getById<Settings>(STORES.settings, SETTINGS_KEY);
  return existing ? withSettingsDefaults(existing) : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await put(STORES.settings, settings);
}
