/**
 * timers.js – Central 1-second tick engine
 * Manages countdowns for events and creature capture.
 */

import { tickNotifications, scheduleNotification, cancelScheduledNotification } from './notifications.js';
import { getEvents, getCreature, saveCreature, getSettings } from './storage.js';

// ── Tick callbacks registry ──────────────────────────────────────
// Map<id, fn> called every second
const tickCallbacks = new Map();
let intervalId = null;

export function startTimerEngine() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    tickNotifications();
    tickCallbacks.forEach(fn => { try { fn(); } catch {} });
  }, 1000);
}

export function stopTimerEngine() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

export function registerTick(id, fn) { tickCallbacks.set(id, fn); }
export function unregisterTick(id) { tickCallbacks.delete(id); }

// ── Time utilities ───────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function getDayName(index) { return DAYS[index]; }

/**
 * Returns the next UTC Date for a recurring weekly event.
 * dayOfWeek: 0=Sun … 6=Sat
 * hour, minute: UTC
 */
export function getNextOccurrence(dayOfWeek, hour, minute) {
  const now = new Date();
  const result = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0
  ));
  // Advance to the correct day of week
  const currentDay = result.getUTCDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  result.setUTCDate(result.getUTCDate() + daysAhead);
  // If it's already past today's occurrence, advance by 7 days
  if (result <= now) result.setUTCDate(result.getUTCDate() + 7);
  return result;
}

/**
 * Returns ms until next occurrence (can be negative if past)
 */
export function msUntilNext(dayOfWeek, hour, minute) {
  return getNextOccurrence(dayOfWeek, hour, minute).getTime() - Date.now();
}

/**
 * Format ms as HH:MM:SS  or  Xd HH:MM:SS
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  const pad = n => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export function formatCountdownParts(ms) {
  if (ms <= 0) return { h:'00', m:'00', s:'00', days:0 };
  const totalSecs = Math.floor(ms / 1000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  const pad = n => String(n).padStart(2, '0');
  return { h: pad(hours), m: pad(mins), s: pad(secs), days };
}

/**
 * Format a UTC Date to "HH:MM UTC" string
 */
export function formatUTCTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

/**
 * Format a UTC Date to local time string
 */
export function formatLocalTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Event Notification Scheduling ───────────────────────────────

/**
 * Schedule notifications for all active events.
 * Called on startup and whenever events change.
 * Works for both alliance events and kingdom events.
 */
export function scheduleEventNotifications(events) {
  events.filter(e => e.active).forEach(evt => {
    const isRecurring = evt.recurring !== false;

    // For one-time events: skip if already past start time
    if (!isRecurring && (!evt.targetMs || evt.targetMs <= Date.now())) return;

    const next = isRecurring
      ? getNextOccurrence(evt.dayOfWeek, evt.hour, evt.minute)
      : new Date(evt.targetMs);

    const offsets = evt.notifOffsets || [60, 15, 0];
    offsets.forEach(offsetMin => {
      const fireAt = next.getTime() - offsetMin * 60 * 1000;
      const id = `evt_${evt.id}_${offsetMin}`;
      cancelScheduledNotification(id);
      if (fireAt > Date.now()) {
        const isKill = evt.isKillEvent;
        const label = offsetMin === 0
          ? isKill
            ? `☠️ ${evt.title} is starting NOW! Shield up! ⚔️`
            : `${evt.title} is starting NOW! ⚔️`
          : isKill
            ? `☠️ Kill Event: ${evt.title} in ${offsetMin} min – Prepare your defences!`
            : `${evt.title} in ${offsetMin} min`;
        const title = isKill ? '☠️ Kingdom Kill Event!' : '⚔️ TheOutlanders - GoG';
        scheduleNotification(id, fireAt, title, label);
      }
    });
  });
}

// ── Kingdom Event Status ─────────────────────────────────────────

/**
 * Computes the current phase of a kingdom event.
 *
 * For a recurring event:
 *  - We check both the "previous" occurrence (started, may still be active)
 *    and the "next" occurrence (upcoming).
 *
 * Returns one of:
 *  { phase: 'active',    remainingMs }   – started, within duration window
 *  { phase: 'upcoming',  msUntilStart }  – starts within 24h
 *  { phase: 'future' }                   – starts in > 24h
 *  { phase: 'ended' }                    – one-time event fully expired
 */
