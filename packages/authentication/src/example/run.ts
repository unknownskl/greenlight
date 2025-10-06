import { app } from 'electron'
import Logger from '@greenlight/logger'
import GreenlightAuthentication from '../index'

const log = new Logger('exampleApp')

export default class ExampleApp {
    private _auth: GreenlightAuthentication = new GreenlightAuthentication()

    constructor() {
        log.log('Starting ExampleApp...')
    }

    createWindow() {
        log.log('Creating main application window...')
        // Here you would create your main application window
        this._auth.createWindow()
    }
}

const exampleApp = new ExampleApp()

app.whenReady().then(() => {
  exampleApp.createWindow()
})