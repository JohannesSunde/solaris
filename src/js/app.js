import { requestLocation, watchLocation } from './location.js';
import { startCompass } from './compass.js';
import { startCamera } from './camera.js';
import { ARRenderer } from './ar-renderer.js';
import { MapRenderer } from './map-renderer.js';
import { SunEngine } from './sun-engine.js';
import { Scrubber } from './scrubber.js';
import { registerSW } from './sw-register.js';

registerSW();

export const state = {
  lat: null,
  lng: null,
  heading: 0,
  deviceTilt: 0,
  fovH: 72,
  fovCalOffset: 0,
  selectedDate: new Date(),
  selectedHour: new Date().getHours() + new Date().getMinutes() / 60,
  activeTab: 'camera',
};

document.getElementById('btn-start').addEventListener('click', async () => {
  try {
    const position = await requestLocation();
    state.lat = position.coords.latitude;
    state.lng = position.coords.longitude;

    document.getElementById('splash').style.opacity = '0';
    document.getElementById('splash').style.transition = 'opacity 0.4s';
    setTimeout(() => {
      document.getElementById('splash').classList.add('hidden');
      document.getElementById('main').classList.remove('hidden');
    }, 400);

    await init();
  } catch {
    alert('Location access is required. Please enable it and refresh.');
  }
});

async function init() {
  const sun = new SunEngine();
  const arRenderer = new ARRenderer(document.getElementById('ar-canvas'), state, sun);
  const mapRenderer = new MapRenderer(document.getElementById('map-canvas'), state, sun);
  const scrubber = new Scrubber(
    document.getElementById('scrubber-canvas'),
    document.getElementById('scrubber-handle'),
    state,
    sun,
    () => renderAll(arRenderer, mapRenderer, sun)
  );

  const datePicker = document.getElementById('date-picker');
  datePicker.value = formatDateInputValue(state.selectedDate);
  datePicker.addEventListener('change', () => {
    state.selectedDate = new Date(`${datePicker.value}T12:00:00`);
    scrubber.redraw();
    renderAll(arRenderer, mapRenderer, sun);
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.tab;
      if (!nextTab || nextTab === state.activeTab) return;
      state.activeTab = nextTab;

      document.querySelectorAll('.tab').forEach((node) => node.classList.toggle('active', node.dataset.tab === nextTab));
      document.getElementById('tab-camera').classList.toggle('hidden', nextTab !== 'camera');
      document.getElementById('tab-map').classList.toggle('hidden', nextTab !== 'map');
      document.getElementById('view-label').textContent = nextTab === 'camera' ? 'Camera' : 'Map';
      document.getElementById('btn-calibrate').classList.toggle('hidden', nextTab !== 'camera');
      renderAll(arRenderer, mapRenderer, sun);
    });
  });

  document.getElementById('btn-calibrate').addEventListener('click', () => {
    document.getElementById('calibration-overlay').classList.remove('hidden');
  });
  document.getElementById('btn-cal-cancel').addEventListener('click', () => {
    document.getElementById('calibration-overlay').classList.add('hidden');
  });
  document.getElementById('calibration-overlay').addEventListener('click', (event) => {
    const overlay = document.getElementById('calibration-overlay');
    if (event.target !== overlay && event.target.id !== 'cal-crosshair') return;

    const position = sun.getPosition(state.lat, state.lng, getSelectedDatetime());
    state.fovCalOffset = position.azimuthDeg - state.heading;
    overlay.classList.add('hidden');
    renderAll(arRenderer, mapRenderer, sun);
  });

  watchLocation((position) => {
    state.lat = position.coords.latitude;
    state.lng = position.coords.longitude;
    renderAll(arRenderer, mapRenderer, sun);
  });

  startCompass((heading, tilt) => {
    state.heading = heading;
    state.deviceTilt = tilt;
    renderAll(arRenderer, mapRenderer, sun);
  });

  await startCamera(document.getElementById('camera-feed'));

  const renderFrame = () => {
    if (state.activeTab === 'camera') arRenderer.render();
    requestAnimationFrame(renderFrame);
  };
  renderFrame();

  renderAll(arRenderer, mapRenderer, sun);

  setInterval(() => {
    updateHUD(sun);
    if (!scrubber.isDragging) scrubber.redraw();
  }, 30000);

  window.addEventListener('resize', () => {
    arRenderer.resize();
    mapRenderer.resize();
    scrubber.redraw();
    renderAll(arRenderer, mapRenderer, sun);
  });
}

function renderAll(arRenderer, mapRenderer, sun) {
  updateHUD(sun);
  if (state.activeTab === 'camera') arRenderer.render();
  mapRenderer.render();
}

function updateHUD(sun) {
  if (!state.lat) return;

  const selected = getSelectedDatetime();
  const position = sun.getPosition(state.lat, state.lng, selected);
  const times = sun.getTimes(state.lat, state.lng, state.selectedDate);

  document.getElementById('hud-time').textContent = formatTime(selected);
  document.getElementById('hud-sun-pos').textContent = `${position.altitudeDeg.toFixed(1)} deg / ${position.azimuthDeg.toFixed(0)} deg`;
  document.getElementById('hud-golden').textContent = buildGoldenText(selected, times);

  const shadowLength = position.altitudeDeg > 1
    ? `${Math.round(3.5 / Math.tan(position.altitude))}m shadow per floor`
    : 'Very long shadows';

  document.getElementById('info-altitude').textContent = `Altitude ${position.altitudeDeg.toFixed(1)} deg`;
  document.getElementById('info-azimuth').textContent = `Azimuth ${position.azimuthDeg.toFixed(0)} deg`;
  document.getElementById('info-shadow').textContent = shadowLength;
  document.getElementById('time-label').textContent = formatHour(state.selectedHour);
}

function buildGoldenText(selected, times) {
  if (isWithin(selected, times.goldenHour, times.goldenHourEnd)) return 'Golden hour is active';
  if (isWithin(selected, times.goldenHourDusk, times.sunsetStart)) return 'Evening golden hour is active';
  if (times.goldenHour && selected < times.goldenHour) return `Morning golden hour ${formatTime(times.goldenHour)}`;
  if (times.goldenHourDusk && selected < times.goldenHourDusk) return `Evening golden hour ${formatTime(times.goldenHourDusk)}`;
  return 'Golden hour has passed';
}

function isWithin(target, start, end) {
  return !!(start && end && target >= start && target <= end);
}

export function getSelectedDatetime() {
  const date = new Date(state.selectedDate);
  const hours = Math.floor(state.selectedHour);
  const minutes = Math.round((state.selectedHour - hours) * 60);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHour(hour) {
  const hours = Math.floor(hour);
  const minutes = String(Math.round((hour - hours) * 60)).padStart(2, '0');
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
