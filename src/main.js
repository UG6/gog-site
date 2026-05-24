/**
 * main.js – Bootstrap, tick engine, admin state, theme, notifications
 */

import './style.css';
import {
  startTimerEngine, registerTick,
  scheduleEventNotifications, scheduleCreatureNotifications,
} from './timers.js';
import { getEvents, getCreature } from './storage.js';
import { requestNotificationPermission, sendNotification, playAlert } from './notifications.js';
import { renderApp, updateLiveElements, showToast } from './ui.js';

import { fetchPublicEvents } from './storage.js';

// No admin mode on public site
window._gogIsAdmin = () => false;

// ── Clocks ────────────────────────────────────────────────────────
function updateClocks() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');

  const utcEl = document.getElementById('utc-clock');
  if (utcEl) utcEl.textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

  const localEl = document.getElementById('local-clock');
  if (localEl) localEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Admin button removed from public site
// ── Service Worker ────────────────────────────────────────────────
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[GoG] SW registered:', reg.scope);
    } catch (e) {
      console.warn('[GoG] SW registration failed:', e);
    }
  }
}

function tick() {
  updateClocks();
  updateLiveElements();
}

// ── Bootstrap ─────────────────────────────────────────────────────
async function init() {
  await fetchPublicEvents();

  // Timer engine
  registerTick('ui', tick);
  startTimerEngine();
  updateClocks();

  // Schedule notifications
  scheduleEventNotifications(getEvents());
  const creature = getCreature();
  if (creature.enabled) scheduleCreatureNotifications(creature);

  // SW
  await registerSW();

  // Auto-request notification permission
  if (Notification?.permission === 'default') {
    setTimeout(() => requestNotificationPermission(), 2000);
  }

  // Render single page
  const content = document.getElementById('app-content');
  renderApp(content);

  // Notification test
  document.getElementById('notif-btn')?.addEventListener('click', () => {
    requestNotificationPermission().then(r => {
      if (r === 'granted') {
        sendNotification('🔔 Test Notification', 'TheOutlanders - GoG Tracker is working! ⚔️');
        playAlert();
        showToast('Test notification sent!', 'success');
      } else {
        showToast('Click "Enable" in the banner above first', 'warning');
      }
    });
  });

  // Remove splash
  setTimeout(() => document.getElementById('splash')?.classList.add('hidden'), 700);
}



init().catch(console.error);
