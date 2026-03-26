# SOLARIS — Sun Tracker for Photographers

A no-backend PWA for photography location scouting. Runs entirely in the browser, deployable to GitHub Pages.

## Features

- **AR View** — live camera feed with sun position overlay, compass-locked
- **Planning Map** — top-down view with real building footprints from OpenStreetMap
- **Shadow projection** — dynamic shadow polygons scaled to sun altitude
- **Smart fetch cone** — builds a wedge in the shadow direction, wider at golden hour, narrower at midday
- **Time scrubber** — drag the sun along its arc to preview shadows at any time
- **Date picker** — plan for any day, with quick-select for solstices and equinoxes
- **FOV calibration** — one-tap sun alignment to correct for device camera differences
- **Offline capable** — service worker caches everything after first load

## Deploy to GitHub Pages

```bash
# 1. Fork or clone this repo
git clone https://github.com/yourusername/solaris.git
cd solaris

# 2. Push to your repo (no build step needed — it's vanilla JS modules)
git push origin main

# 3. In GitHub repo Settings → Pages → Source: main branch / root
```

That's it. Your app is live at `https://yourusername.github.io/solaris/`

> **Note:** GitHub Pages serves HTTPS by default, which is required for camera and DeviceOrientation APIs.

## Icons

Drop your own icons into `/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Or generate them from the SVG sun logo in `index.html` using [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator).

## Local development

```bash
# Any static file server works. Example with npx:
npx serve .

# Or Python:
python3 -m http.server 8080
```

Open `http://localhost:8080` — note that camera/compass won't work without HTTPS unless you use a localhost exemption (most browsers exempt localhost).

## Data sources

- **Sun calculations** — [SunCalc](https://github.com/mourner/suncalc) (MIT)
- **Building footprints** — [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) (ODbL)
- **No API keys required**

## Building height data

OSM coverage is excellent in European city centres and good in most major cities worldwide. In suburban or rural areas, buildings may fall back to a 10m default estimate. Users can note this and the app labels buildings with estimated vs real heights.

## Architecture

```
index.html          — Shell, loads fonts + SunCalc CDN
src/
  css/main.css      — All styles, CSS variables, animations
  js/
    app.js          — Boot, state, tab routing, HUD
    sun-engine.js   — SunCalc wrapper, wedge math
    buildings.js    — Overpass fetcher, tiled cache
    map-renderer.js — Top-down canvas: buildings, shadows, pan/zoom
    ar-renderer.js  — AR canvas: sun overlay on camera feed
    scrubber.js     — Draggable sun-path time selector
    location.js     — Geolocation wrapper
    compass.js      — DeviceOrientation + iOS permission gate
    camera.js       — getUserMedia rear camera
    sw-register.js  — Service worker registration
sw.js               — Service worker (offline cache)
manifest.json       — PWA manifest
icons/              — App icons (add your own)
```

## License

MIT
