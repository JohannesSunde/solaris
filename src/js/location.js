// location.js
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('No geolocation')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000,
    });
  });
}

export function watchLocation(callback) {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(callback, null, {
    enableHighAccuracy: true, maximumAge: 5000,
  });
}
