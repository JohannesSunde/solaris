// Renders sun position, arc, and golden hour info over the camera feed

export class ARRenderer {
  constructor(canvas, state, sun) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.sun = sun;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 58; // tab bar
  }

  render() {
    if (!this.state.lat) return;
    const { ctx, canvas, state, sun } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const now = new Date();
    const sp = sun.getPosition(state.lat, state.lng, now);
    if (!sp.isAboveHorizon) {
      this._drawNightMessage(ctx, W, H);
      return;
    }

    // Convert sun position to screen coords
    const screenPos = this._sunToScreen(sp, W, H);
    const isOnScreen = screenPos !== null;

    if (isOnScreen) {
      this._drawSunHalo(ctx, screenPos.x, screenPos.y);
      this._drawSunDisk(ctx, screenPos.x, screenPos.y);
    } else {
      this._drawOffScreenIndicator(ctx, sp, W, H);
    }

    // Horizon arc showing sun path
    this._drawHorizonArc(ctx, sp, W, H, now);

    // Crosshair reticle
    this._drawReticle(ctx, W, H);
  }

  // Map sun azimuth + altitude to canvas XY using device heading + tilt + FOV
  _sunToScreen(sp, W, H) {
    const { heading, deviceTilt, fovH, fovCalOffset } = this.state;
    const fovV = fovH * (H / W); // approximate vertical FOV

    let azDiff = sp.azimuthDeg - (heading + fovCalOffset);
    // Normalise to -180..180
    while (azDiff > 180) azDiff -= 360;
    while (azDiff < -180) azDiff += 360;

    const altDiff = sp.altitudeDeg - deviceTilt;

    const xFrac = 0.5 + azDiff / fovH;
    const yFrac = 0.5 - altDiff / fovV;

    if (xFrac < -0.1 || xFrac > 1.1 || yFrac < -0.1 || yFrac > 1.1) return null;
    return { x: xFrac * W, y: yFrac * H };
  }

  _drawSunDisk(ctx, x, y) {
    const r = 22;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, '#fff9e6');
    grd.addColorStop(0.4, '#f5a623');
    grd.addColorStop(1, 'rgba(245,166,35,0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }

  _drawSunHalo(ctx, x, y) {
    // Pulsing glow ring
    const t = Date.now() / 1000;
    const pulse = 1 + 0.15 * Math.sin(t * 2);
    const r = 40 * pulse;
    const grd = ctx.createRadialGradient(x, y, 20, x, y, r);
    grd.addColorStop(0, 'rgba(245,166,35,0.25)');
    grd.addColorStop(1, 'rgba(245,166,35,0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }

  _drawOffScreenIndicator(ctx, sp, W, H) {
    // Arrow pointing toward sun when off screen
    const { heading, fovCalOffset } = this.state;
    let azDiff = sp.azimuthDeg - (heading + fovCalOffset);
    while (azDiff > 180) azDiff -= 360;
    while (azDiff < -180) azDiff += 360;

    const angle = azDiff * Math.PI / 180;
    const margin = 40;
    const cx = W / 2, cy = H / 2;

    // Clamp to screen edge
    const len = Math.min(cx, cy) - margin;
    const ex = cx + Math.sin(angle) * len;
    const ey = cy - Math.cos(angle) * len;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,166,35,0.8)';
    ctx.fill();

    ctx.font = '600 11px Syne Mono, monospace';
    ctx.fillStyle = 'rgba(245,166,35,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.abs(azDiff).toFixed(0)}°`, 0, 26);
    ctx.restore();
  }

  _drawHorizonArc(ctx, sp, W, H, now) {
    // Draw a thin arc at horizon level showing sun path direction
    const horizonY = H * (0.5 + (this.state.deviceTilt || 0) / (this.state.fovH * H / W));
    const y = Math.max(H * 0.3, Math.min(H * 0.8, horizonY));

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small tick at sun azimuth
    const { heading } = this.state;
    let azDiff = sp.azimuthDeg - heading;
    while (azDiff > 180) azDiff -= 360;
    while (azDiff < -180) azDiff += 360;
    const tx = W/2 + (azDiff / this.state.fovH) * W;
    if (tx > 0 && tx < W) {
      ctx.beginPath();
      ctx.moveTo(tx, y - 10);
      ctx.lineTo(tx, y + 10);
      ctx.strokeStyle = 'rgba(245,166,35,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  _drawReticle(ctx, W, H) {
    const cx = W / 2, cy = H / 2;
    const r = 30;
    ctx.strokeStyle = 'rgba(232,228,217,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair lines
    [[cx - r - 12, cy, cx - r + 2, cy],
     [cx + r - 2, cy, cx + r + 12, cy],
     [cx, cy - r - 12, cx, cy - r + 2],
     [cx, cy + r - 2, cx, cy + r + 12]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
  }

  _drawNightMessage(ctx, W, H) {
    ctx.fillStyle = 'rgba(232,228,217,0.3)';
    ctx.font = '700 16px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sun below horizon', W/2, H/2);
    ctx.font = '400 13px Syne Mono, monospace';
    ctx.fillStyle = 'rgba(232,228,217,0.2)';
    ctx.fillText('Switch to Plan view to explore times', W/2, H/2 + 28);
  }
}
