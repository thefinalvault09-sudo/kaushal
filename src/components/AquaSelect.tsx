import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from './icons';
import './AquaSelect.css';

export interface AquaSelectOption<T extends string> {
  value: T;
  label: string;
}

interface AquaSelectProps<T extends string> {
  value: T;
  options: AquaSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

interface PanelPos {
  left: number;
  top: number;
  width: number;
  openUp: boolean;
}

/** Rough per-option height (padding + text), used to estimate panel height
 *  for positioning before it's painted. */
const OPTION_HEIGHT = 44;
const PANEL_MAX_HEIGHT = 280;
const GAP = 10;

/**
 * A custom dropdown/listbox styled as part of the Aqua Lens system —
 * translucent glass, soft blur, aqua tint, rounded organic shape, no sharp
 * borders, and a smooth open/close animation. Replaces the browser's native
 * `<select>` popup (which can't be restyled).
 *
 * The open panel is rendered through a portal onto `document.body` with
 * fixed positioning. That's deliberate: each Aqua Lens card uses
 * `backdrop-filter`, which creates its own stacking context, so a panel
 * rendered inline inside a card is trapped there and gets painted over by
 * later sibling cards (e.g. the Reminder-frequency menu being hidden behind
 * the Daily-refresh card). A body-level portal escapes every card's
 * stacking context and always paints on top. It also flips above the
 * trigger when there isn't room below.
 */
export default function AquaSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  className,
}: AquaSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedIndex = options.findIndex((o) => o.value === value);

  function computePosition(): PanelPos | null {
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return null;
    const estHeight = Math.min(options.length * OPTION_HEIGHT + 16, PANEL_MAX_HEIGHT);
    const spaceBelow = window.innerHeight - trigger.bottom;
    const openUp = spaceBelow < estHeight + GAP + 8 && trigger.top > spaceBelow;
    return {
      left: trigger.left,
      width: trigger.width,
      top: openUp ? trigger.top - GAP : trigger.bottom + GAP,
      openUp,
    };
  }

  // Position the panel the moment it opens, before paint (no flash).
  useLayoutEffect(() => {
    if (open) setPos(computePosition());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // The panel is fixed-positioned relative to the trigger; rather than
    // track it while the page moves, just close on scroll/resize.
    function handleReflow() {
      setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
    };
  }, [open]);

  function selectAt(index: number) {
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    onChange(options[clamped].value);
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) selectAt(selectedIndex - 1);
    }
  }

  return (
    <div className={`aqua-select ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        className={`aqua-select-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="aqua-select-value">{selected?.label}</span>
        <span className="aqua-select-chevron" aria-hidden="true">
          <ChevronDownIcon width={14} height={14} />
        </span>
      </button>

      {open && pos &&
        createPortal(
          <ul
            ref={panelRef}
            className={`aqua-select-panel${pos.openUp ? ' up' : ''}`}
            role="listbox"
            id={listboxId}
            aria-label={ariaLabel}
            tabIndex={-1}
            style={{
              left: pos.left,
              width: pos.width,
              ...(pos.openUp ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {options.map((opt) => (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`aqua-select-option${opt.value === value ? ' selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
