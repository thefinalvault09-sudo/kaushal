import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/AppContext';
import { capitalizeFirstLetter, getStoredUserName, storeUserName } from '../utils/userName';
import { ArrowRightIcon } from '../components/icons';
import './Welcome.css';

const TAGLINE = 'GRIT — Build Through Action.';

/**
 * First-launch/onboarding screen.
 *
 * Exact minimal presentation, per spec:
 *   [User's name]
 *   Grit — Build Through Action.
 *
 * The name itself doubles as the capture mechanism: it IS the large,
 * heading-styled input (no separate "Welcome" copy, no step list). Typing
 * is left untouched while focused (normal input UX); the moment the field
 * loses focus or the form is submitted, the value snaps to
 * "first letter capitalized, rest lowercased" — so the displayed name is
 * always correctly cased without fighting the cursor while typing.
 */
export default function Welcome() {
  const { updateSettings } = useSettings();
  const navigate = useNavigate();
  const [name, setName] = useState(() => getStoredUserName());

  const canContinue = name.trim().length > 0;

  function handleBlur() {
    if (name) setName(capitalizeFirstLetter(name));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const finalName = capitalizeFirstLetter(name);
    if (!finalName) return;
    storeUserName(finalName);
    await updateSettings({ hasOnboarded: true });
    navigate('/today', { replace: true });
  }

  return (
    <div className="welcome-screen">
      <form className="welcome-card lens" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="welcome-name">
          Your name
        </label>
        <input
          id="welcome-name"
          className="welcome-name-input display"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          placeholder="Your name"
          autoComplete="given-name"
          maxLength={40}
          autoFocus
        />

        <p className="welcome-tagline accent">{TAGLINE}</p>

        <button
          type="submit"
          className="btn btn-primary btn-icon welcome-continue"
          disabled={!canContinue}
          aria-label="Continue"
        >
          <ArrowRightIcon width={20} height={20} />
        </button>
      </form>
    </div>
  );
}
