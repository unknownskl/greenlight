import { app as ElectronApp, BrowserWindow, dialog, screen, session } from 'electron'
import serve from 'electron-serve'
import Store from 'electron-store'
import Debug from 'debug'
import { createWindow, xboxWorker, updater } from './helpers'
import Authentication from './authentication'
import Ipc from './ipc'
import WebUI from './webui'

import xboxWebApi from 'xbox-webapi'
import xCloudApi from './helpers/xcloudapi'

import pkg from '../package.json'

import i18n from 'i18next';

interface startupFlags {
    fullscreen:boolean;
    autoStream:string;
}

export default class Application {

    private _log
    public _store = new Store()
    private _startupFlags: startupFlags = {
        fullscreen: false,
        autoStream: '',
    }

    public _isProduction:boolean = (process.env.NODE_ENV === 'production')
    private _isCi:boolean = (process.env.CI !== undefined)
    private _isMac:boolean = (process.platform === 'darwin')
    private _isWindows:boolean = (process.platform === 'win32')
    private _isQuitting:boolean = false

    public _mainWindow
    public _ipc:Ipc
    public _webUI:WebUI
    public _authentication:Authentication

    private t = i18n.t.bind(i18n);

    constructor(){
        console.log(__filename+'[constructor()] Starting Greenlight v'+pkg.version)
        this._log = Debug('greenlight')

        // ElectronApp.commandLine.appendSwitch('use-vulkan')
        // ElectronApp.commandLine.appendSwitch('use-angle', 'vulkan')
        // ElectronApp.commandLine.appendSwitch('enable-features', 'Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder,PlatformHEVCDecoderSupport,CanvasOopRasterization')
        // ElectronApp.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder')
        // ElectronApp.commandLine.appendSwitch('enable-gpu-rasterization')
        // ElectronApp.commandLine.appendSwitch('enable-oop-rasterization')
        ElectronApp.commandLine.appendSwitch('enable-accelerated-video-decode')
        // ElectronApp.commandLine.appendSwitch('ozone-platform-hint', 'x11')
        // ElectronApp.commandLine.appendSwitch('ignore-gpu-blocklist')
        // ElectronApp.commandLine.appendSwitch('no-sandbox')
        ElectronApp.commandLine.appendSwitch('enable-zero-copy')

        this.readStartupFlags()
        this.loadApplicationDefaults()

        // ElectronApp.removeAsDefaultProtocolClient('ms-xal-public-beta-000000004c20a908')

        this._ipc = new Ipc(this)
        this._authentication = new Authentication(this)

        this._ipc.startUp()
        this._webUI = new WebUI(this)
    }

    log(namespace = 'application', ...args){
        this._log.extend(namespace)(...args)
    }

    getStartupFlags(){
        return this._startupFlags
    }

    resetAutostream(){
        this._startupFlags.autoStream = ''
    }

    readStartupFlags(){
        this.log('application', __filename+'[readStartupFlags()] Program args detected:', process.argv)

        for(const arg in process.argv){
            if(process.argv[arg].includes('--fullscreen')){
                this.log('application', __filename+'[readStartupFlags()] --fullscreen switch found. Setting fullscreen to true')
                this._startupFlags.fullscreen = true
            }

            if(process.argv[arg].includes('--connect=')){
                const key = process.argv[arg].substring(10)

                this.log('application', __filename+'[readStartupFlags()] --connect switch found. Setting autoStream to', key)
                this._startupFlags.autoStream = key
            }
        }

        this.log('application', __filename+'[readStartupFlags()] End result of startupFlags:', this._startupFlags)
    }

