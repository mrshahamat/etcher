/*
 * Copyright 2016 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const {
  app,
  BrowserWindow,
  ipcMain
} = require('electron')
const path = require('path')
const _ = require('lodash')
const { autoUpdater } = require('electron-updater')
const Bluebird = require('bluebird')
const EXIT_CODES = require('../shared/exit-codes')
const buildWindowMenu = require('./menu')
const settings = require('./app/models/settings')
const analytics = require('./app/modules/analytics')
const { getConfig } = require('../shared/utils')
/* eslint-disable lodash/prefer-lodash-method,no-magic-numbers */

const config = settings.getDefaults()

// Enable / disable hardware acceleration
if (!config.enableHwAcceleration) {
  app.disableHardwareAcceleration()
}

const configUrl = settings.get('configUrl') || 'https://balena.io/etcher/static/config.json'

/**
 *
 * @param {Number} interval - interval to wait to check for updates
 * @example checkForUpdates()
 */
const checkForUpdates = async (interval) => {
  // We use a while loop instead of a setInterval to preserve
  // async execution time between each function call
  while (true) {
    try {
      const release = await autoUpdater.checkForUpdates()
      if (release.updateInfo.stagingPercentage) {
        await autoUpdater.downloadUpdate()
      }
    } catch (err) {
      analytics.logException(err)
    }
    await Bluebird.delay(interval)
  }
}

/**
 * @summary Create Etcher's main window
 * @example
 * app.on('ready', createMainWindow)
 */
const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: parseInt(config.width, 10) || 800,
    height: parseInt(config.height, 10) || 480,
    frame: Boolean(config.frame),
    title: config.title,
    show: false,
    resizable: Boolean(config.fullscreen),
    maximizable: false,
    fullscreen: Boolean(config.fullscreen),
    fullscreenable: Boolean(config.fullscreen),
    kiosk: Boolean(config.fullscreen),
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    darkTheme: true,
    webPreferences: {
      backgroundThrottling: false
    }
  })

  buildWindowMenu(mainWindow)

  // Prevent flash of white when starting the application
  mainWindow.on('ready-to-show', () => {
    console.timeEnd('ready-to-show')
    mainWindow.show()
  })

  // Prevent external resources from being loaded (like images)
  // when dropping them on the WebView.
  // See https://github.com/electron/electron/issues/5919
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  const dir = __dirname.split(path.sep).pop()

  if (dir === 'generated') {
    mainWindow.loadURL(`file://${path.join(__dirname, '..', 'lib', 'gui', 'app', 'index.html')}`)
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, 'app', 'index.html')}`)
  }

  const page = mainWindow.webContents

  page.once('did-frame-finish-load', async () => {
    autoUpdater.on('error', (err) => {
      analytics.logException(err)
    })
    if (settings.get('updatesEnabled')) {
      try {
        const onlineConfig = await getConfig(configUrl)
        const autoUpdaterConfig = _.get(onlineConfig, [ 'autoUpdates', 'autoUpdaterConfig' ], {
          autoDownload: false
        })
        _.merge(autoUpdater, autoUpdaterConfig)
        // eslint-disable-next-line no-magic-numbers
        const checkForUpdatesTimer = _.get(onlineConfig, [ 'autoUpdates', 'checkForUpdatesTimer' ], 300000)
        checkForUpdates(checkForUpdatesTimer)
      } catch (err) {
        analytics.logException(err)
      }
    }
  })
}

settings.load().then((localSettings) => {
  Object.assign(config, localSettings)
}).catch((error) => {
  // TODO: What do if loading the config fails?
  console.error('Error loading settings:')
  console.error(error)
}).finally(() => {
  // Enable touch events if your device supports them
  if (config.touch) {
    app.commandLine.appendSwitch('--touch-devices')
  }

  // Simulate touch events - might be useful for touchscreen with partial driver support
  if (config.touchSimulate) {
    app.commandLine.appendSwitch('--simulate-touch-screen-with-mouse')
  }

  // Listen for a 'resin-update-lock' to either enable, disable or check
  // the update lock from the renderer process (i.e. the app)
  if (config.resinUpdateLock) {
    const lockFile = require('lockfile')
    ipcMain.on('resin-update-lock', (event, command) => {
      switch (command) {
        case 'lock':
          lockFile.lock('/tmp/resin/resin-updates.lock', (error) => {
            event.sender.send('resin-update-lock', error)
          })
          break
        case 'unlock':
          lockFile.unlock('/tmp/resin/resin-updates.lock', (error) => {
            event.sender.send('resin-update-lock', error)
          })
          break
        case 'check':
          lockFile.check('/tmp/resin/resin-updates.lock', (error, isLocked) => {
            event.sender.send('resin-update-lock', error, isLocked)
          })
          break
        default:
          event.sender.send('resin-update-lock', new Error(`Unknown command "${command}"`))
          break
      }
    })
  }

  app.on('window-all-closed', app.quit)

  // Sending a `SIGINT` (e.g: Ctrl-C) to an Electron app that registers
  // a `beforeunload` window event handler results in a disconnected white
  // browser window in GNU/Linux and macOS.
  // The `before-quit` Electron event is triggered in `SIGINT`, so we can
  // make use of it to ensure the browser window is completely destroyed.
  // See https://github.com/electron/electron/issues/5273
  app.on('before-quit', () => {
    process.exit(EXIT_CODES.SUCCESS)
  })

  if (app.isReady()) {
    createMainWindow()
  } else {
    app.on('ready', createMainWindow)
  }
})

console.time('ready-to-show')
