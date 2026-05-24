/**
 * ui.js – Single-page render, live updates, modals, toasts
 */

import {
  getEvents, saveEvents, getSettings, getCreature, saveCreature,
} from './storage.js';

import {
  getNextOccurrence, formatCountdown, formatCountdownParts,
  formatUTCTime, formatLocalTime, getDayName, msUntilNext,
  getCreatureRemaining, getCreatureNextSpawn, getCreaturePreviousSpawn,
  CREATURE_SPAWN_HOURS, scheduleCreatureNotifications,
  scheduleEventNotifications, refreshCreatureNotifications,
} from './timers.js';
import {
  requestNotificationPermission, getNotificationPermission,
} from './notifications.js';

// ── Helpers ───────────────────────────────────────────────────────
// ── Toast ─────────────────────────────────────────────────────────
export function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Modal ─────────────────────────────────────────────────────────
export function openModal(titleText, bodyHTML, footerHTML = '') {
  const overlay = document.getElementById('modal-overlay');
  const box     = document.getElementById('modal-box');
  if (!overlay || !box) return;
  box.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${titleText}</span>
      <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
  `;
  overlay.classList.remove('hidden');
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

export function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

// ── Notification banner ───────────────────────────────────────────
function notifBannerHTML() {
  const perm = getNotificationPermission();
  if (perm === 'granted' || perm === 'unsupported') return '';
  return `
    <div class="notif-banner">
      <span>🔔 Enable notifications to get event reminders</span>
      <button class="btn btn-primary btn-sm" id="enable-notif-btn">Enable</button>
    </div>
  `;
}

// ── RENDER APP (full single page) ─────────────────────────────────
// ── Event timing helper (works for both recurring and one-time) ──────
function getEventMs(evt) {
  if (evt.recurring !== false) return msUntilNext(evt.dayOfWeek, evt.hour, evt.minute);
  return Math.max(0, (evt.targetMs || 0) - Date.now());
}

export function renderApp(container) {
  if (!container) return;

  const allEvents = getEvents();

  // Filter: recurring always shown, one-time only if not yet expired and not hidden
  const events = allEvents.filter(e =>
    !e.hidden && (e.recurring !== false || (e.targetMs || 0) > Date.now())
  );

  const sorted  = [...events].sort((a, b) => getEventMs(a) - getEventMs(b));
  const nextEvt = sorted.find(e => e.active);
  const admin   = false;

  container.innerHTML = `
    <div class="fade-in">
      ${notifBannerHTML()}
      ${heroSectionHTML(nextEvt)}
      <div class="main-grid">
        ${creatureSectionHTML()}
        ${eventsSectionHTML(sorted)}
      </div>
      <footer class="app-footer">TheOutlanders - GoG · v1.0</footer>
    </div>
  `;

  bindApp(container, sorted, nextEvt);
}


// ── Hero section ──────────────────────────────────────────────────
function heroSectionHTML(evt) {
  if (!evt) return `
    <div class="card" style="text-align:center;padding:28px 16px;margin-bottom:12px">
      <div class="empty-icon">📅</div>
      <div class="empty-title">No upcoming events</div>
      <div class="empty-desc">Check back later for new alliance events!</div>
    </div>
  `;

  const next    = getNextOccurrence(evt.dayOfWeek, evt.hour, evt.minute);
  const ms      = msUntilNext(evt.dayOfWeek, evt.hour, evt.minute);
  const parts   = formatCountdownParts(ms);
  const utcStr  = `${getDayName(evt.dayOfWeek)} ${String(evt.hour).padStart(2,'0')}:${String(evt.minute).padStart(2,'0')} UTC`;
  const locStr  = formatLocalTime(next);
  const urgent  = ms < 3600000;
  const hasDays = parts.days > 0;

  return `
    <div class="hero-card ${urgent ? 'urgent' : ''}" id="hero-card">
      <div class="hero-label">⚔️ Next Alliance Event</div>
      <div class="hero-event-name" id="hero-event-name">${evt.title}</div>
      <div class="hero-event-time">${utcStr} · ${locStr} local</div>
      <div class="countdown-hero">
        <!-- DAYS unit: visible only when ≥1 day remaining -->
        <div class="countdown-unit" id="cd-days-wrap" ${hasDays ? '' : 'style="display:none"'}>
          <span id="cd-d">${parts.days}</span>
          <span class="countdown-label">DAYS</span>
        </div>
        <span class="cd-sep" id="cd-sep-d" ${hasDays ? '' : 'style="display:none"'}>:</span>
        <div class="countdown-unit">
          <span id="cd-h">${parts.h}</span>
          <span class="countdown-label">HRS</span>
        </div>
        <span class="cd-sep">:</span>
        <div class="countdown-unit">
          <span id="cd-m">${parts.m}</span>
          <span class="countdown-label">MIN</span>
        </div>
        <span class="cd-sep">:</span>
        <div class="countdown-unit">
          <span id="cd-s">${parts.s}</span>
          <span class="countdown-label">SEC</span>
        </div>
      </div>
    </div>
  `;
}

// ── Creature availability (ON MAP for 2h after each spawn) ────────
function getCreatureOnMapStatus() {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let dayOffset = -1; dayOffset <= 0; dayOffset++) {
    for (const h of CREATURE_SPAWN_HOURS) {
      const spawnMs = todayUtc + dayOffset * 86400000 + h * 3600000;
      const endMs   = spawnMs + 2 * 3600000; // 2h window
      if (Date.now() >= spawnMs && Date.now() < endMs) {
        return { remainingMs: endMs - Date.now(), spawnHour: h, endMs };
      }
    }
  }
  return null;
}

// ── Creature section ──────────────────────────────────────────────
function creatureSectionHTML() {
  const data      = getCreature();
  const ms        = getCreatureRemaining();
  const nextSpawn = getCreatureNextSpawn();
  const prevSpawn = getCreaturePreviousSpawn();
  const onMap     = getCreatureOnMapStatus();

  // Ring progress
  const CYCLE_MS = 6 * 3600 * 1000;
  const R = 72; const C = 2 * Math.PI * R;
  let progress = 0;
  if (data.enabled && prevSpawn) {
    progress = Math.max(0, Math.min(1, (Date.now() - prevSpawn.getTime()) / CYCLE_MS));
  }
  const dashOffset = C * (1 - progress);

  // Today's spawn slots
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const slots = CREATURE_SPAWN_HOURS.map(h => {
    const t      = new Date(todayUtc + h * 3600000);
    const isPast = t.getTime() <= Date.now();
    const isNext = nextSpawn && t.getTime() === nextSpawn.getTime();
    const endMs  = t.getTime() + 2 * 3600000;
    const isOnMap = Date.now() >= t.getTime() && Date.now() < endMs;
    return { h, t, isPast, isNext, isOnMap };
  });

  const urgent = data.enabled && ms !== null && ms < 900000;

  return `
    <div class="card creature-section" id="creature-card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>🐉 Creature Capture</span>
        <label class="toggle" title="Enable/disable notifications">
          <input type="checkbox" id="creature-enabled-toggle" ${data.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- ON MAP NOW banner -->
      ${onMap ? `
        <div id="creature-on-map-banner" style="
          background: rgba(46,204,113,0.12);
          border: 1px solid rgba(46,204,113,0.35);
          border-radius: var(--radius-md);
          padding: 10px 14px; margin-bottom: 12px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px;
        ">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🟢</span>
            <div>
              <div style="font-weight:600;font-size:0.85rem;color:var(--green)">
                Creatures are ON THE MAP!
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px">
                Go capture now — available until ${formatUTCTime(new Date(onMap.endMs))}
              </div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;color:var(--green)" id="on-map-timer">
              ${formatCountdown(onMap.remainingMs)}
            </div>
            <div style="font-size:0.6rem;color:var(--text-muted);letter-spacing:0.5px">REMAINING</div>
          </div>
        </div>
      ` : `<div id="creature-on-map-banner" style="display:none"></div>`}

      <!-- Ring + countdown -->
      <div class="creature-ring-wrap">
        <div class="creature-ring">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   style="stop-color:var(--gold);stop-opacity:1"/>
                <stop offset="100%" style="stop-color:var(--orange);stop-opacity:1"/>
              </linearGradient>
            </defs>
            <circle class="ring-bg" cx="80" cy="80" r="${R}" />
            <circle class="ring-progress" cx="80" cy="80" r="${R}"
              stroke-dasharray="${C}"
              stroke-dashoffset="${dashOffset}"
              id="ring-progress-circle"
            />
          </svg>
          <div class="ring-center">
            <div class="ring-countdown ${urgent ? 'urgent' : ''}" id="creature-countdown">
              ${data.enabled ? formatCountdown(ms) : 'Off'}
            </div>
            <div class="ring-sublabel">NEXT SPAWN</div>
          </div>
        </div>

        <!-- Spawn slots -->
        <div class="spawn-grid">
          ${slots.map(({ h, t, isPast, isNext, isOnMap }) => `
            <div class="spawn-slot
              ${isNext   ? 'is-next'   : ''}
              ${isOnMap  ? 'is-on-map' : ''}
              ${isPast && !isNext && !isOnMap ? 'is-past' : ''}
            ">
              <div class="spawn-slot-tag">
                ${isOnMap ? '🟢 ON MAP' : isNext ? '▶ NEXT' : isPast ? 'DONE' : 'LATER'}
              </div>
              <div class="spawn-slot-utc">${String(h).padStart(2,'0')}:00</div>
              <div class="spawn-slot-local">${formatLocalTime(t)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Meta row -->
        <div class="creature-meta">
          <span>Next UTC: <strong id="creature-next-utc">${nextSpawn ? formatUTCTime(nextSpawn) : '--:--'}</strong></span>
          <span>·</span>
          <span>Local: <strong id="creature-next-local">${nextSpawn ? formatLocalTime(nextSpawn) : '--:--'}</strong></span>
        </div>
      </div>
    </div>
  `;
}

// ── Events section ────────────────────────────────────────────────
function eventsSectionHTML(sorted) {
  return `
    <div id="events-section">
      <div class="section-header">
        <span class="section-title">⚔️ Alliance Events</span>
      </div>

      <div id="events-list">
        ${sorted.length
          ? sorted.map(e => eventCardHTML(e)).join('')
          : `<div class="empty-state">
               <div class="empty-icon">📅</div>
               <div class="empty-title">No upcoming events</div>
               <div class="empty-desc">Check back later for new alliance events!</div>
             </div>`
        }
      </div>
    </div>
  `;
}

function eventCardHTML(evt) {
  const ms       = getEventMs(evt);
  const urgent   = ms < 3600000;
  const isRecurring = evt.recurring !== false;
  const utcStr   = `${getDayName(evt.dayOfWeek)} ${String(evt.hour).padStart(2,'0')}:${String(evt.minute).padStart(2,'0')} UTC`;
  const nextDate = isRecurring
    ? getNextOccurrence(evt.dayOfWeek, evt.hour, evt.minute)
    : new Date(evt.targetMs || Date.now());
  const locStr   = formatLocalTime(nextDate);

  return `
    <div class="event-card ${evt.active ? '' : 'disabled'}" id="ecard-${evt.id}">
      <div class="event-color-bar" style="background:${evt.color}"></div>
      <div class="event-info">
        <div class="event-title">
          ${evt.title}
          <span style="
            font-size:0.58rem;letter-spacing:0.5px;padding:1px 6px;
            border-radius:10px;font-family:'Inter',sans-serif;font-weight:500;
            margin-left:6px;vertical-align:middle;
            ${isRecurring
              ? 'background:rgba(212,168,0,0.12);color:var(--gold);border:1px solid rgba(212,168,0,0.25)'
              : 'background:rgba(58,139,205,0.12);color:#7ec8ff;border:1px solid rgba(58,139,205,0.25)'
            }
          ">${isRecurring ? '🔂 weekly' : '1× once'}</span>
        </div>
        <div class="event-schedule">${utcStr} · ${locStr}</div>
        ${evt.description ? `<div class="event-desc">${evt.description}</div>` : ''}
      </div>
      <div class="event-right">
        <div class="countdown-sm ${urgent ? 'urgent' : ''}" data-event-cd="${evt.id}">${formatCountdown(ms)}</div>
      </div>
    </div>
  `;
}

// ── Bind all interactions ─────────────────────────────────────────
function bindApp(container, sorted, nextEvt) {
  // Notification banner
  document.getElementById('enable-notif-btn')?.addEventListener('click', async () => {
    const r = await requestNotificationPermission();
    if (r === 'granted') { showToast('Notifications enabled! 🔔', 'success'); renderApp(container); }
    else showToast('Permission denied', 'error');
  });

  // Creature toggle
  document.getElementById('creature-enabled-toggle')?.addEventListener('change', e => {
    const data = getCreature();
    data.enabled = e.target.checked;
    saveCreature(data);
    if (data.enabled) refreshCreatureNotifications();
    // Update ring/countdown locally without full re-render
    const cdEl = document.getElementById('creature-countdown');
    if (cdEl) cdEl.textContent = data.enabled ? formatCountdown(getCreatureRemaining()) : 'Off';
  });
}

// ── Live updates (called every tick) ────────────────────────────────
export function updateLiveElements() {
  // ─ Re-render if one-time events expire ──────────────────────────
  const expired = getEvents().filter(
    e => e.recurring === false && (e.targetMs || 0) <= Date.now()
  );
  if (expired.length > 0) {
    // We just re-render to hide them. The actual array in memory doesn't
    // strictly need removing since the filter in renderApp hides them,
    // but we can just trigger a re-render to clear the DOM.
    // However, to prevent infinite loops, we should mutate the cached event
    // so it doesn't keep triggering this block every second.
    expired.forEach(e => { e.targetMs = undefined; e.recurring = false; e.hidden = true; });
    const appContent = document.getElementById('app-content');
    if (appContent) { renderApp(appContent); return; }
  }

  // Hero countdown
  // ─ Hero countdown ─────────────────────────────────────────────
  const nextEvt = (() => {
    const all = getEvents().filter(e =>
      e.active && (e.recurring !== false || (e.targetMs || 0) > Date.now())
    );
    return [...all].sort((a, b) => getEventMs(a) - getEventMs(b))[0];
  })();

  if (nextEvt) {
    const ms    = getEventMs(nextEvt);
    const parts = formatCountdownParts(ms);
    const el    = id => document.getElementById(id);
    if (el('cd-d')) el('cd-d').textContent = parts.days;
    if (el('cd-h')) el('cd-h').textContent = parts.h;
    if (el('cd-m')) el('cd-m').textContent = parts.m;
    if (el('cd-s')) el('cd-s').textContent = parts.s;
    const daysWrap = el('cd-days-wrap');
    const daysSep  = el('cd-sep-d');
    if (daysWrap) daysWrap.style.display = parts.days > 0 ? '' : 'none';
    if (daysSep)  daysSep.style.display  = parts.days > 0 ? '' : 'none';
    const hero = document.getElementById('hero-card');
    if (hero) hero.classList.toggle('urgent', ms < 3600000);
  }

  // Creature
  const data      = getCreature();
  const ms        = getCreatureRemaining();
  const nextSpawn = getCreatureNextSpawn();
  const prevSpawn = getCreaturePreviousSpawn();

  const cdEl = document.getElementById('creature-countdown');
  if (cdEl) {
    cdEl.textContent = data.enabled ? formatCountdown(ms) : 'Off';
    cdEl.className   = `ring-countdown ${data.enabled && ms !== null && ms < 900000 ? 'urgent' : ''}`;
  }

  const CYCLE_MS = 6 * 3600 * 1000;
  const R = 72; const C = 2 * Math.PI * R;
  let progress = 0;
  if (data.enabled && prevSpawn) {
    progress = Math.max(0, Math.min(1, (Date.now() - prevSpawn.getTime()) / CYCLE_MS));
  }
  const ring = document.getElementById('ring-progress-circle');
  if (ring) ring.setAttribute('stroke-dashoffset', C * (1 - progress));

  const nUtc = document.getElementById('creature-next-utc');
  const nLoc = document.getElementById('creature-next-local');
  if (nUtc) nUtc.textContent = nextSpawn ? formatUTCTime(nextSpawn) : '--:--';
  if (nLoc) nLoc.textContent = nextSpawn ? formatLocalTime(nextSpawn) : '--:--';

  // ON MAP NOW banner — tick update
  const onMap        = getCreatureOnMapStatus();
  const banner       = document.getElementById('creature-on-map-banner');
  const onMapTimerEl = document.getElementById('on-map-timer');
  if (banner) {
    if (onMap) {
      // If the banner is empty (creature just came on map without a refresh),
      // inject the full banner HTML so it displays correctly.
      if (!onMapTimerEl) {
        banner.style.cssText = `
          background: rgba(46,204,113,0.12);
          border: 1px solid rgba(46,204,113,0.35);
          border-radius: var(--radius-md);
          padding: 10px 14px; margin-bottom: 12px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px;
        `;
        banner.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🟢</span>
            <div>
              <div style="font-weight:600;font-size:0.85rem;color:var(--green)">
                Creatures are ON THE MAP!
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px">
                Go capture now — available until ${formatUTCTime(new Date(onMap.endMs))}
              </div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;color:var(--green)" id="on-map-timer">
              ${formatCountdown(onMap.remainingMs)}
            </div>
            <div style="font-size:0.6rem;color:var(--text-muted);letter-spacing:0.5px">REMAINING</div>
          </div>
        `;
        // Also re-render the spawn slots so the "ON MAP" badge appears
        const appContent = document.getElementById('app-content');
        if (appContent) { renderApp(appContent); return; }
      } else {
        banner.style.display = '';
        onMapTimerEl.textContent = formatCountdown(onMap.remainingMs);
      }
    } else {
      // Creature just went off map — clear the banner content and hide it
      if (onMapTimerEl) {
        banner.style.display = 'none';
        banner.innerHTML = '';
        // Re-render so spawn slots update (ON MAP → DONE/NEXT)
        const appContent = document.getElementById('app-content');
        if (appContent) { renderApp(appContent); return; }
      } else {
        banner.style.display = 'none';
      }
    }
  }

  // ─ All event countdowns ────────────────────────────────────────
  document.querySelectorAll('[data-event-cd]').forEach(el => {
    const id  = el.dataset.eventCd;
    const evt = getEvents().find(e => e.id === id);
    if (!evt) return;
    const ms = getEventMs(evt);
    el.textContent = formatCountdown(ms);
    el.classList.toggle('urgent', ms < 3600000);
  });

  // Admin session timer in banner
  const adminTimerEl = document.getElementById('admin-session-timer');
  if (adminTimerEl && window._gogIsAdmin?.()) {
    const rem = window._gogAdminMs();
    const h   = Math.floor(rem / 3600000);
    const m   = Math.floor((rem % 3600000) / 60000);
    const s   = Math.floor((rem % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    adminTimerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
}

