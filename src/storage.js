/**
 * storage.js – LocalStorage CRUD helpers
 * All data lives in localStorage under 'gog_*' keys.
 */

const KEYS = {
  EVENTS: 'gog_events',
  SETTINGS: 'gog_settings',
  CREATURE: 'gog_creature',
};

// ── Default data ────────────────────────────────────────────────

const DEFAULT_EVENTS = [];

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  soundVolume: 0.6,
  vibrationEnabled: true,
  darkMode: true,
  timezoneDisplay: 'both', // 'utc' | 'local' | 'both'
  notifOffsets: [60, 15, 0],
};

const DEFAULT_CREATURE = {
  enabled: true,
  soundEnabled: true,
  // Fixed spawn times: 02:00, 08:00, 14:00, 20:00 UTC — no manual reset needed
  notifOffsets: [15, 0, -10], // min before spawn (negative = after spawn)
};

// ── Generic helpers ─────────────────────────────────────────────

function get(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {
    console.error('Storage write failed:', e);
  }
}

let _cachedEvents = [];

export async function fetchPublicEvents() {
  try {
    const res = await fetch('/data/events.json?t=' + Date.now());
    if (res.ok) {
      _cachedEvents = await res.json();
    } else {
      console.warn('Could not load events.json');
    }
  } catch (e) {
    console.warn('Error loading events.json', e);
  }
}

export function getEvents() {
  return _cachedEvents;
}

export function saveEvents(events) {
  _cachedEvents = events; // Only modifies in-memory state for the current session
}

// ── Admin Local Storage ─────────────────────────────────────────

export function getLocalEvents() { return get(KEYS.EVENTS, []); }
export function saveLocalEvents(events) { set(KEYS.EVENTS, events); }


// ── Settings ────────────────────────────────────────────────────

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...get(KEYS.SETTINGS, {}) };
}

export function saveSettings(settings) { set(KEYS.SETTINGS, settings); }

// ── Creature ────────────────────────────────────────────────────

export function getCreature() {
  return { ...DEFAULT_CREATURE, ...get(KEYS.CREATURE, {}) };
}

export function saveCreature(data) { set(KEYS.CREATURE, data); }

// ── Backup / Restore ─────────────────────────────────────────────

export function exportBackup() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    events: getEvents(),
    settings: getSettings(),
    creature: getCreature(),
  }, null, 2);
}

export function importBackup(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.events) saveEvents(data.events);
  if (data.settings) saveSettings(data.settings);
  if (data.creature) saveCreature(data.creature);
}
