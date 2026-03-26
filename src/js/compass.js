// compass.js — handles DeviceOrientationEvent including iOS permission gate

export function startCompass(callback) {
  const handler = (e) => {
    // Prefer webkitCompassHeading (iOS) for more accurate magnetic north
    let heading = 0;
    if (e.webkitCompassHeading !== undefined) {
      heading = e.webkitCompassHeading; // 0-360, clockwise from north
    } else if (e.absolute && e.alpha !== null) {
      heading = 360 - e.alpha;
    } else if (e.alpha !== null) {
      heading = 360 - e.alpha;
    }

    // Tilt = beta (pitch), clamped
    const tilt = Math.max(-90, Math.min(90, e.beta || 0));
    callback(heading, tilt);
  };

  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // Wire up to calibrate button as it needs a user gesture
    document.getElementById('btn-calibrate').addEventListener('click', async () => {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === 'granted') window.addEventListener('deviceorientation', handler, true);
      } catch {}
    }, { once: true });
  } else {
    window.addEventListener('deviceorientation', handler, true);
  }
}
