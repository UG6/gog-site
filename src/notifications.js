/**
 * notifications.js – Browser Notification & Sound helpers
 */

import { getSettings } from './storage.js';

// ── Permission ───────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Send Notification ────────────────────────────────────────────

export function sendNotification(title, body, tag = 'gog-tracker') {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const n = new Notification(title, {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: false,
    silent: false,
  });

  // Focus app tab on click
  n.onclick = () => {
    window.focus();
    n.close();
  };

  // Auto-close after 8 seconds
  setTimeout(() => n.close(), 8000);
}

// ── Scheduling Store ─────────────────────────────────────────────
// Map of { id → { fireAt: ms, title, body, fired: bool } }
const scheduled = new Map();

export function scheduleNotification(id, fireAtMs, title, body) {
  scheduled.set(id, { fireAt: fireAtMs, title, body, fired: false });
}

export function cancelScheduledNotification(id) {
  scheduled.delete(id);
}

export function cancelAllScheduled() {
  scheduled.clear();
}

/** Called every second by the timer engine */
export function tickNotifications() {
  const now = Date.now();
  for (const [id, entry] of scheduled.entries()) {
    if (!entry.fired && now >= entry.fireAt) {
      entry.fired = true;
      sendNotification(entry.title, entry.body, id);
      playAlert();
      vibrateDevice();
      // Remove after 30 s to avoid stale entries
      setTimeout(() => scheduled.delete(id), 30000);
    }
  }
}

// ── Sound (Web Audio API) ────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  return audioCtx;
}

/**
 * Plays a 3-tone chime: a pleasant ascending ding.
 */
export function playAlert(volume) {
  const settings = getSettings();
  if (!settings.soundEnabled) return;
  const vol = volume ?? settings.soundVolume ?? 0.6;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const tones = [523.25, 659.25, 783.99]; // C5, E5, G5
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
    gain.gain.linearRampToValueAtTime(vol * 0.4, ctx.currentTime + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.4);
  });
}

/** Urgent buzzer (lower tone) */
export function playUrgentAlert(volume) {
  const settings = getSettings();
  if (!settings.soundEnabled) return;
  const vol = volume ?? settings.soundVolume ?? 0.6;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.55);
}

// ── Vibration ────────────────────────────────────────────────────

export function vibrateDevice(pattern = [200, 100, 200]) {
  const settings = getSettings();
  if (!settings.vibrationEnabled) return;
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
