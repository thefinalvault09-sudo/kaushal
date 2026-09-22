# Grit

**Build a better you.**

A focused, personal commitment/discipline system. Plan a commitment, execute
it with a built-in timer, and let the record speak for itself.

```
PLAN  →  EXECUTE  →  RECORD  →  REPEAT
```

This is a single-user, local-first app. It is not an AI coach, a chatbot, a
social network, or a gamified habit tracker — there are no points, streak
rewards, or scores. Just commitments, a timer, and a factual history.

## Features

- **Commitments** — a name, a daily time target, a duration in days, and a
  start date. One day record is generated for every scheduled day.
- **Timer** — start / pause / resume / stop. Elapsed time is calculated from
  timestamps (not a naive interval count), so it survives a page refresh,
  browser close, or reopen. Progress is capped at 100% of the daily target.
- **History** — a permanent, append-only record per day: `NOT STARTED`,
  `PARTIAL`, `MISSED`, `DONE`, or `COMPLETED LATE`. Scheduled dates never
  move, and history is never rewritten.
- **Progress** — factual totals: planned days, completed, partial, missed,
  completion %, and consistency %. No scoring, no gamification.
- **Settings** — Deep (dark) / Daylight (light) theme, a notification
  preference, JSON export/import, and a permanent reset with an explicit
  confirmation.

## Tech stack

- React + TypeScript + Vite
- IndexedDB for persistence (a small hand-written wrapper — no ORM)
- Plain CSS with design tokens (no CSS framework)
- React Router for navigation
- One React context (`AppContext`) for app state — no Redux/Zustand/Query
- Vitest for unit tests

## How to run

```bash
npm install
npm run dev       # start the dev server (http://localhost:5173)
npm run build     # type-check and build for production
npm run preview   # preview the production build locally
npm run test       # run the unit test suite once
```

## Project structure

```
src/
  types.ts              Core data models (Commitment, DayRecord, TimerState, Settings)
  db/
    db.ts                Thin IndexedDB wrapper (open, get, put, indexes)
    repository.ts        Typed data-access functions used by the rest of the app
  timer/
    engine.ts            Pure timestamp-based timer math (unit tested)
  utils/
    date.ts              Local-calendar-day date helpers
    status.ts             Derives display status (MISSED, COMPLETED_LATE, etc.)
    progress.ts           Factual progress/consistency calculations
  context/
    AppContext.tsx        Single app-wide context; the only layer that talks to db/
  components/             Shared UI: Layout/nav, StatusBadge, FocusLens, icons
  screens/                One file per screen (Welcome, Today, Timer, Commitments,
                           NewCommitment, CommitmentDetail, Progress, Settings)
  styles/                 Design tokens (theme.css) and global styles (global.css)
```

## Design system

The visual language is "Aqua Lens": clear-water optics with translucent,
liquid-glass surfaces, organic rounded/teardrop geometry, and dividers that
fade at both ends rather than hard borders. Deep (dark, underwater) and
Daylight (light, ivory) themes share the same tokens. There is a persistent
sidebar (desktop) with a floating pill tab bar on mobile (below ~768px).
