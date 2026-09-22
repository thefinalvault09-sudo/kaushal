// Small, dependency-free line icons drawn as inline SVG. We intentionally
// avoid pictographic Unicode glyphs (△ ◇ ⚙ etc.) for navigation and
// wordmark accents — font glyph coverage for those varies across browsers
// and platforms and can silently render as empty boxes. Plain stroked SVG
// paths render identically everywhere and fit the "technical line-art"
// blueprint aesthetic better than emoji-style symbols.

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function BrandDrop(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17c-2.5-2.2-3-5.7-.8-8.2C8.1 6.6 11.8 4 12 4c.3 0 4 2.7 5.8 4.9 2.1 2.6 1.5 6.1-.9 8.2A7.6 7.6 0 0 1 7 17Z" />
      <path d="M8.3 13.6c.9 1.8 2.4 2.7 4.6 2.6" opacity="0.7" />
    </svg>
  );
}

export function TodayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="15" rx="0" />
      <path d="M4 10 H20 M8 3 V6 M16 3 V6" />
    </svg>
  );
}

export function CommitmentsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="16" />
      <path d="M3.5 9 H20.5 M8 4 V9" />
    </svg>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12 L12 5.5 A6.5 6.5 0 0 1 18 12 Z" fill="currentColor" stroke="none" opacity={0.8} />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.7 7.7 M16.3 16.3 L18.4 18.4 M5.6 18.4 L7.7 16.3 M16.3 7.7 L18.4 5.6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12.5 L9.5 18 L20 5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5 L19 19 M19 5 L5 19" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12 H5 M11 6 L5 12 L11 18" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5 L19 12 L7 19 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 5 V19 M16 5 V19" strokeWidth={2.4} strokeLinecap="butt" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12 H19 M13 6 L19 12 L13 18" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3 V5.4 M12 18.6 V21 M4.4 4.4 L6.1 6.1 M17.9 17.9 L19.6 19.6 M3 12 H5.4 M18.6 12 H21 M4.4 19.6 L6.1 17.9 M17.9 6.1 L19.6 4.4" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 9 L12 16 L19 9" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7 H20 M9 7 V4.6 C9 4.3 9.3 4 9.6 4 H14.4 C14.7 4 15 4.3 15 4.6 V7 M6.5 7 L7.3 19.4 C7.3 19.7 7.6 20 8 20 H16 C16.4 20 16.7 19.7 16.7 19.4 L17.5 7" />
      <path d="M10.3 11 V16 M13.7 11 V16" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10.5 C6 7 8.5 4.5 12 4.5 C15.5 4.5 18 7 18 10.5 V13.5 C18 14.5 18.4 15.4 19 16 H5 C5.6 15.4 6 14.5 6 13.5 Z" />
      <path d="M10 18.5 C10 19.6 10.9 20.5 12 20.5 C13.1 20.5 14 19.6 14 18.5" />
    </svg>
  );
}

export function VibrationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="5" width="8" height="14" rx="1.6" />
      <path d="M3 9 V15 M21 9 V15" strokeLinecap="round" />
    </svg>
  );
}

export function AlertScreenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8.5 V13" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8 V12 L15 14" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.3A8.5 8.5 0 1 1 9.7 4 7 7 0 0 0 20 14.3Z" />
    </svg>
  );
}
