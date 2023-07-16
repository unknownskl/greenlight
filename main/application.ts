import { app as ElectronApp, BrowserWindow, ipcMain, session, protocol } from 'electron';
import serve from 'electron-serve'
import Store from 'electron-store'
import Debug from 'debug'
import { createWindow, xboxWorker, updater } from './helpers';
import Events from './events'
import Authentication from './authentication'

import pkg from '../package.json'

interface startupFlags {
    fullscreen:boolean
    autoStream:string
}

export default class Application {

    private _log
    public _store = new Store()
    private _startupFlags: startupFlags = {
        fullscreen: false,
        autoStream: '',
    }
    private _isProduction:boolean = (process.env.NODE_ENV === 'production')
    private _isMac:boolean = (process.platform === 'darwin')
    private _isWindows:boolean = (process.platform === 'win32')
    private _isQuitting:boolean = false

    private _mainWindow
    public _events:Events
    public _authentication:Authentication
    public _xboxWorker:xboxWorker

    constructor(){
        console.log(__filename+'[constructor()] Starting Greenlight v'+pkg.version)
        this._log = Debug('greenlight')

        this.readStartupFlags()
        this.loadApplicationDefaults()

        // ElectronApp.removeAsDefaultProtocolClient('ms-xal-public-beta-000000004c20a908')
        
        this._events = new Events(this)
        this._authentication = new Authentication(this)
        this._xboxWorker = new xboxWorker(this)
    }

    log(namespace = 'application', ...args){
        this._log.extend(namespace)(...args)
    }

    getStartupFlags(){
        return this._startupFlags
    }

    readStartupFlags(){
        this.log('application',__filename+'[readStartupFlags()] Program args detected:', process.argv)

        for(const arg in process.argv){
            if(process.argv[arg].includes('--fullscreen')){
                this.log('application',__filename+'[readStartupFlags()] --fullscreen switch found. Setting fullscreen to true')
                this._startupFlags.fullscreen = true
            }

            if(process.argv[arg].includes('--connect=')){
                let key = process.argv[arg].substring(10)

                this.log('application',__filename+'[readStartupFlags()] --connect switch found. Setting autoStream to', key)
                this._startupFlags.autoStream = key
            }
        }

        this.log('application',__filename+'[readStartupFlags()] End result of startupFlags:', this._startupFlags)
    }

    loadApplicationDefaults(){
        if(this._isProduction === true) {
            serve({ directory: 'app' });
        } else {
            ElectronApp.setPath('userData', `${ElectronApp.getPath('userData')} (development)`);
        }

        ElectronApp.whenReady().then(() => {
            this.log('electron', __filename+'[loadApplicationDefaults()] Electron has been fully loaded. Ready to open windows')

            this.openMainWindow()
            this._authentication.startWebviewHooks()
        
            // Check authentication
            if(! this._authentication.checkAuthentication()){
                // this._authentication.startHooks()
                this._authentication.startAuthflow()
            }

        }).catch((error) => {
            this.log('electron', __filename+'[loadApplicationDefaults()] Electron has failed to load:', error)
        })
          
        ElectronApp.on('window-all-closed', () => {
            if(this._isMac === true){
                this.log('electron', __filename+'[loadApplicationDefaults()] Electron detected that all windows are closed. Running in background...')

            } else {
                this.log('electron', __filename+'[loadApplicationDefaults()] Electron detected that all windows are closed. Quitting app...')
                ElectronApp.quit();
            }
        });

        ElectronApp.on('activate', () => { (this._mainWindow !== undefined) ? this._mainWindow.show() : this.openMainWindow() })
        ElectronApp.on('before-quit', () => this._isQuitting = true)
    }

    openMainWindow(){
        this.log('electron', __filename+'[openMainWindow()] Creating new main window')

        const windowOptions:any = {
            title: 'Greenlight',
            backgroundColor: 'rgb(26, 27, 30)'
        }
        if(this._startupFlags.fullscreen === true){
            windowOptions.fullscreen = true
          }

        this._mainWindow = createWindow('main', {
            width: 1000,
            height: 600,
            ...windowOptions,
        });

        this._mainWindow.on('show', (event) => {
            this.log('electron', __filename+'[openMainWindow()] Showing Main window.')
        })

        this._mainWindow.on('close', (event) => {
            if(this._isMac === true && this._isQuitting === false){
                event.preventDefault()
                this.log('electron', __filename+'[openMainWindow()] Main windows has been hidden')
                this._mainWindow.hide()
            } else {
                this.log('electron', __filename+'[openMainWindow()] Main windows has been closed')
                this._mainWindow = undefined
            }
        })

        if (this._isProduction === true) {
            this._mainWindow.loadURL('app://./home.html');
        } else {
            const port = process.argv[2];
            this._mainWindow.loadURL(`http://localhost:${port}/home`);
            this._mainWindow.webContents.openDevTools();
        }
    }

    quit(){
        ElectronApp.quit()
    }

    restart(){
        this.quit()
        ElectronApp.relaunch()
    }
}

new Application()