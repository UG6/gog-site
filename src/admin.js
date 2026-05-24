import { getLocalEvents, saveLocalEvents } from './storage.js';
import { createEvent, updateEvent, deleteEvent, toggleEvent } from './events.js';
import { getNextOccurrence, formatUTCTime, formatLocalTime, getDayName, formatCountdown } from './timers.js';
import { showToast, openModal, closeModal } from './ui.js';

// ── DOM Elements ──────────────────────────────────────────────────
const listEl = document.getElementById('admin-events-list');
const jsonOut = document.getElementById('admin-json-out');

// ── Render Local Events ───────────────────────────────────────────
function renderAdmin() {
  const events = getLocalEvents();
  
  // Update JSON output
  jsonOut.value = JSON.stringify(events, null, 2);

  // Sort by next occurrence
  const sorted = [...events].sort((a, b) => {
    const aMs = a.recurring !== false ? getNextOccurrence(a.dayOfWeek, a.hour, a.minute).getTime() : (a.targetMs || 0);
    const bMs = b.recurring !== false ? getNextOccurrence(b.dayOfWeek, b.hour, b.minute).getTime() : (b.targetMs || 0);
    return aMs - bMs;
  });

  listEl.innerHTML = sorted.length ? sorted.map(e => {
    const next = e.recurring !== false 
      ? getNextOccurrence(e.dayOfWeek, e.hour, e.minute)
      : new Date(e.targetMs || Date.now());
    return `
      <div class="event-item" style="border-color:${e.color}; opacity:${e.active ? 1 : 0.5}">
        <div>
          <div style="font-weight:bold">${e.title} ${e.recurring === false ? '<span style="font-size:0.7em;color:#aaa">(One-time)</span>' : ''}</div>
          <div style="font-size:0.8rem;color:#ccc">
            ${e.recurring !== false ? getDayName(e.dayOfWeek) + ' ' : ''}
            ${String(e.hour).padStart(2,'0')}:${String(e.minute).padStart(2,'0')} UTC
          </div>
        </div>
        <div class="actions">
          <button class="btn" style="background:#555;padding:4px 8px" data-action="toggle" data-id="${e.id}">${e.active ? '⏸' : '▶️'}</button>
          <button class="btn" style="padding:4px 8px" data-action="edit" data-id="${e.id}">✏️</button>
          <button class="btn btn-danger" style="padding:4px 8px" data-action="delete" data-id="${e.id}">🗑</button>
        </div>
      </div>
    `;
  }).join('') : '<p style="color:#888;font-style:italic">No local events.</p>';
}

// ── Actions ───────────────────────────────────────────────────────
listEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    if (confirm('Delete this event?')) {
      deleteEvent(id);
      renderAdmin();
      showToast('Deleted', 'info');
    }
  } else if (action === 'toggle') {
    toggleEvent(id);
    renderAdmin();
  } else if (action === 'edit') {
    const evt = getLocalEvents().find(ev => ev.id === id);
    if (evt) openEventModal(evt);
  }
});