    loadApplicationDefaults(){
        if(this._isProduction === true && this._isCi === false) {
            serve({ directory: 'app' })

        } else if(this._isCi === true) {
            const random = Math.random()*100
            ElectronApp.setPath('userData', `${ElectronApp.getPath('userData')} (${random})`)
            ElectronApp.setPath('sessionData', `${ElectronApp.getPath('userData')} (${random})`)
            this._store.delete('user')
            this._store.delete('auth')

            serve({ directory: 'app' })
        } else {

            ElectronApp.setPath('userData', `${ElectronApp.getPath('userData')} (development)`)
        }

        ElectronApp.whenReady().then(() => {
            updater({
                // debug: true,
                silent: true,
                prereleases: (ElectronApp.getVersion().includes('beta')) ? true : false,
            }, this)

            this.log('electron', __filename+'[loadApplicationDefaults()] Electron has been fully loaded. Ready to open windows')

            // The files of the local translator models come from a public server that refuses the user agent of a
            // browser (it answers 406); the app asks for them under its own name
            session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://firefox-settings-attachments.cdn.mozilla.net/*'] }, (details, callback) => {
                callback({ requestHeaders: { ...details.requestHeaders, 'User-Agent': 'Greenlight' } })
            })

            this.openMainWindow()

            // Check authentication
            if(! this._authentication.checkAuthentication()){
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
                ElectronApp.quit()
            }
        })

        ElectronApp.on('activate', () => {
            (this._mainWindow !== undefined) ? this._mainWindow.show() : this.openMainWindow()
        })
        ElectronApp.on('before-quit', () => this._isQuitting = true)
    }

    _webApi:xboxWebApi
    _xHomeApi:xCloudApi
    _xCloudApi:xCloudApi
    _xboxWorker:xboxWorker


    authenticationCompleted(streamingTokens, webToken){
        this.log('electron', __filename+'[authenticationCompleted()] authenticationCompleted called')
        // const tokens = this._authentication._tokens
        this._xHomeApi = new xCloudApi(this, streamingTokens.xHomeToken.data.offeringSettings.regions.find(region => region.isDefault).baseUri.substring(8), streamingTokens.xHomeToken.data.gsToken, 'home')

        if(streamingTokens.xCloudToken !== undefined){
            this._xCloudApi = new xCloudApi(this, streamingTokens.xCloudToken.data.offeringSettings.regions.find(region => region.isDefault).baseUri.substring(8), streamingTokens.xCloudToken.data.gsToken, 'cloud')
        }

        this._webApi = new xboxWebApi({
            token: webToken.data.Token,
            uhs: webToken.data.DisplayClaims.xui[0].uhs,
        })

        this._authentication._isAuthenticating = false
        this._authentication._isAuthenticated = true

        this._webApi.providers.profile.get('/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag').then((result) => {
            if(result.data.profileUsers.length > 0) {
                for(const setting in result.data.profileUsers[0].settings){

                    if(result.data.profileUsers[0].settings[setting].id === 'Gamertag'){
                        this._store.set('user.gamertag', result.data.profileUsers[0].settings[setting].value)

                    } else if(result.data.profileUsers[0].settings[setting].id === 'GameDisplayPicRaw'){
                        this._store.set('user.gamerpic', result.data.profileUsers[0].settings[setting].value)

                    } else if(result.data.profileUsers[0].settings[setting].id === 'Gamerscore'){
                        this._store.set('user.gamerscore', result.data.profileUsers[0].settings[setting].value)
                    }
                }
            }

            // Run workers
            this._xboxWorker = new xboxWorker(this)
            this._ipc.onUserLoaded()

        }).catch((error) => {
            this.log('electron', __filename+'[authenticationCompleted()] Failed to retrieve user profile:', error)
            dialog.showMessageBox({
                message: this.t('errors.failedToRetrieveUserProfile') + JSON.stringify(error),
                type: 'error',
            })
        })
    }

    openMainWindow(){
        this.log('electron', __filename+'[openMainWindow()] Creating new main window')

        const windowOptions:any = {
            title: 'Greenlight',
            backgroundColor: 'rgb(26, 27, 30)',
        }
        if(this.wantsFullscreen()){
            windowOptions.fullscreen = true
        }

        this._mainWindow = createWindow('main', {
            width: 1280,
            height: 800,
            ...windowOptions,
        })

        this._mainWindow.on('show', () => {
            this.log('electron', __filename+'[openMainWindow()] Showing Main window.')
        })

        // The screen can change while the app runs (the Steam Deck is docked or taken out of the dock):
        // the window then takes the size of the new screen
        const screenKey = () => {
            const size = screen.getPrimaryDisplay().size
            return size.width + 'x' + size.height + ' on ' + screen.getAllDisplays().length
        }
        let lastScreen = screenKey()
        let refitTimer: ReturnType<typeof setTimeout> | undefined
        const refit = () => {
            if(refitTimer !== undefined){
                clearTimeout(refitTimer)
            }
            // Only a real change of the screen counts (not the changes that the window makes itself)
            refitTimer = setTimeout(() => {
                if(screenKey() !== lastScreen){
                    lastScreen = screenKey()
                    this.log('electron', __filename+'[openMainWindow()] The screen changed: '+lastScreen)
                    this.applyWindowMode(true)
                }
            }, 600)
        }
        screen.on('display-metrics-changed', refit)
        screen.on('display-added', refit)
        screen.on('display-removed', refit)

        // Alt alone would show the menu bar (File / Edit / View / Window), which only gets in the way while playing.
        // The shortcuts of the menu (Ctrl+R, F11, ...) keep working; the setting brings the Alt key back for desktop use.
        this._mainWindow.webContents.on('before-input-event', (event, input) => {
            if(input.key === 'Alt' && !input.control && !input.shift && !input.meta){
                const settings = this._store.get('settings', {}) as any
                if(settings.app_menubar_alt !== true){
                    event.preventDefault()
                }
            }
        })

        this._mainWindow.on('close', (event) => {
            if(this._isMac === true && this._isQuitting === false){
                event.preventDefault()
                this.log('electron', __filename+'[openMainWindow()] Main window has been hidden')
                this._mainWindow.hide()
            } else {
                this.log('electron', __filename+'[openMainWindow()] Main window has been closed')
                this._mainWindow = undefined
            }
        })

        if (this._isProduction === true && this._isCi === false) {
            this._mainWindow.loadURL('app://./home.html')
        } else {
            const port = process.argv[2] || 3000
            this._mainWindow.loadURL(`http://localhost:${port}/home`)

            if(this._isCi !== true){
                this._mainWindow.webContents.openDevTools()
                this.openGPUWindow()
            }
        }
    }

    /** Is this the game mode of the Steam Deck (gamescope)? */
    isGameMode(): boolean {
        const env = process.env
        return env.SteamGamepadUI === '1' || env.GAMESCOPE_WAYLAND_DISPLAY !== undefined || env.XDG_CURRENT_DESKTOP === 'gamescope' || env.XDG_SESSION_DESKTOP === 'gamescope'
    }

    /** Should the window fill the whole screen? (Setting "fullscreen": auto = in the game mode of the Steam Deck.) */
    wantsFullscreen(): boolean {
        if(this._startupFlags.fullscreen === true){
            return true
        }

        const settings = this._store.get('settings', {}) as any
        const mode = settings.app_fullscreen ?? 'auto'

        if(mode === 'on'){
            return true
        }
        return mode === 'auto' && this.isGameMode()
    }

    /** Applies the fullscreen setting; with `refit` a fullscreen window also takes the size of a changed screen. */
    applyWindowMode(refit = false){
        const win = this._mainWindow
        if(win === undefined || win.isDestroyed()){
            return
        }

        const wanted = this.wantsFullscreen()
        if(wanted && refit && win.isFullScreen()){
            win.setFullScreen(false)
            win.setFullScreen(true)
        } else if(win.isFullScreen() !== wanted){
            win.setFullScreen(wanted)
        }

        if(!wanted && !win.isFullScreen()){
            // A window that is bigger than the screen it is on is made to fit
            const area = screen.getDisplayMatching(win.getBounds()).workArea
            const [width, height] = win.getSize()
            if(width > area.width || height > area.height){
                win.setSize(Math.min(width, area.width), Math.min(height, area.height))
            }
        }
    }

    _gpuWindow

    openGPUWindow(){
        this._gpuWindow = new BrowserWindow({
            width: 800,
            height: 600,
        })

        // Load chrome://gpu
        this._gpuWindow.loadURL('chrome://gpu')

        // Open DevTools
        this._gpuWindow.webContents.openDevTools()
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
