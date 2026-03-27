import { drawSunPathScene } from './sun-path-scene.js';

export class MapRenderer {
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
    drawSunPathScene(this.ctx, this.canvas.width, this.canvas.height, this.state, this.sun, {
      background: true,
      compact: false,
      showCompass: true,
      showLabels: true,
    });
  }
}
