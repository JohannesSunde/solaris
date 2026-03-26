import { requestLocation, watchLocation } from './location.js';
import { startCompass } from './compass.js';
import { startCamera } from './camera.js';
import { ARRenderer } from './ar-renderer.js';
import { MapRenderer } from './map-renderer.js';
import { SunEngine } from './sun-engine.js';
import { BuildingFetcher } from './buildings.js';
import { Scrubber } from './scrubber.js';
import { registerSW } from './sw-register.js';

registerSW();

// ── State ────────────────────────────────────────────────
export const state = {
  lat: null,
  lng: null,
  heading: 0,        // degrees from north
  deviceTilt: 0,     // pitch in degrees
  fovH: 72,          // horizontal FOV in degrees (default, calibratable)
  fovCalOffset: 0,   // calibration offset
  selectedDate: new Date(),
  selectedHour: new Date().getHours() + new Date().getMinutes() / 60,
  buildings: [],
  activeTab: 'ar',
};

// ── Boot ─────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', async () => {
  try {
    const pos = await requestLocation();
    state.lat = pos.coords.latitude;
    state.lng = pos.coords.longitude;

    document.getElementById('splash').style.opacity = '0';
    document.getElementById('splash').style.transition = 'opacity 0.4s';
    setTimeout(() => {
      document.getElementById('splash').classList.add('hidden');
      document.getElementById('main').classList.remove('hidden');
    }, 400);

    await init();
  } catch (e) {
    alert('Location access is required. Please enable it and refresh.');
  }
});

async function init() {
  const sun = new SunEngine();
  const buildings = new BuildingFetcher();
  const arRenderer = new ARRenderer(document.getElementById('ar-canvas'), state, sun);
  const mapRenderer = new MapRenderer(document.getElementById('map-canvas'), state, sun);
  const scrubber = new Scrubber(
    document.getElementById('scrubber-canvas'),
    document.getElementById('scrubber-handle'),
    state, sun,
    (hour) => {
      state.selectedHour = hour;
      updateHUD(sun);
      mapRenderer.render();
    }
  );

  // Date picker
  const datePicker = document.getElementById('date-picker');
  const today = new Date();
  datePicker.value = today.toISOString().split('T')[0];
  datePicker.addEventListener('change', () => {
    state.selectedDate = new Date(datePicker.value + 'T12:00:00');
    scrubber.redraw();
    mapRenderer.render();
    updateHUD(sun);
  });

  // Quick date buttons
  document.querySelectorAll('.qd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const offset = btn.dataset.offset;
      const special = btn.dataset.special;
      const year = today.getFullYear();
      let d;
      if (offset !== undefined) {
        d = new Date(); d.setDate(d.getDate() + parseInt(offset));
      } else if (special === 'summer') {
        d = new Date(year, 5, 21); // ~solstice
      } else if (special === 'winter') {
        d = new Date(year, 11, 21);
      } else if (special === 'equinox') {
        d = new Date(year, 2, 20);
      }
      state.selectedDate = d;
      datePicker.value = d.toISOString().split('T')[0];
      document.querySelectorAll('.qd-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scrubber.redraw();
      mapRenderer.render();
      updateHUD(sun);
    });
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      state.activeTab = target;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(`tab-${target}`).classList.remove('hidden');
      if (target === 'map') {
        mapRenderer.resize();
        mapRenderer.render();
        scrubber.redraw();
      }
    });
  });

  // Calibration
  document.getElementById('btn-calibrate').addEventListener('click', () => {
    document.getElementById('calibration-overlay').classList.remove('hidden');
  });
  document.getElementById('btn-cal-cancel').addEventListener('click', () => {
    document.getElementById('calibration-overlay').classList.add('hidden');
  });
  document.getElementById('calibration-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('calibration-overlay') ||
        e.target.id === 'cal-crosshair') {
      // User tapped the sun location — record offset
      const sp = sun.getPosition(state.lat, state.lng, state.selectedDate);
      state.fovCalOffset = sp.azimuth - state.heading;
      document.getElementById('calibration-overlay').classList.add('hidden');
    }
  });

  // Location watch
  watchLocation((pos) => {
    const prevLat = state.lat;
    const prevLng = state.lng;
    state.lat = pos.coords.latitude;
    state.lng = pos.coords.longitude;

    // Fetch buildings if moved significantly
    const dist = haversineDist(prevLat, prevLng, state.lat, state.lng);
    if (dist > 50) {
      fetchAndRender(buildings, sun, mapRenderer);
    }
  });

  // Compass
  startCompass((heading, tilt) => {
    state.heading = heading;
    state.deviceTilt = tilt;
    updateHUD(sun);
  });

  // Camera
  await startCamera(document.getElementById('camera-feed'));

  // Initial building fetch
  await fetchAndRender(buildings, sun, mapRenderer);

  // AR render loop
  function arLoop() {
    if (state.activeTab === 'ar') {
      arRenderer.render();
    }
    requestAnimationFrame(arLoop);
  }
  arLoop();

  // Initial HUD
  updateHUD(sun);

  // Clock tick
  setInterval(() => {
    if (!scrubber.isDragging) {
      state.selectedHour = new Date().getHours() + new Date().getMinutes() / 60;
      updateHUD(sun);
      scrubber.redraw();
    }
    updateHUD(sun);
  }, 30000);
}

async function fetchAndRender(buildings, sun, mapRenderer) {
  if (!state.lat) return;
  const sp = sun.getPosition(state.lat, state.lng, state.selectedDate);
  const fetched = await buildings.fetch(state.lat, state.lng, sp.azimuthDeg, sp.altitudeDeg);
  state.buildings = fetched;
  mapRenderer.render();
}

function updateHUD(sun) {
  if (!state.lat) return;
  const d = getSelectedDatetime();
  const sp = sun.getPosition(state.lat, state.lng, d);
  const times = sun.getTimes(state.lat, state.lng, state.selectedDate);

  document.getElementById('hud-time').textContent = formatTime(d);
  document.getElementById('hud-sun-pos').textContent =
    `↑${sp.altitudeDeg.toFixed(1)}°  →${sp.azimuthDeg.toFixed(0)}°`;

  const golden = times.goldenHourEnd > new Date()
    ? `Golden: ${formatTime(times.goldenHour)}`
    : times.goldenHourDusk > new Date()
    ? `Golden: ${formatTime(times.goldenHourDusk)}`
    : 'Golden hour passed';
  document.getElementById('hud-golden').textContent = golden;

  // Map info chips
  const shadowLen = sp.altitudeDeg > 1
    ? Math.min(9999, Math.round(3.5 / Math.tan(sp.altitude))).toFixed(0) + 'm'
    : '∞';
  document.getElementById('info-altitude').textContent = `Alt: ${sp.altitudeDeg.toFixed(1)}°`;
  document.getElementById('info-azimuth').textContent  = `Az: ${sp.azimuthDeg.toFixed(0)}°`;
  document.getElementById('info-shadow').textContent   = `Shadow/floor: ${shadowLen}`;
  document.getElementById('time-label').textContent = formatHour(state.selectedHour);
}

export function getSelectedDatetime() {
  const d = new Date(state.selectedDate);
  const h = Math.floor(state.selectedHour);
  const m = Math.round((state.selectedHour - h) * 60);
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatHour(h) {
  const hh = Math.floor(h);
  const mm = String(Math.round((h - hh) * 60)).padStart(2, '0');
  return `${String(hh).padStart(2,'0')}:${mm}`;
}
function haversineDist(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lat2) return 999;
  const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
