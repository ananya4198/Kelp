import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createDetectors() {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const face = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
  const hands = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL },
    runningMode: 'VIDEO',
    numHands: 2,
  });
  return { face, hands };
}

const FINGERTIPS = [4, 8, 12, 16, 20];
const CLOSE_RATIO = 0.3; // fingertip-to-mouth distance as a fraction of face width

export function analyze(detectors, video) {
  const t = performance.now();
  const f = detectors.face.detectForVideo(video, t);
  const h = detectors.hands.detectForVideo(video, t);

  const face = f.faceLandmarks[0];
  if (!face) return { facePresent: false, handToMouth: false };

  const W = video.videoWidth;
  const H = video.videoHeight;
  const mouth = {
    x: ((face[13].x + face[14].x) / 2) * W,
    y: ((face[13].y + face[14].y) / 2) * H,
  };
  const faceWidth = Math.hypot((face[234].x - face[454].x) * W, (face[234].y - face[454].y) * H);

  let handToMouth = false;
  for (const hand of h.landmarks) {
    for (const i of FINGERTIPS) {
      const d = Math.hypot(hand[i].x * W - mouth.x, hand[i].y * H - mouth.y) / faceWidth;
      if (d < CLOSE_RATIO) handToMouth = true;
    }
  }
  return { facePresent: true, handToMouth };
}