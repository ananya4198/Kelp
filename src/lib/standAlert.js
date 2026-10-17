/** Opens the independent stand-alert popup window, regardless of whether the main window is visible. */
export function showStandAlert() {
  window.electron?.standAlert?.show()
}
