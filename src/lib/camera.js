export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream, videoEl) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (videoEl) videoEl.srcObject = null;
}