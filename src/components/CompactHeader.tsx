import { BrandDrop, MoonIcon, SunIcon } from './icons';
import { useSettings } from '../context/AppContext';
import './CompactHeader.css';

/**
 * A minimal page header used on screens that don't need a large decorative
 * title block (Settings today; available for reuse if other screens ever
 * need the same treatment) — just the GRIT wordmark at top-left and the
 * theme control at top-right, floating directly on the Aqua Lens
 * background with no card/box/border around them. This replaces Settings'
 * old heavy `.settings-header` (eyebrow + big serif title), and gives the
 * theme toggle a home now that the Appearance section (which used to hold
 * it) has been removed from Settings entirely.
 */
export default function CompactHeader() {
  const { settings, updateSettings } = useSettings();
  const isDeep = settings.theme === 'dark';

  return (
    <div className="compact-header">
      <span className="compact-header-brand">
        <span className="compact-header-drop" aria-hidden="true">
          <BrandDrop width={20} height={20} />
        </span>
        <span className="compact-header-wordmark accent">GRIT</span>
      </span>
      <button
        type="button"
        className="compact-header-theme-toggle"
        onClick={() => void updateSettings({ theme: isDeep ? 'light' : 'dark' })}
        aria-label={isDeep ? 'Switch to Daylight theme' : 'Switch to Deep theme'}
        aria-pressed={isDeep}
      >
        {isDeep ? <MoonIcon width={18} height={18} /> : <SunIcon width={18} height={18} />}
      </button>
    </div>
  );
}
