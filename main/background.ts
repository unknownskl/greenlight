import { app, BrowserWindow, ipcMain, session } from 'electron';
import serve from 'electron-serve';
import { createWindow, Authentication, xboxWorker } from './helpers';
import Events from './events'
const path = require('path')
const os = require('os')

const isProd: boolean = process.env.NODE_ENV === 'production';

interface extraOptions {
  fullscreen?: boolean;
}
export default class Application {
  _events:Events
  _authentication:Authentication
  _xboxWorker:xboxWorker

  _mainWindow:BrowserWindow
  _fullscreenMode = false

  _isQuitting = false

  constructor(){
    this._events = new Events(this)
    this._authentication = new Authentication(this)
    this._xboxWorker = new xboxWorker(this)

    // Read fullscreen switch
    if(process.argv.includes('--fullscreen')){
      console.log('- Fullscreen switch acive')
      this._fullscreenMode = true
    }

    // Boot application
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

    const extraOptions:extraOptions = {}

    if(this._fullscreenMode === true){
      extraOptions.fullscreen = true
    }
  
    this._mainWindow = createWindow('main', {
      width: 1000,
      height: 600,
      ...extraOptions,
    });
  
    if (isProd) {
      await this._mainWindow.loadURL('app://./home.html');
    } else {
      console.log(process.argv)
      const port = process.argv[2];
      await this._mainWindow.loadURL(`http://localhost:${port}/home`);
      this._mainWindow.webContents.openDevTools();
    }
  
    this._mainWindow.on('close', (event) => {
      if(this._isQuitting) {
        this._mainWindow = null
      } else {
        event.preventDefault()
        this._mainWindow.hide()
      }
    })
  
    // Check authentication
    if(! this._authentication.checkAuthentication()){
      this._authentication.startHooks()
      await this._authentication.startAuthflow()
    }
  
    // setInterval(() => {
    //   console.log('Application is in fullscreen:', this._mainWindow.fullScreen)
    // }, 1000)
  
    app.on('activate', () => { this._mainWindow.show() })
  }

  quit() {
    this._isQuitting = true
    app.quit()
  }

  restart() {
    this._isQuitting = true
    app.quit()
    app.relaunch()
  }

  isProd(){
    return process.env.NODE_ENV === 'production';
  }
}

new Application()