// ── Modal UI Logic ────────────────────────────────────────────────
const COLOR_OPTIONS = ['#e83a3a','#e8702a','#d4a800','#2ecc71','#3a8bcd','#9b59b6','#e91e8c','#00bcd4'];
const NOTIF_OPTIONS = [
  { label: '2h', value: 120 }, { label: '1h', value: 60 },
  { label: '30m', value: 30 }, { label: '15m', value: 15 },
  { label: '10m', value: 10 }, { label: '5m', value: 5 },
  { label: 'At start', value: 0 },
];
const DAY_OPTIONS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function openEventModal(evt = null) {
  const isEdit = !!evt;
  const sel = evt || { color: '#d4a800', notifOffsets: [60, 15, 0], dayOfWeek: 6, hour: 18, minute: 0, active: true, recurring: true };

  const colorChips = COLOR_OPTIONS.map(c => `
    <div class="color-chip ${sel.color === c ? 'selected' : ''}"
      style="background:${c}" data-color="${c}" role="button" tabindex="0"></div>
  `).join('');

  const notifChips = NOTIF_OPTIONS.map(o => `
    <div class="notif-chip ${(sel.notifOffsets || []).includes(o.value) ? 'selected' : ''}"
      data-value="${o.value}">${o.label}</div>
  `).join('');

  const dayOpts = DAY_OPTIONS.map((d, i) =>
    `<option value="${i}" ${sel.dayOfWeek === i ? 'selected' : ''}>${d}</option>`
  ).join('');

  openModal(isEdit ? '✏️ Edit Event' : '➕ New Event', `
    <div class="form-group">
      <label class="form-label">Event Title *</label>
      <input type="text" class="form-input" id="evt-title" value="${evt?.title || ''}"
        placeholder="e.g. Night Siege" maxlength="50" />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="evt-desc" placeholder="Optional notes…">${evt?.description || ''}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="form-group" style="margin:0">
        <label class="form-label">Day (UTC)</label>
        <select class="form-select" id="evt-day">${dayOpts}</select>
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Hour (UTC)</label>
        <input type="number" class="form-input" id="evt-hour" min="0" max="23" value="${sel.hour}" />
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Minute</label>
        <input type="number" class="form-input" id="evt-minute" min="0" max="59" value="${sel.minute}" />
      </div>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label class="form-label">Color Tag</label>
      <div class="color-chips" id="color-chips">${colorChips}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Notification Reminders</label>
      <div class="notif-chips" id="notif-chips">${notifChips}</div>
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="toggle-wrap" style="padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:var(--radius-md)">
        <div>
          <div class="toggle-label" style="font-size:0.85rem;font-weight:500">🔂 Repeat weekly</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">Off = one-time event (auto-removes after it passes)</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="evt-recurring" ${sel.recurring !== false ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </label>
    </div>
    <div class="form-group">
      <label class="toggle-wrap">
        <span class="toggle-label">Active (enable reminders)</span>
        <label class="toggle">
          <input type="checkbox" id="evt-active" ${sel.active ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </label>
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary"   id="modal-save">${isEdit ? '💾 Save' : '➕ Add Event'}</button>
  `);

  let selectedColor = sel.color;
  const selectedOffsets = new Set(sel.notifOffsets || []);

  document.getElementById('color-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.color-chip');
    if (!chip) return;
    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedColor = chip.dataset.color;
  });

  document.getElementById('notif-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.notif-chip');
    if (!chip) return;
    const val = Number(chip.dataset.value);
    if (selectedOffsets.has(val)) { selectedOffsets.delete(val); chip.classList.remove('selected'); }
    else { selectedOffsets.add(val); chip.classList.add('selected'); }
  });

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);

  document.getElementById('modal-save')?.addEventListener('click', () => {
    const title = document.getElementById('evt-title')?.value.trim();
    if (!title) { showToast('Please enter a title', 'warning'); return; }
    
    const recurring = document.getElementById('evt-recurring')?.checked ?? true;
    const dayOfWeek = Number(document.getElementById('evt-day')?.value);
    const hour   = Math.min(23, Math.max(0, Number(document.getElementById('evt-hour')?.value)));
    const minute = Math.min(59, Math.max(0, Number(document.getElementById('evt-minute')?.value)));
    
    const data = {
      title,
      description: document.getElementById('evt-desc')?.value.trim(),
      dayOfWeek, hour, minute,
      color:        selectedColor,
      notifOffsets: [...selectedOffsets].sort((a, b) => b - a),
      active:       document.getElementById('evt-active')?.checked,
      recurring,
      targetMs: recurring ? undefined : getNextOccurrence(dayOfWeek, hour, minute).getTime(),
    };
    
    if (isEdit) { 
      updateEvent(evt.id, data); 
      showToast('Updated!', 'success'); 
    } else { 
      createEvent(data); 
      showToast('Added!', 'success'); 
    }
    
    closeModal();
    renderAdmin();
  });
}

// ── Bindings ──────────────────────────────────────────────────────
document.getElementById('admin-add-btn').addEventListener('click', () => openEventModal());

document.getElementById('admin-copy-btn').addEventListener('click', () => {
  jsonOut.select();
  document.execCommand('copy');
  showToast('JSON copied to clipboard!', 'success');
});

document.getElementById('admin-clear-btn').addEventListener('click', () => {
  if (confirm('Clear all local events?')) {
    saveLocalEvents([]);
    renderAdmin();
    showToast('Cleared', 'info');
  }
});

document.getElementById('admin-load-public-btn').addEventListener('click', async () => {
  if (!confirm('Overwrite your scratchpad with the live public events.json?')) return;
  try {
    const res = await fetch('/data/events.json?t=' + Date.now());
    const data = await res.json();
    saveLocalEvents(data);
    renderAdmin();
    showToast('Loaded public events', 'success');
  } catch(e) {
    showToast('Failed to load public events', 'error');
  }
});

// Init
renderAdmin();
