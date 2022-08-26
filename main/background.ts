import { app, ipcMain, session } from 'electron';
import serve from 'electron-serve';
import { createWindow, Authentication } from './helpers';
import Events from './events'
const path = require('path')
const os = require('os')

const isProd: boolean = process.env.NODE_ENV === 'production';
class Application {
  _events
  _authentication

  _isQuitting = false

  constructor(){
    this._events = new Events()
    this._authentication = new Authentication(this)

    if(this.isProd()) {
      serve({ directory: 'app' });
    } else {
      app.setPath('userData', `${app.getPath('userData')} (development)`);
    }
    
    app.whenReady().then(() => {
      this.start()
    }).catch((error) => {
      alert('Unable to load application:'+ error)
    })
    
    app.on('window-all-closed', () => {
      app.quit();
    });
    
    app.on('before-quit', () => this._isQuitting = true)
  }

  async start(){
    // Load React Devtools
    // const reactDevToolsPath = path.join(
    //   os.homedir(),
    //   '/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/4.25.0_0'
    // )
    // await session.defaultSession.loadExtension(reactDevToolsPath)
  
    let mainWindow = createWindow('main', {
      width: 1000,
      height: 600,
    });
  
    if (isProd) {
      await mainWindow.loadURL('app://./home.html');
    } else {
      console.log(process.argv)
      const port = process.argv[2];
      await mainWindow.loadURL(`http://localhost:${port}/home`);
      mainWindow.webContents.openDevTools();
    }
  
    mainWindow.on('close', (event) => {
      if(this._isQuitting) {
        mainWindow = null
      } else {
        event.preventDefault()
        mainWindow.hide()
      }
    })
  
    // Check authentication
    if(! this._authentication.checkAuthentication()){
      this._authentication.startHooks()
      await this._authentication.startAuthflow()
    }
  
    // setInterval(() => {
    //   console.log('Application is in fullscreen:', mainWindow.fullScreen)
    // }, 1000)
  
    app.on('activate', () => { mainWindow.show() })
  }

  quit() {
    this._isQuitting = true
    app.quit()
  }

  isProd(){
    return process.env.NODE_ENV === 'production';
  }
}

new Application()