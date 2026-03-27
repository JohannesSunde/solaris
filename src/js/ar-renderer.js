import { drawSunPathScene } from './sun-path-scene.js';

export class ARRenderer {
  constructor(canvas, state, sun) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.sun = sun;
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  render() {
    if (!this.state.lat) return;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    drawSunPathScene(this.ctx, width, height, this.state, this.sun, {
      background: false,
      transparentBackground: true,
      compact: true,
      palette: {
        grid: 'rgba(255,255,255,0.12)',
        gridSoft: 'rgba(255,255,255,0.05)',
        horizon: 'rgba(255,255,255,0.18)',
        labelSoft: 'rgba(255,255,255,0.4)',
        label: 'rgba(255,248,232,0.82)',
      },
    });
  }
}
