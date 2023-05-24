import { app, BrowserWindow, ipcMain, session, protocol } from 'electron';
import serve from 'electron-serve';
import { createWindow, Authentication, xboxWorker, updater } from './helpers';
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
  _autostartStream = ''

  _isQuitting = false

  constructor(){
    this._events = new Events(this)
    this._authentication = new Authentication(this)
    this._xboxWorker = new xboxWorker(this)

    // Read fullscreen switch
    console.log('Program args:', process.argv)

    for(const arg in process.argv){
      console.log(process.argv[arg])

      if(process.argv[arg].includes('--fullscreen')){
        console.log('- Fullscreen switch acive')
        this._fullscreenMode = true
      }

      if(process.argv[arg].includes('--connect=')){
        let key = process.argv[arg].substring(10)

        console.log('- Connect switch is active, key:', key)
        this._autostartStream = key
      }
    }

    // Boot application
    if(this.isProd()) {
      serve({ directory: 'app' });
    } else {
      app.setPath('userData', `${app.getPath('userData')} (development)`);
    }
    
    app.whenReady().then(() => {
      updater({
        debug: false,
        silent: true
      })

      this.start()
    }).catch((error) => {
      alert('Unable to load application:'+ error)
    })
    
    app.on('window-all-closed', () => {
      app.quit();
    });
    
    app.on('before-quit', () => this._isQuitting = true)
  }

  getAutoStreamStart(){
    if(this._autostartStream !== ''){
      const key = this._autostartStream
      this._autostartStream = ''
      return key
    } else {
      return false
    }
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
      if(process.platform == 'darwin') {
        // Lets hide and run on the background on OSX
        if(this._isQuitting) {
          this._mainWindow = null
        } else {
          event.preventDefault()
          this._mainWindow.hide()
        }
      } else {
        app.quit()
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

    // Catch authentication protocol to prevent handling errors.
    protocol.registerFileProtocol('ms-xal-public-beta-000000004c20a908', (request, callback) => {
      callback('404')
    })
  
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