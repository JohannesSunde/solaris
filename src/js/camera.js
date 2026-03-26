// camera.js — starts the rear camera feed

export async function startCamera(videoEl) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
  } catch (e) {
    console.warn('Camera unavailable:', e);
    // Non-fatal — AR view degrades gracefully (black background)
  }
}
