// Typed data-access functions for the singleton active-timer record.

import { STORES, getById, put, remove } from './db';
import type { TimerState } from '../types';

const TIMER_KEY = 'current';

export async function getTimerState(): Promise<TimerState | undefined> {
  return getById<TimerState>(STORES.timerState, TIMER_KEY);
}

export async function saveTimerState(state: TimerState): Promise<void> {
  await put(STORES.timerState, state);
}

export async function clearTimerState(): Promise<void> {
  await remove(STORES.timerState, TIMER_KEY);
}
