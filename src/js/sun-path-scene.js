const HOUR_MARKERS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function drawSunPathScene(ctx, width, height, state, sun, options = {}) {
  if (!state.lat) return;

  const palette = {
    bgTop: '#0f1219',
    bgBottom: '#06070b',
    grid: 'rgba(255,255,255,0.08)',
    gridSoft: 'rgba(255,255,255,0.03)',
    horizon: 'rgba(255,255,255,0.14)',
    pathGlow: 'rgba(247,183,51,0.18)',
    path: '#f7b733',
    pathHot: '#ff7d2f',
    label: 'rgba(255,245,223,0.82)',
    labelSoft: 'rgba(255,245,223,0.42)',
    center: '#7cc8ff',
    sun: '#ffe3a0',
    sunGlow: 'rgba(247,183,51,0.22)',
    horizonArc: 'rgba(247,183,51,0.42)',
    shadowRay: 'rgba(247,183,51,0.22)',
  };
  const merged = { ...palette, ...(options.palette || {}) };

  const scene = getSceneGeometry(width, height, options.compact ? 0.78 : 1);
  if (options.background !== false) {
    drawBackground(ctx, width, height, merged, options.transparentBackground === true);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const dayArc = sun.getDayArc(state.lat, state.lng, state.selectedDate, 10);
  const current = sun.getPosition(state.lat, state.lng, getSelectedDatetime(state));
  const visible = dayArc.filter((point) => point.altitudeDeg >= 0);

  drawGroundGrid(ctx, scene, merged);
  drawCompass(ctx, scene, merged, options.showCompass !== false);
  drawHorizon(ctx, scene, merged);
  drawPath(ctx, scene, visible, merged, options.showLabels !== false);
  drawCurrentSun(ctx, scene, current, merged);
}

function getSceneGeometry(width, height, scaleBias) {
  const centerX = width * 0.5;
  const centerY = height * (0.74 - (1 - scaleBias) * 0.08);
  const domeRadius = Math.min(width, height) * 0.29 * scaleBias;
  return {
    width,
    height,
    centerX,
    centerY,
    domeRadius,
    viewYaw: -38 * Math.PI / 180,
    viewPitch: 1.03,
    perspective: 2.6,
  };
}

function drawBackground(ctx, width, height, palette, transparent) {
  ctx.clearRect(0, 0, width, height);
  if (transparent) return;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.55, height * 0.1, 0, width * 0.55, height * 0.1, width * 0.5);
  glow.addColorStop(0, 'rgba(247,183,51,0.10)');
  glow.addColorStop(1, 'rgba(247,183,51,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawGroundGrid(ctx, scene, palette) {
  const rings = [0.45, 0.7, 1];
  rings.forEach((radiusFactor, index) => {
    drawWorldCircle(ctx, scene, radiusFactor, index === rings.length - 1 ? palette.horizon : palette.gridSoft, index === rings.length - 1 ? 1.4 : 1);
  });

  [-90, -45, 0, 45, 90, 135].forEach((deg) => {
    const rad = deg * Math.PI / 180;
    const p1 = projectWorld(scene, { x: Math.sin(rad), y: 0, z: -Math.cos(rad) });
    const p2 = projectWorld(scene, { x: -Math.sin(rad), y: 0, z: Math.cos(rad) });
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = palette.gridSoft;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawCompass(ctx, scene, palette, showCompass) {
  if (!showCompass) return;
  [
    { label: 'N', az: 0 },
    { label: 'E', az: 90 },
    { label: 'S', az: 180 },
    { label: 'W', az: 270 },
  ].forEach((entry) => {
    const p = projectAzAlt(scene, entry.az, 0, 1.07);
    ctx.fillStyle = palette.labelSoft;
    ctx.font = '11px Syne Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(entry.label, p.x, p.y + 4);
  });

  const center = projectWorld(scene, { x: 0, y: 0, z: 0 });
  ctx.beginPath();
  ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = palette.center;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(center.x, center.y, 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(124,200,255,0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHorizon(ctx, scene, palette) {
  ctx.beginPath();
  for (let deg = 0; deg <= 360; deg += 4) {
    const p = projectAzAlt(scene, deg, 0, 1);
    if (deg === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = palette.horizonArc;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawPath(ctx, scene, points, palette, showLabels) {
  if (!points.length) return;

  ctx.beginPath();
  points.forEach((point, index) => {
    const projected = projectAzAlt(scene, point.azimuthDeg, point.altitudeDeg, 1);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.strokeStyle = palette.pathGlow;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  points.forEach((point, index) => {
    const projected = projectAzAlt(scene, point.azimuthDeg, point.altitudeDeg, 1);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  const gradient = ctx.createLinearGradient(0, scene.centerY - scene.domeRadius, 0, scene.centerY + 20);
  gradient.addColorStop(0, '#ffe07f');
  gradient.addColorStop(0.55, palette.path);
  gradient.addColorStop(1, palette.pathHot);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (!showLabels) return;

  HOUR_MARKERS.forEach((hour) => {
    const point = points.reduce((closest, candidate) => {
      if (Math.abs(candidate.hour - hour) < Math.abs(closest.hour - hour)) return candidate;
      return closest;
    }, points[0]);
    if (point.altitudeDeg < 0) return;

    const projected = projectAzAlt(scene, point.azimuthDeg, point.altitudeDeg, 1);
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = hour <= 7 || hour >= 17 ? palette.pathHot : palette.path;
    ctx.fill();
    ctx.fillStyle = palette.label;
    ctx.font = '11px Syne Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${hour}h`, projected.x + 10, projected.y + 4);
  });
}

function drawCurrentSun(ctx, scene, current, palette) {
  const sunPoint = projectAzAlt(scene, current.azimuthDeg, Math.max(0, current.altitudeDeg), 1);
  const groundPoint = projectAzAlt(scene, current.azimuthDeg, 0, 1);
  const center = projectWorld(scene, { x: 0, y: 0, z: 0 });

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(groundPoint.x, groundPoint.y);
  ctx.strokeStyle = palette.shadowRay;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sunPoint.x, sunPoint.y);
  ctx.lineTo(groundPoint.x, groundPoint.y);
  ctx.strokeStyle = palette.pathHot;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const glow = ctx.createRadialGradient(sunPoint.x, sunPoint.y, 0, sunPoint.x, sunPoint.y, 28);
  glow.addColorStop(0, 'rgba(255,227,160,0.95)');
  glow.addColorStop(0.42, palette.sunGlow);
  glow.addColorStop(1, 'rgba(247,183,51,0)');
  ctx.beginPath();
  ctx.arc(sunPoint.x, sunPoint.y, 28, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sunPoint.x, sunPoint.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = palette.sun;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sunPoint.x, sunPoint.y, 15, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,227,160,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawWorldCircle(ctx, scene, radius, strokeStyle, lineWidth) {
  ctx.beginPath();
  for (let deg = 0; deg <= 360; deg += 4) {
    const rad = deg * Math.PI / 180;
    const point = projectWorld(scene, {
      x: Math.sin(rad) * radius,
      y: 0,
      z: -Math.cos(rad) * radius,
    });
    if (deg === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function projectAzAlt(scene, azimuthDeg, altitudeDeg, radius) {
  const az = azimuthDeg * Math.PI / 180;
  const alt = altitudeDeg * Math.PI / 180;
  return projectWorld(scene, {
    x: Math.sin(az) * Math.cos(alt) * radius,
    y: Math.sin(alt) * radius,
    z: -Math.cos(az) * Math.cos(alt) * radius,
  });
}

function projectWorld(scene, point) {
  const yawCos = Math.cos(scene.viewYaw);
  const yawSin = Math.sin(scene.viewYaw);
  const x1 = point.x * yawCos - point.z * yawSin;
  const z1 = point.x * yawSin + point.z * yawCos;

  const pitchCos = Math.cos(scene.viewPitch);
  const pitchSin = Math.sin(scene.viewPitch);
  const y2 = point.y * pitchCos - z1 * pitchSin;
  const z2 = point.y * pitchSin + z1 * pitchCos;

  const perspective = scene.perspective / (scene.perspective + z2 + 1.2);
  return {
    x: scene.centerX + x1 * scene.domeRadius * perspective,
    y: scene.centerY - y2 * scene.domeRadius * perspective,
  };
}

function getSelectedDatetime(state) {
  const date = new Date(state.selectedDate);
  const hours = Math.floor(state.selectedHour);
  const minutes = Math.round((state.selectedHour - hours) * 60);
  date.setHours(hours, minutes, 0, 0);
  return date;
}
