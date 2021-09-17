import Application from '../../frontend/application'

export class OpentrackPluginFrontend {

    _isRunning = false
    _application:Application

    _server:any

    _syncInterval:any

    _position: {
        x:number,
        y:number,
        z:number,
        yaw:number,
        pitch:number,
        roll:number,
    }

    constructor(application:Application = undefined) {
        this._application = application
    }

    load() {

        // const menuDiv = document.getElementsByClassName('userProfile')
        // menuDiv[0].innerHTML += '';

        this.setupHandlers()

        this._syncInterval = setInterval(() => {
            this._application._ipc.send('opentrack-sync', {
                isRunning: this._isRunning
            })
        }, 1000)
    }

    setupHandlers() {

        this._application._ipc.on('opentrack-sync', (event:any, variables:any) => { 
            this._isRunning = variables.isRunning

            document.getElementById('opentrack_running').innerHTML = (this._isRunning) ? 'Running' : 'Stopped'
        })
    }

    start() {
        // Does nothing yet?
    }

    stop() {
        // Does nothing yet?
    }
}