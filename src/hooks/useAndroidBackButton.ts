import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Top-level routes where the hardware back button should exit the app
// instead of navigating further back (there's nowhere useful to go).
const ROOT_PATHS = new Set(['/', '/today']);

/**
 * Wires the Android hardware back button to in-app navigation.
 * - On a root screen: exits the app.
 * - Otherwise: goes back one entry in the router history.
 * No-op outside the native Android shell (web/PWA keeps default browser back).
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (ROOT_PATHS.has(location.pathname)) {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate, location.pathname]);
}
