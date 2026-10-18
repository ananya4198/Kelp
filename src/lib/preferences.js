import { useSyncExternalStore } from 'react'

// Client-side preferences (saved in this browser/Electron profile only), shared
// live between the Dashboard settings card and the Live Session tab.
const STORAGE_KEY = 'preferences'
const DEFAULTS = { desktopNotifications: false, postureTolerance: 'balanced' }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set()

export function getPreferences() {
  return current
}

export function setPreference(key, value) {
  current = { ...current, [key]: value }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // storage unavailable; the change still applies until the app closes
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current preferences; re-renders the component whenever one changes. */
export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences)
}
