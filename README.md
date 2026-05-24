# ⚔️ GoG Alliance Event Tracker

A lightweight **PWA companion dashboard** for Guns of Glory alliance coordination.  
Track events, creature spawn timers, and receive browser notifications — all 100% offline-capable.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Dashboard** | Next event hero countdown, creature widget, quick actions |
| **Alliance Events** | Add / edit / delete / duplicate / toggle — 6 default events included |
| **Creature Timer** | Configurable 6h cycle with SVG ring, reset button, spawn times |
| **Browser Notifications** | Permission flow, scheduled alerts, click-to-focus |
| **PWA** | Installable, offline-capable, manifest + service worker |
| **Timezone Support** | UTC stored, auto-converted to local; display UTC/local/both |
| **Import / Export** | JSON backup in Settings |
| **Dark / Light Mode** | Defaults to dark gaming theme |
| **Mobile-first** | Bottom nav, responsive layout, vibration support |

---

## 🚀 Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🏗️ Build for Production

```bash
npm run build
```

Output goes to `dist/`. Preview with:

```bash
npm run preview
```

---

## 🌐 Deploy to Netlify (Free Plan)

### Option A – GitHub → Netlify (Recommended)

1. Push this repo to a **private GitHub repository**
2. Log in to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select your GitHub repo
4. Netlify auto-detects `netlify.toml` — settings are already configured:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy site** — done!

Every `git push` to `main` will trigger an automatic redeploy.

### Option B – Manual Drag & Drop

```bash
npm run build
```

Drag the `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)

---

## 📁 File Structure

```
gog_site/
├── index.html              # App shell
├── vite.config.js          # Vite + Tailwind + PWA config
├── netlify.toml            # Netlify deployment config
├── public/
│   ├── icons/
│   │   ├── icon-192.png    # PWA icon
│   │   └── icon-512.png    # PWA icon (maskable)
│   └── service-worker.js   # SW reference (vite-plugin-pwa generates sw.js)
└── src/
    ├── main.js             # Router, clocks, bootstrap
    ├── style.css           # Dark gaming theme + Tailwind
    ├── storage.js          # LocalStorage CRUD
    ├── timers.js           # Countdown engine, next occurrence calc
    ├── notifications.js    # Browser Notification API + Web Audio
    ├── events.js           # Event CRUD helpers
    └── ui.js               # All page renderers
```

---

## 📅 Default Events

| Event | Day | UTC Time |
|---|---|---|
| Night Siege | Saturday | 18:00 |
| Berserk Behemoth | Sunday | 20:00 |
| Creation Arena | Monday | 19:00 |
| SvS | Friday | 20:00 |
| Pirate Showdown | Wednesday | 18:30 |
| Kingdom Defense | Thursday | 21:00 |

All times are stored and displayed in UTC with automatic local conversion.

---

## 🔔 Notification Setup

1. Open the app → a permission prompt appears after 2 seconds
2. Click **Enable** → approve in the browser prompt
3. Notifications fire at your configured offsets (default: 1h, 15min, at-start)
4. Clicking a notification focuses the app tab

> **Note**: Notifications require HTTPS. They work on Netlify by default.  
> On localhost, they work in Chrome/Firefox with no extra config.

---

## 🔧 Customisation

- **Change creature cycle**: Settings → Creature Timer Duration (or Creature page directly)
- **Add custom events**: Events → + Add → fill title, UTC day/time, color, notification offsets
- **Backup data**: Settings → Export Backup → save JSON file
- **Transfer to new device**: Export → copy JSON → Import on new device

---

## 📱 Install as App (PWA)

**Chrome/Edge**: Address bar → install icon (➕) → Install  
**Android**: Browser menu → "Add to Home Screen"  
**iOS Safari**: Share → "Add to Home Screen"

---

## 🛠️ Tech Stack

- **Vite** (build tool)
- **Vanilla JavaScript** (no frameworks)
- **TailwindCSS v4** (styling)
- **vite-plugin-pwa** (PWA + Workbox)
- **LocalStorage** (data persistence)
- **Web Audio API** (sound alerts)
- **Notification API** (browser alerts)
- **Vibration API** (mobile haptics)

---

## 📄 License

MIT — free to use and modify for your alliance!
