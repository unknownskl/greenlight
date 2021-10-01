import Application from '../../frontend/application'
import { GamepadDriver } from '../../frontend/plugins'

interface OpentrackPosition {
    [key: string]: number;
}

export class OpentrackPluginFrontend {

    _isRunning = false
    _application:Application

    _server:any

    _syncInterval:any

    _position:OpentrackPosition = {
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
    }
    _positionTimestamp:number

    constructor(application:Application = undefined) {
        this._application = application
    }

    load() {

        this.setupHandlers()

        this._syncInterval = setInterval(() => {
            this._application._ipc.send('opentrack-sync', {
                isRunning: this._isRunning
            })
        }, 1000)

        this._syncInterval = setInterval(() => {
            this._application._ipc.send('opentrack-position', {})
        }, 50)

        document.getElementById('pluginsContent').innerHTML += '<div id="plugin_opentrack_view"><p>Loading view...</p></div>'

        this.renderSettings()
    }

    setupHandlers() {

        this._application._ipc.on('opentrack-sync', (event:any, variables:any) => { 
            this._isRunning = variables.isRunning
            this._position = variables.position
            this._positionTimestamp = variables.timestamp

            this.renderSettings()
        })

        this._application._ipc.on('opentrack-position', (event:any, variables:any) => {
            this._position = variables.position
            this._positionTimestamp = variables.timestamp
        })
    }

    start() {
        // Does nothing yet?
    }

    stop() {
        // Does nothing yet?
    }

    onStreamStart() {
        // on stream start
    }

    onGamepadRequest(gamepadDriver:GamepadDriver) {
        // Check if Opentrack is enabled
        if(this._isRunning === true && (Date.now() - this._positionTimestamp) < 5000 ){ // 5000 ms timeout
            return this.convertToControllerInput(this._position)
        }

        return {}
    }

    renderSettings() {
        const status = (this._isRunning) ? 'Running' : 'Stopped'
        document.getElementById('plugin_opentrack_view').innerHTML = '<h2>Opentrack</h2>'
        document.getElementById('plugin_opentrack_view').innerHTML += '<p>Status: <span id="opentrack_running" class="settingValue">'+status+'</span></p>'
        document.getElementById('plugin_opentrack_view').innerHTML += '<div id="plugin_opentrack_positions"></div>'

        document.getElementById('plugin_opentrack_positions').innerHTML = ''
        for(const position in this._position){
            document.getElementById('plugin_opentrack_positions').innerHTML += '<p>'+position+': <span id="plugin_opentrack_positions_'+position+'" class="settingValue">'+this._position[position]+'</span></p>'
        }
    }

    convertToControllerInput(position:any) {
        const state = {
            RightThumbXAxis: (position.yaw/20),
            RightThumbYAxis: -(position.pitch/20)
        }

        return state
    } 
}