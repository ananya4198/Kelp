const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell, ipcMain } = require('electron')
const path = require('node:path')

const devServerUrl = process.env.ELECTRON_START_URL

let mainWindow = null
let tray = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Posture Monitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep pose detection + webcam inference running when the window is
      // minimized or behind other apps, since this is meant to run in the
      // background all day, not just while focused.
      backgroundThrottling: false,
    },
  })

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Closing the window hides it instead of quitting, so monitoring keeps
  // running in the background. Use the tray menu's Quit to actually exit.
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function showWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/tray-icon.png')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('Posture Monitor')

  const buildMenu = () =>
    Menu.buildFromTemplate([
      { label: 'Open Posture Monitor', click: showWindow },
      { type: 'separator' },
      {
        label: 'Open at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        enabled: app.isPackaged,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked })
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true
          app.quit()
        },
      },
    ])

  tray.setContextMenu(buildMenu())
  tray.on('click', showWindow)
}

function registerDbHandlers() {
  const db = require('./db.cjs')

  ipcMain.handle('db:startSession', () => db.startSession())
  ipcMain.handle('db:endSession', (_event, sessionId) => db.endSession(sessionId))
  ipcMain.handle('db:recordPostureSnapshot', (_event, payload) => db.recordPostureSnapshot(payload))
  ipcMain.handle('db:recordHabitEvent', (_event, payload) => db.recordHabitEvent(payload))
  ipcMain.handle('db:getProfile', () => db.getProfile())
  ipcMain.handle('db:getDailySummaries', (_event, payload) => db.getDailySummaries(payload))
}

app.whenReady().then(() => {
  // Auto-grant camera/mic access requested via getUserMedia. The OS-level
  // camera permission prompt (macOS TCC) still happens separately and is
  // unaffected by this.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  registerDbHandlers()
  createWindow()
  createTray()

  app.on('activate', showWindow)
})

app.on('window-all-closed', () => {
  // Intentionally a no-op: the app lives in the tray until Quit is chosen.
})
