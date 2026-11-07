import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'
import { buildDevServerUrl } from './helpers/dev-server-url'
import { setupTrpcHandler } from './trpc-handler'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

try {
  setupTrpcHandler()
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const devServerUrl = buildDevServerUrl(process.argv[2])

    await mainWindow.loadURL(devServerUrl.toString())
    mainWindow.webContents.openDevTools()
  }
} catch (error) {
  console.error('Failed to start Greenlight:', error)
  app.quit()
}
