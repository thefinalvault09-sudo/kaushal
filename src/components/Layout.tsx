import { NavLink, Outlet } from 'react-router-dom';
import { BrandDrop, CommitmentsIcon, MoonIcon, ProgressIcon, SettingsIcon, SunIcon, TodayIcon } from './icons';

import RouteTransition from './RouteTransition';
import { useApp } from '../context/AppContext';
import { todayISO } from '../utils/date';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/today', label: 'Today', Icon: TodayIcon },
  { to: '/commitments', label: 'Commitments', Icon: CommitmentsIcon },
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Layout() {
  const { timer, commitments, settings, updateSettings } = useApp();
  const today = todayISO(settings.dailyResetHour);
  const activeCount = commitments.filter((c) => c.startDate <= today && today <= c.endDate).length;
  const timerLabel = timer ? (timer.status === 'running' ? 'Flowing' : 'Paused') : 'Still water';
  const isDeep = settings.theme === 'dark';

  return (
    <div className="app-shell">
      {/* Mobile header — floats directly on the page: no card/panel/border. */}
      <header className="mobile-topbar">
        <span className="mobile-topbar-brand">
          <span className="mobile-topbar-drop" aria-hidden="true">
            <BrandDrop width={20} height={20} />
          </span>
          <span className="mobile-topbar-grit accent">Grit</span>
        </span>
        <button
          type="button"
          className="mobile-theme-toggle"
          onClick={() => void updateSettings({ theme: isDeep ? 'light' : 'dark' })}
          aria-label={isDeep ? 'Switch to Daylight theme' : 'Switch to Deep theme'}
          aria-pressed={isDeep}
        >
          {isDeep ? <MoonIcon width={19} height={19} /> : <SunIcon width={19} height={19} />}
        </button>
      </header>

      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="brand-orb" aria-hidden="true">
            <BrandDrop width={22} height={22} />
          </span>
          <span className="brand-name">
            <strong>Grit</strong>
            <span>Shape your time</span>
          </span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-drop" aria-hidden="true">
                <item.Icon width={17} height={17} />
              </span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-status">
            <span className={`sidebar-status-bead${timer ? ' live' : ''}`} aria-hidden="true" />
            <span className="label">{timerLabel}</span>
          </div>
          <div className="sidebar-flow label">
            {activeCount} current{activeCount === 1 ? '' : 's'} today
          </div>
        </div>
      </aside>

      <main className="app-main">
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
          >
            <item.Icon width={20} height={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
