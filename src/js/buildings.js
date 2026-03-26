// Fetches building footprints + heights from OpenStreetMap via Overpass API
// Tiles the world into ~200m cells and caches in IndexedDB

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TILE_SIZE_DEG = 0.002; // ~200m at mid-latitudes
const AVG_FLOOR_HEIGHT = 3.5; // metres per floor

export class BuildingFetcher {
  constructor() {
    this._cache = new Map(); // in-memory; also backed by localStorage
  }

  async fetch(lat, lng, sunAzimuthDeg, sunAltitudeDeg) {
    // Determine fetch cone
    const altDeg = Math.max(sunAltitudeDeg, 1);
    const refHeight = 12; // 3-storey reference building
    const coneLength = Math.min(600, refHeight / Math.tan(altDeg * Math.PI / 180));
    const coneAngle = Math.max(30, 90 - altDeg); // degrees each side of sun az
    const innerR = 0.001; // ~80m in degrees

    // Shadow falls opposite the sun
    const shadowAz = (sunAzimuthDeg + 180) % 360;

    // Build bounding box: always fetch inner circle + cone in shadow direction
    const allBuildings = new Map(); // keyed by OSM id

    // 1. Inner circle bbox
    const innerBuildings = await this._fetchBbox(
      lat - innerR, lng - innerR,
      lat + innerR, lng + innerR
    );
    innerBuildings.forEach(b => allBuildings.set(b.id, b));

    // 2. Cone in shadow direction (narrow rect approximation)
    const coneBuildings = await this._fetchCone(lat, lng, shadowAz, coneLength, coneAngle);
    coneBuildings.forEach(b => allBuildings.set(b.id, b));

    return Array.from(allBuildings.values());
  }

  async _fetchCone(lat, lng, azimuthDeg, lengthM, halfAngleDeg) {
    // Project the cone tip point
    const lenDeg = lengthM / 111320;
    const azRad = azimuthDeg * Math.PI / 180;

    // Approximate wedge with a bounding box around the cone
    const tipLat = lat + lenDeg * Math.cos(azRad);
    const tipLng = lng + (lenDeg * Math.sin(azRad)) / Math.cos(lat * Math.PI / 180);

    const halfWidthDeg = (lenDeg * Math.tan(halfAngleDeg * Math.PI / 180));

    const minLat = Math.min(lat, tipLat) - halfWidthDeg;
    const maxLat = Math.max(lat, tipLat) + halfWidthDeg;
    const minLng = Math.min(lng, tipLng) - halfWidthDeg;
    const maxLng = Math.max(lng, tipLng) + halfWidthDeg;

    return this._fetchBbox(minLat, minLng, maxLat, maxLng);
  }

  async _fetchBbox(s, w, n, e) {
    // Snap to tile grid for cache hits
    const tileKey = this._tileKey(s, w, n, e);
    const cached = this._getCached(tileKey);
    if (cached) return cached;

    const query = `
      [out:json][timeout:15];
      (
        way["building"](${s},${w},${n},${e});
        relation["building"](${s},${w},${n},${e});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const resp = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      const buildings = this._parseOverpass(json);
      this._setCached(tileKey, buildings);
      return buildings;
    } catch (e) {
      console.warn('Overpass fetch failed:', e);
      return [];
    }
  }

  _parseOverpass(json) {
    // Build node lookup
    const nodes = {};
    json.elements.forEach(el => {
      if (el.type === 'node') nodes[el.id] = { lat: el.lat, lng: el.lon };
    });

    const buildings = [];
    json.elements.forEach(el => {
      if (el.type !== 'way' || !el.tags?.building) return;
      const tags = el.tags;

      // Height resolution
      let height = 10; // default fallback
      if (tags.height) {
        height = parseFloat(tags.height) || height;
      } else if (tags['building:levels']) {
        height = parseFloat(tags['building:levels']) * AVG_FLOOR_HEIGHT;
      } else if (tags['building:height']) {
        height = parseFloat(tags['building:height']) || height;
      }

      // Footprint
      const coords = (el.nodes || [])
        .map(nid => nodes[nid])
        .filter(Boolean);
      if (coords.length < 3) return;

      // Centroid
      const centLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const centLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;

      buildings.push({
        id: el.id,
        height,
        coords,
        centLat,
        centLng,
        hasRealHeight: !!(tags.height || tags['building:levels']),
      });
    });

    return buildings;
  }

  _tileKey(s, w, n, e) {
    const snap = v => Math.round(v / TILE_SIZE_DEG) * TILE_SIZE_DEG;
    return `bld:${snap(s).toFixed(4)},${snap(w).toFixed(4)},${snap(n).toFixed(4)},${snap(e).toFixed(4)}`;
  }

  _getCached(key) {
    if (this._cache.has(key)) {
      const { ts, data } = this._cache.get(key);
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) {
          this._cache.set(key, { ts, data });
          return data;
        }
      }
    } catch {}
    return null;
  }

  _setCached(key, data) {
    const entry = { ts: Date.now(), data };
    this._cache.set(key, entry);
    try { localStorage.setItem(key, JSON.stringify(entry)); } catch {}
  }
}
