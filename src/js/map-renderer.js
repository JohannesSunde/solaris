import { getSelectedDatetime } from './app.js';

const METERS_PER_DEG_LAT = 111320;
const YOU_COLOR   = '#4fc3f7';
const SUN_COLOR   = '#f5a623';
const SHADOW_COLOR= 'rgba(245,166,35,0.18)';
const SHADOW_STROKE='rgba(245,166,35,0.35)';
const BLDG_FILL   = 'rgba(232,228,217,0.12)';
const BLDG_STROKE = 'rgba(232,228,217,0.3)';
const BLDG_NO_DATA= 'rgba(232,228,217,0.06)';
const BG_COLOR    = '#0d0d14';
const GRID_COLOR  = 'rgba(255,255,255,0.04)';
const VIEW_RADIUS_M = 200;
const VIEW_SIZE_M = VIEW_RADIUS_M * 2;

export class MapRenderer {
  constructor(canvas, state, sun) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.sun = sun;
    this.scale = 1;
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const controls = document.getElementById('map-controls');
    const ctrlH = controls ? controls.offsetHeight : 180;
    const tabH = 58;
    this.canvas.width = parent.offsetWidth;
    this.canvas.height = window.innerHeight - ctrlH - tabH;
    this.render();
  }

  render() {
    if (!this.state.lat) return;
    const { ctx, canvas, state, sun } = this;
    const W = canvas.width, H = canvas.height;
    this.scale = Math.min(W, H) / VIEW_SIZE_M;
    ctx.clearRect(0, 0, W, H);

    const d = getSelectedDatetime();
    const sp = sun.getPosition(state.lat, state.lng, d);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Grid
    this._drawGrid(W, H);

    // Center is locked to the user position
    const cx = W / 2;
    const cy = H / 2;

    // Draw shadows first (under buildings)
    if (sp.isAboveHorizon) {
      this._drawShadows(ctx, cx, cy, sp);
    }

    // Draw buildings
    this._drawBuildings(ctx, cx, cy);

    // Sun direction ray
    this._drawSunRay(ctx, cx, cy, sp, W, H);

    // North indicator
    this._drawNorth(ctx, W, H);

    // Compass rose overlay (device heading)
    this._drawHeadingArc(ctx, cx, cy, sp);

    // User dot
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = YOU_COLOR;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(79,195,247,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scale bar
    this._drawScaleBar(ctx, W, H);
  }

  _drawGrid(W, H) {
    const { ctx } = this;
    const spacing = 50 * this.scale;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const cx = W / 2, cy = H / 2;
    for (let x = cx % spacing; x < W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = cy % spacing; y < H; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  _drawBuildings(ctx, cx, cy) {
    this.state.buildings.forEach(b => {
      const pts = b.coords.map(c => this._toCanvas(c.lat, c.lng, cx, cy));
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = b.hasRealHeight ? BLDG_FILL : BLDG_NO_DATA;
      ctx.fill();
      ctx.strokeStyle = BLDG_STROKE;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  _drawShadows(ctx, cx, cy, sp) {
    if (sp.altitudeDeg < 0.5) return;
    const shadowAzRad = ((sp.azimuthDeg + 180) % 360) * Math.PI / 180;

    this.state.buildings.forEach(b => {
      const shadowLen = this.sun.shadowLength(b.height, sp.altitudeDeg);
      if (!isFinite(shadowLen) || shadowLen > 1200) return;

      const dx = Math.sin(shadowAzRad) * shadowLen * this.scale;
      const dy = -Math.cos(shadowAzRad) * shadowLen * this.scale;

      const pts = b.coords.map(c => this._toCanvas(c.lat, c.lng, cx, cy));
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      [...pts].reverse().forEach(p => ctx.lineTo(p.x + dx, p.y + dy));
      ctx.closePath();

      ctx.fillStyle = SHADOW_COLOR;
      ctx.fill();
      ctx.strokeStyle = SHADOW_STROKE;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }

  _drawSunRay(ctx, cx, cy, sp, W, H) {
    if (!sp.isAboveHorizon) {
      ctx.fillStyle = 'rgba(232,228,217,0.3)';
      ctx.font = '700 13px Syne, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Below horizon', W / 2, 30);
      return;
    }

    const azRad = sp.azimuthDeg * Math.PI / 180;
    const len = Math.max(W, H) * 1.5;
    const dx = Math.sin(azRad);
    const dy = -Math.cos(azRad);

    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * len, cy + dy * len);
    ctx.strokeStyle = 'rgba(245,166,35,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    const edgeDist = Math.min(len, 120);
    const sx = cx + dx * edgeDist;
    const sy = cy + dy * edgeDist;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = SUN_COLOR;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,166,35,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = SUN_COLOR;
    ctx.font = '600 11px Syne Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${sp.altitudeDeg.toFixed(1)}°`, sx + 18, sy + 4);
  }

  _drawHeadingArc(ctx, cx, cy) {
    const heading = this.state.heading;
    const fov = this.state.fovH;
    const arcR = 60;
    const startAng = (heading - fov / 2 - 90) * Math.PI / 180;
    const endAng = (heading + fov / 2 - 90) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, arcR, startAng, endAng);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,195,247,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,195,247,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const hRad = (heading - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hRad) * arcR, cy + Math.sin(hRad) * arcR);
    ctx.strokeStyle = YOU_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawNorth(ctx) {
    const x = 30, y = 30;
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(5, 6); ctx.lineTo(0, 2); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,166,35,0.7)';
    ctx.fill();

    ctx.font = '700 9px Syne, sans-serif';
    ctx.fillStyle = 'rgba(232,228,217,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, 22);
    ctx.restore();
  }

  _drawScaleBar(ctx, W, H) {
    const barMetres = 100;
    const barPx = barMetres * this.scale;
    const x = W - barPx - 16, y = H - 20;

    ctx.strokeStyle = 'rgba(232,228,217,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + barPx, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barPx, y - 4); ctx.lineTo(x + barPx, y + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(232,228,217,0.5)';
    ctx.font = '10px Syne Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('100m', x + barPx / 2, y - 8);
  }

  _toCanvas(lat, lng, cx, cy) {
    const metersLat = (lat - this.state.lat) * METERS_PER_DEG_LAT;
    const metersLng = (lng - this.state.lng) * METERS_PER_DEG_LAT * Math.cos(this.state.lat * Math.PI / 180);
    return {
      x: cx + metersLng * this.scale,
      y: cy - metersLat * this.scale,
    };
  }
}
