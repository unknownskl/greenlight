import { app, ipcMain } from 'electron';
import serve from 'electron-serve';
import { createWindow, Authentication } from './helpers';
import Events from './events'

const isProd: boolean = process.env.NODE_ENV === 'production';
const appEvents = new Events()
const xboxAuth = Authentication(appEvents)

if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

(async () => {
  await app.whenReady();

  let mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
  });

  if (isProd) {
    await mainWindow.loadURL('app://./home.html');
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    if(app.quitting) {
      mainWindow = null
    } else {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Check authentication
  if(! xboxAuth.checkAuthentication()){
    xboxAuth.startHooks()
    await xboxAuth.startAuthflow()
  }

  // setInterval(() => {
  //   console.log('Application is in fullscreen:', mainWindow.fullScreen)
  // }, 1000)

  app.on('activate', () => { mainWindow.show() })
})();

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => app.quitting = true)



ipcMain.on('ping-pong', (event, arg) => {
  event.sender.send('ping-pong', `[ipcMain] "${arg}" received asynchronously.`);
});

ipcMain.on('ping-pong-sync', (event, arg) => {
  event.returnValue = `[ipcMain] "${arg}" received synchronously.`;
});