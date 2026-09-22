import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import CompactHeader from '../components/CompactHeader';
import AquaSelect from '../components/AquaSelect';
import { BellIcon, VibrationIcon, ClockIcon } from '../components/icons';
import type { ReminderFrequency } from '../types';
import {
  fireTestReminder,
  getNotificationPermission,
  requestNotificationPermission,
  supportsNotifications,
  supportsVibration,
  type NotificationPermissionState,
} from '../utils/notificationCapabilities';
import './Settings.css';

const FREQUENCY_OPTIONS: { value: ReminderFrequency; label: string }[] = [
  { value: 'EVERY_1H', label: 'Every 1 hour' },
  { value: 'EVERY_2H', label: 'Every 2 hours' },
  { value: 'EVERY_3H', label: 'Every 3 hours' },
  { value: 'EVERY_4H', label: 'Every 4 hours' },
  { value: 'EVERY_5H', label: 'Every 5 hours' },
];

/** 0-23 -> "12:00 AM", "1:00 AM", ... "11:00 PM", for the daily-refresh-hour select. */
function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const notificationsSupported = supportsNotifications();
  const vibrationSupported = supportsVibration();
  // Permission is resolved asynchronously (the native check is async), so it
  // starts unknown and is filled in by the effect below.
  const [permission, setPermission] = useState<NotificationPermissionState>(
    notificationsSupported ? 'default' : 'unsupported',
  );
  const [testSentAt, setTestSentAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getNotificationPermission().then((p) => {
      if (!cancelled) setPermission(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleNotificationsToggle(checked: boolean) {
    if (checked && notificationsSupported && permission !== 'granted') {
      // Ask the OS/browser for permission every time the user tries to turn
      // reminders on while not yet granted. Respect the real answer — never
      // flip the setting on unless permission is actually granted.
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') return;
    }
    await updateSettings({ notificationsEnabled: checked });
  }

  function handleSendTest() {
    void fireTestReminder(settings.reminderVibration && vibrationSupported);
    setTestSentAt(Date.now());
  }

  const notificationsBlocked = notificationsSupported && permission === 'denied';
  const remindersOn = settings.notificationsEnabled;

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: formatHourLabel(hour) })),
    [],
  );

  return (
    <div className="settings-screen">
      <CompactHeader />

      <section className="lens settings-section" style={{ ['--i' as string]: 0 }}>
        <div className="lens-head">
          <h2 className="label">Reminders</h2>
        </div>

        <div className="settings-row">
          <span className="settings-row-label">
            <BellIcon width={16} height={16} />
            Daily reminder notifications
          </span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={remindersOn}
              disabled={!notificationsSupported}
              onChange={(e) => void handleNotificationsToggle(e.target.checked)}
            />
            <span className="settings-switch-track" aria-hidden="true" />
          </label>
        </div>
        {!notificationsSupported && (
          <p className="settings-capability-note">
            Notifications aren't supported in this browser/build, so this control is disabled.
          </p>
        )}
        {notificationsBlocked && (
          <p className="settings-capability-note settings-capability-note-warning">
            Notifications are blocked at the browser/system level. Allow them for GRIT in your
            device settings to enable reminders.
          </p>
        )}

        <div className="settings-row">
          <span className="settings-row-label">Sound</span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={settings.reminderSound}
              disabled={!remindersOn || !notificationsSupported}
              onChange={(e) => void updateSettings({ reminderSound: e.target.checked })}
            />
            <span className="settings-switch-track" aria-hidden="true" />
          </label>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">
            <VibrationIcon width={16} height={16} />
            Vibration
          </span>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={settings.reminderVibration}
              disabled={!remindersOn || !vibrationSupported}
              onChange={(e) => void updateSettings({ reminderVibration: e.target.checked })}
            />
            <span className="settings-switch-track" aria-hidden="true" />
          </label>
        </div>
        {!vibrationSupported && (
          <p className="settings-capability-note">
            Vibration isn't supported on this device, so this control is disabled.
          </p>
        )}

        <div className="settings-row">
          <span className="settings-row-label">
            <ClockIcon width={16} height={16} />
            Reminder frequency
          </span>
          <AquaSelect
            value={settings.reminderFrequency}
            options={FREQUENCY_OPTIONS}
            disabled={!remindersOn}
            onChange={(value) => void updateSettings({ reminderFrequency: value })}
            ariaLabel="Reminder frequency"
          />
        </div>

        <div className="settings-row">
          <span className="settings-row-label">Send a test reminder</span>
          <button
            type="button"
            className="btn btn-ghost settings-test-btn"
            disabled={!remindersOn || !notificationsSupported || permission !== 'granted'}
            onClick={handleSendTest}
          >
            Send test
          </button>
        </div>
        {testSentAt !== null && <p className="settings-capability-note">Test reminder sent.</p>}
      </section>

      <section className="lens settings-section" style={{ ['--i' as string]: 1 }}>
        <div className="lens-head">
          <h2 className="label">Daily refresh</h2>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Roll over to the next day at</span>
          <AquaSelect
            value={String(settings.dailyResetHour)}
            options={hourOptions}
            onChange={(value) => void updateSettings({ dailyResetHour: Number(value) })}
            ariaLabel="Daily refresh time"
          />
        </div>
        <p className="settings-capability-note">
          The app rolls over to the next day at this time instead of midnight. Existing records
          are never changed.
        </p>
      </section>
    </div>
  );
}
