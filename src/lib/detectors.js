import { FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import { getVisionFileset } from './vision';

const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createDetectors() {
  const vision = await getVisionFileset();
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
const KNUCKLES = [5, 9, 13, 17];
const TIP_CLOSE = 0.15;   // fingertip must be very close to the lips
const PALM_FAR = 0.3;     // palm must NOT be near the mouth (rules out resting on face)
const WRIST_EXTRA = 0.3;  // wrist must be clearly farther than the fingertip

export function analyze(detectors, video) {
  const t = performance.now();
  const f = detectors.face.detectForVideo(video, t);
  const h = detectors.hands.detectForVideo(video, t);

  const face = f.faceLandmarks[0];
  if (!face) return { facePresent: false, handToMouth: false };

  const W = video.videoWidth;
  const H = video.videoHeight;
  const px = (p) => ({ x: p.x * W, y: p.y * H });
  const mouth = {
    x: ((face[13].x + face[14].x) / 2) * W,
    y: ((face[13].y + face[14].y) / 2) * H,
  };
  const faceWidth = Math.hypot((face[234].x - face[454].x) * W, (face[234].y - face[454].y) * H);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / faceWidth;

  let biteLike = false;
  for (const hand of h.landmarks) {
    const tipsNear = FINGERTIPS.filter((i) => dist(px(hand[i]), mouth) < TIP_CLOSE);
    if (tipsNear.length === 0) continue;

    const palm = {
      x: KNUCKLES.reduce((s, i) => s + hand[i].x * W, 0) / KNUCKLES.length,
      y: KNUCKLES.reduce((s, i) => s + hand[i].y * H, 0) / KNUCKLES.length,
    };
    const closestTip = Math.min(...tipsNear.map((i) => dist(px(hand[i]), mouth)));
    const palmFar = dist(palm, mouth) > PALM_FAR;
    const wristFarther = dist(px(hand[0]), mouth) > closestTip + WRIST_EXTRA;

    // while tuning, uncomment to see the numbers in the browser console:
    // console.log({ tips: tipsNear.length, palmFar, wristFarther });

    // one or two fingertips only, palm away from face, hand angled toward the mouth
    if (tipsNear.length <= 2 && palmFar && wristFarther) biteLike = true;
  }
  return { facePresent: true, handToMouth: biteLike };
}