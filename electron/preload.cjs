const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  db: {
    startSession: () => ipcRenderer.invoke('db:startSession'),
    endSession: (sessionId) => ipcRenderer.invoke('db:endSession', sessionId),
    recordPostureSnapshot: (payload) => ipcRenderer.invoke('db:recordPostureSnapshot', payload),
    recordHabitEvent: (payload) => ipcRenderer.invoke('db:recordHabitEvent', payload),
    getProfile: () => ipcRenderer.invoke('db:getProfile'),
    getDailySummaries: (range) => ipcRenderer.invoke('db:getDailySummaries', range),
  },
})
