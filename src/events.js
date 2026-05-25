/**
 * events.js – Event CRUD & helpers (Alliance + Kingdom)
 */

import {
  getLocalEvents as getEvents,
  saveLocalEvents as saveEvents,
  getLocalKingdomEvents,
  saveLocalKingdomEvents,
} from './storage.js';
import { getNextOccurrence } from './timers.js';

// ── Alliance Events ─────────────────────────────────────────────

export function createEvent(data) {
  const events = getEvents();
  const recurring = data.recurring !== false; // default true
  const evt = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: data.title || 'Untitled Event',
    description: data.description || '',
    dayOfWeek: Number(data.dayOfWeek ?? 0),
    hour: Number(data.hour ?? 20),
    minute: Number(data.minute ?? 0),
    color: data.color || '#d4a800',
    notifOffsets: data.notifOffsets || [60, 15, 0],
    active: data.active !== undefined ? data.active : true,
    recurring,
    // For one-time events: store the exact upcoming UTC timestamp
    targetMs: recurring ? undefined : (data.targetMs || getNextOccurrence(Number(data.dayOfWeek ?? 0), Number(data.hour ?? 20), Number(data.minute ?? 0)).getTime()),
    createdAt: Date.now(),
  };
  events.push(evt);
  saveEvents(events);
  return evt;
}

export function updateEvent(id, updates) {
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...updates };
  saveEvents(events);
  return events[idx];
}

export function deleteEvent(id) {
  const events = getEvents().filter(e => e.id !== id);
  saveEvents(events);
}

export function duplicateEvent(id) {
  const events = getEvents();
  const src = events.find(e => e.id === id);
  if (!src) return null;
  return createEvent({
    ...src,
    title: src.title + ' (Copy)',
    id: undefined,
    createdAt: undefined,
  });
}

export function toggleEvent(id) {
  const events = getEvents();
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  return updateEvent(id, { active: !evt.active });
}

/**
 * Returns events sorted by next occurrence (nearest first).
 */
export function getSortedEvents() {
  const events = getEvents();
  return [...events].sort((a, b) => {
    const aNext = getNextOccurrence(a.dayOfWeek, a.hour, a.minute).getTime();
    const bNext = getNextOccurrence(b.dayOfWeek, b.hour, b.minute).getTime();
    return aNext - bNext;
  });
}

// ── Kingdom Events ──────────────────────────────────────────────

export function createKingdomEvent(data) {
  const events = getLocalKingdomEvents();
  const recurring = data.recurring !== false;
  const evt = {
    id: `kevt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: data.title || 'Untitled Kingdom Event',
    description: data.description || '',
    dayOfWeek: Number(data.dayOfWeek ?? 0),
    hour: Number(data.hour ?? 20),
    minute: Number(data.minute ?? 0),
    durationHours: Number(data.durationHours ?? 1),
    isKillEvent: data.isKillEvent === true,
    color: data.color || '#e83a3a',
    notifOffsets: data.notifOffsets || [60, 15, 0],
    active: data.active !== undefined ? data.active : true,
    recurring,
    targetMs: recurring ? undefined : (data.targetMs || getNextOccurrence(Number(data.dayOfWeek ?? 0), Number(data.hour ?? 20), Number(data.minute ?? 0)).getTime()),
    createdAt: Date.now(),
  };
  events.push(evt);
  saveLocalKingdomEvents(events);
  return evt;
}

export function updateKingdomEvent(id, updates) {
  const events = getLocalKingdomEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...updates };
  saveLocalKingdomEvents(events);
  return events[idx];
}

export function deleteKingdomEvent(id) {
  const events = getLocalKingdomEvents().filter(e => e.id !== id);
  saveLocalKingdomEvents(events);
}

export function toggleKingdomEvent(id) {
  const events = getLocalKingdomEvents();
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  return updateKingdomEvent(id, { active: !evt.active });
}
