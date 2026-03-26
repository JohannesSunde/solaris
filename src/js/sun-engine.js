// Wraps SunCalc (loaded via CDN) with convenient helpers

export class SunEngine {
  getPosition(lat, lng, date) {
    const pos = SunCalc.getPosition(date, lat, lng);
    const altitudeDeg = pos.altitude * (180 / Math.PI);
    // SunCalc azimuth: 0=south, +west. Convert to compass: 0=north, clockwise
    const azimuthDeg = ((pos.azimuth * (180 / Math.PI)) + 180) % 360;
    return {
      altitude: pos.altitude,
      altitudeDeg,
      azimuth: pos.azimuth,
      azimuthDeg,
      isAboveHorizon: pos.altitude > 0,
    };
  }

  getTimes(lat, lng, date) {
    return SunCalc.getTimes(date, lat, lng);
  }

  // Returns array of {hour, azimuthDeg, altitudeDeg} for full day, step=5min
  getDayArc(lat, lng, date, stepMinutes = 5) {
    const points = [];
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    for (let m = 0; m < 1440; m += stepMinutes) {
      const t = new Date(d.getTime() + m * 60000);
      const pos = this.getPosition(lat, lng, t);
      points.push({
        hour: m / 60,
        azimuthDeg: pos.azimuthDeg,
        altitudeDeg: pos.altitudeDeg,
        isAboveHorizon: pos.isAboveHorizon,
      });
    }
    return points;
  }

  // Get the dynamic fetch wedge parameters for building queries
  getWedge(lat, lng, date, referenceHeightM = 10) {
    const sp = this.getPosition(lat, lng, date);
    const altRad = Math.max(sp.altitude, 0.05); // avoid div by zero
    const altDeg = sp.altitudeDeg;

    const shadowLength = Math.min(600, referenceHeightM / Math.tan(altRad));
    const coneAngleDeg = Math.max(30, 90 - altDeg); // wider at low sun
    const innerRadius = 80; // always full circle this close

    return {
      azimuthDeg: sp.azimuthDeg,
      shadowLength,
      coneAngleDeg,
      innerRadius,
      altitudeDeg: altDeg,
    };
  }

  // Shadow vector: given sun azimuth, shadow falls OPPOSITE direction
  shadowAzimuth(sunAzimuthDeg) {
    return (sunAzimuthDeg + 180) % 360;
  }

  // Shadow length multiplier for a given height
  shadowLength(heightM, altitudeDeg) {
    if (altitudeDeg <= 0) return Infinity;
    return heightM / Math.tan(altitudeDeg * Math.PI / 180);
  }
}