export function getKingdomEventStatus(evt) {
  const durationMs = (evt.durationHours || 1) * 3600 * 1000;
  const now = Date.now();

  if (evt.recurring !== false) {
    // Check the most-recent past occurrence — it may still be active (within durationMs)
    const nextMs = getNextOccurrence(evt.dayOfWeek, evt.hour, evt.minute).getTime();
    const prevMs = nextMs - 7 * 24 * 3600 * 1000; // one week earlier = previous occurrence

    if (now >= prevMs && now < prevMs + durationMs) {
      return { phase: 'active', remainingMs: prevMs + durationMs - now };
    }

    const msUntilStart = nextMs - now;
    if (msUntilStart <= 24 * 3600 * 1000) {
      return { phase: 'upcoming', msUntilStart };
    }

    return { phase: 'future' };
  } else {
    // One-time event
    const startMs = evt.targetMs || 0;
    if (now >= startMs && now < startMs + durationMs) {
      return { phase: 'active', remainingMs: startMs + durationMs - now };
    }
    if (startMs > now && startMs - now <= 24 * 3600 * 1000) {
      return { phase: 'upcoming', msUntilStart: startMs - now };
    }
    if (startMs > now) return { phase: 'future' };
    return { phase: 'ended' };
  }
}

// ── Creature Capture Timer (Fixed UTC Spawn Times) ───────────────

/**
 * Fixed daily spawn hours in UTC.
 * Creatures appear at 02:00, 08:00, 14:00, 20:00 UTC every day.
 */
export const CREATURE_SPAWN_HOURS = [2, 8, 14, 20];

/**
 * Returns the next creature spawn Date (UTC).
 * Looks through today's and tomorrow's fixed hours to find the soonest future one.
 */
export function getCreatureNextSpawn() {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const h of CREATURE_SPAWN_HOURS) {
      const candidate = new Date(todayUtc + dayOffset * 86400000 + h * 3600000);
      if (candidate.getTime() > Date.now()) return candidate;
    }
  }
  // Fallback: first spawn two days ahead
  return new Date(todayUtc + 2 * 86400000 + CREATURE_SPAWN_HOURS[0] * 3600000);
}

/**
 * Returns the previous (most recent past) creature spawn Date (UTC).
 * Used to calculate ring progress.
 */
export function getCreaturePreviousSpawn() {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const allHours = [...CREATURE_SPAWN_HOURS].reverse();

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const h of allHours) {
      const candidate = new Date(todayUtc - dayOffset * 86400000 + h * 3600000);
      if (candidate.getTime() <= Date.now()) return candidate;
    }
  }
  return new Date(todayUtc - 86400000 + CREATURE_SPAWN_HOURS[CREATURE_SPAWN_HOURS.length - 1] * 3600000);
}

/**
 * Returns ms remaining until the next fixed creature spawn.
 */
export function getCreatureRemaining() {
  const data = getCreature();
  if (!data.enabled) return null;
  return Math.max(0, getCreatureNextSpawn().getTime() - Date.now());
}

/**
 * Schedule creature notifications using fixed spawn times.
 * Schedules for the NEXT upcoming spawn only.
 */
export function scheduleCreatureNotifications(data) {
  if (!data || !data.enabled) return;
  const next = getCreatureNextSpawn();
  const spawnAt = next.getTime();
  const offsets = data.notifOffsets || [15, 0, -10];

  offsets.forEach(min => {
    const fireAt = spawnAt - min * 60 * 1000;
    const id = `creature_${min}`;
    cancelScheduledNotification(id);
    if (fireAt > Date.now()) {
      const label = min === 0
        ? '🐉 Creature is spawning NOW!'
        : min < 0
          ? `🐉 Creature spawned ${Math.abs(min)} min ago – go capture!`
          : `🐉 Creature spawns in ${min} min`;
      scheduleNotification(id, fireAt, '🐉 GoG Creature Timer', label);
    }
  });
}

/**
 * Re-schedule creature notifications (call after enable/disable or settings change).
 */
export function refreshCreatureNotifications() {
  scheduleCreatureNotifications(getCreature());
}
