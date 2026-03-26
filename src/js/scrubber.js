// Renders the sun arc as a scrubber — drag the sun dot to change time

export class Scrubber {
  constructor(canvas, handle, state, sun, onChange) {
    this.canvas = canvas;
    this.handle = handle;
    this.state = state;
    this.sun = sun;
    this.onChange = onChange;
    this.isDragging = false;
    this._setupInteraction();
    this.redraw();
  }

  redraw() {
    if (!this.state.lat) return;
    const { canvas, state, sun } = this;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.roundRect(0, 0, W, H, 4);
    ctx.fill();

    // Get full day arc
    const arc = sun.getDayArc(state.lat, state.lng, state.selectedDate, 10);
    const times = sun.getTimes(state.lat, state.lng, state.selectedDate);

    // Golden hour bands
    this._drawGoldenBand(ctx, W, H, times.goldenHour, times.goldenHourEnd);
    this._drawGoldenBand(ctx, W, H, times.goldenHourDusk, times.sunsetStart);

    // Blue hour bands
    this._drawBlueBand(ctx, W, H, times.nauticalDusk, times.night);
    this._drawBlueBand(ctx, W, H, times.nightEnd, times.nauticalDawn);

    // Noon marker
    const noonX = (12 / 24) * W;
    ctx.beginPath();
    ctx.moveTo(noonX, 0); ctx.lineTo(noonX, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sun altitude curve
    ctx.beginPath();
    let started = false;
    arc.forEach(pt => {
      const x = (pt.hour / 24) * W;
      const altClamped = Math.max(0, Math.min(90, pt.altitudeDeg));
      const y = H - (altClamped / 90) * (H - 4) - 2;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(245,166,35,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sunrise/sunset ticks
    [times.sunrise, times.sunset].forEach(t => {
      if (!t || isNaN(t)) return;
      const h = t.getHours() + t.getMinutes() / 60;
      const x = (h / 24) * W;
      ctx.beginPath();
      ctx.moveTo(x, H - 12); ctx.lineTo(x, H);
      ctx.strokeStyle = 'rgba(245,166,35,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Hour labels
    ctx.fillStyle = 'rgba(232,228,217,0.3)';
    ctx.font = '9px Syne Mono, monospace';
    ctx.textAlign = 'center';
    [6, 12, 18].forEach(h => {
      ctx.fillText(`${h}h`, (h / 24) * W, H - 2);
    });

    // Position handle
    const handleX = (state.selectedHour / 24) * W;
    this.handle.style.left = handleX + 'px';
  }

  _drawGoldenBand(ctx, W, H, start, end) {
    if (!start || !end || isNaN(start) || isNaN(end)) return;
    const x1 = ((start.getHours() + start.getMinutes()/60) / 24) * W;
    const x2 = ((end.getHours() + end.getMinutes()/60) / 24) * W;
    ctx.fillStyle = 'rgba(245,166,35,0.12)';
    ctx.fillRect(Math.min(x1,x2), 0, Math.abs(x2-x1), H);
  }

  _drawBlueBand(ctx, W, H, start, end) {
    if (!start || !end || isNaN(start) || isNaN(end)) return;
    const x1 = ((start.getHours() + start.getMinutes()/60) / 24) * W;
    const x2 = ((end.getHours() + end.getMinutes()/60) / 24) * W;
    ctx.fillStyle = 'rgba(79,195,247,0.08)';
    ctx.fillRect(Math.min(x1,x2), 0, Math.abs(x2-x1), H);
  }

  _xToHour(x) {
    const W = this.canvas.offsetWidth;
    return Math.max(0, Math.min(24, (x / W) * 24));
  }

  _setupInteraction() {
    const el = this.canvas.parentElement; // scrubber container

    const start = (x) => {
      this.isDragging = true;
      this._update(x);
    };
    const move = (x) => {
      if (!this.isDragging) return;
      this._update(x);
    };
    const end = () => { this.isDragging = false; };

    const relX = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return e.clientX - rect.left;
    };
    const relXTouch = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return e.touches[0].clientX - rect.left;
    };

    el.addEventListener('mousedown', e => start(relX(e)));
    window.addEventListener('mousemove', e => move(relX(e)));
    window.addEventListener('mouseup', end);

    el.addEventListener('touchstart', e => start(relXTouch(e)), { passive: true });
    window.addEventListener('touchmove', e => { if (this.isDragging) { e.preventDefault(); move(relXTouch(e)); } }, { passive: false });
    window.addEventListener('touchend', end);
  }

  _update(x) {
    const hour = this._xToHour(x);
    this.state.selectedHour = hour;
    const W = this.canvas.offsetWidth;
    this.handle.style.left = (x) + 'px';
    this.onChange(hour);
  }
}
