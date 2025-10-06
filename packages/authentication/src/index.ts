import { app, BrowserWindow } from 'electron'
import Logger from '@greenlight/logger'
import SafeStorage from './storage'

const log = new Logger('auth')

export default class GreenlightAuthentication {

    private _storage: SafeStorage = new SafeStorage()

    constructor(){
        log.log(`App path: ${app.getAppPath()}`) // Example usage of electron's app module
    }

    createWindow() {
        log.log('Creating authentication window...')
        const win = new BrowserWindow({
            width: 400,
            height: 600,
            resizable: false,
        })
        win.setTitle('Greenlight Authentication')
        win.loadURL('data:text/html,<h1>Authentication Window</h1><button>Login using XAL</button><hr />MSAL Auth: Loading...')
    }
}