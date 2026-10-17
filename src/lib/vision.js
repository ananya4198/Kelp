import { FilesetResolver } from '@mediapipe/tasks-vision'

// Keep the wasm version in sync with the installed @mediapipe/tasks-vision.
// All detectors share this so only one copy of the MediaPipe runtime loads.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'

let filesetPromise = null

export function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_URL).catch((err) => {
      filesetPromise = null
      throw err
    })
  }
  return filesetPromise
}
