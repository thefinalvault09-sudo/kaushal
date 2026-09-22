import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
// Self-hosted variable fonts (bundled at build time — no external CDN, works
// fully offline). Fraunces = editorial serif display; Inter = UI sans.
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/inter/wght.css';
import './styles/global.css';
import App from './App';
import { AppProvider } from './context/AppContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);

// The offline service worker only makes sense on the hosted web/PWA build,
// where assets are fetched over a real network and benefit from a caching
// layer. Inside the packaged Android app (Capacitor), every asset is
// already bundled directly into the APK — there's no network round-trip
// to cache in the first place, and registering a service worker there is
// actively harmful: a native WebView's process (and any service worker it
// registered) survives across in-place APK updates far more aggressively
// than a browser tab does, so once one is registered it can keep serving
// its very first cached HTML/JS/CSS snapshot indefinitely, no matter how
// many times a newer APK is installed over it — a user has no ordinary way
// to observe that a stale service worker, not the current build, is what's
// actually rendering. Skipping registration entirely here avoids that
// class of bug outright rather than trying to force cache invalidation
// through it.
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    // Also proactively clean up any service worker + caches this same
    // origin may have registered from a PREVIOUS build of the app (before
    // this fix), so existing installs self-heal on their next launch
    // instead of staying stuck on stale cached content forever.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister());
    }).catch(() => undefined);
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key));
      }).catch(() => undefined);
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
  }
}
