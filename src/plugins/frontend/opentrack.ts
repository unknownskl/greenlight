import Application from '../../frontend/application'
// import GammepadDriver from 'xbox-xcloud-player/src/Driver/Gamepad'
import xCloudPlayer from 'xbox-xcloud-player'

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

            this.renderSettings()
        })

        this._application._ipc.on('opentrack-position', (event:any, variables:any) => {
            this._position = variables.position
        })
    }

    start() {
        // Does nothing yet?
    }

    stop() {
        // Does nothing yet?
    }

    onStreamStart() {
        // Check if Opentrack is enabled
        if(this._isRunning === true){
            console.log('Opentrack inject plugin!')
            this._application._StreamingView._streamClient._xCloudPlayerConfig = {
                ...this._application._StreamingView._streamClient._xCloudPlayerConfig,
                'input_driver': new OpentrackDriver(this)
            }
        }
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
}

class GamepadDriver {

    _application:xCloudPlayer

    _gamepads:Array<any> = []

    constructor() {
        // this._application = application
    }

    setApplication(application:xCloudPlayer) {
        this._application = application
    }

    start() {
        window.addEventListener("gamepadconnected", (e) => {

            const gamepad = {
                index: e.gamepad.index,
                name: e.gamepad.id,
                buttons: e.gamepad.buttons,
                axes: e.gamepad.axes,
            }
            this._gamepads.push(gamepad)

            this._application.getEventBus().emit('gamepad_connect', gamepad)
            console.log('xCloudPlayer Driver/Gamepad.ts - Controller connected:', this._gamepads)
        })

        window.addEventListener("gamepaddisconnected", (e) => {
            for(const gamepad in this._gamepads){
                if(this._gamepads[gamepad].index === e.gamepad.index){
                    const removedGamepad = this._gamepads[gamepad]
                    this._gamepads.splice(e.gamepad.index, 1)

                    this._application.getEventBus().emit('gamepad_disconnect', removedGamepad)
                    console.log('xCloudPlayer Driver/Gamepad.ts - Controller disconnected:', this._gamepads)
                }
            }
        })
    }

    stop() {
        // console.log('xCloudPlayer Driver/Gamepad.ts - Stop collecting events:', this._gamepads)
    }

    // Use requestState() from OpentrackDriver()
    //
    // requestState() {
    //     for(const gamepad in this._gamepads){
    //         const gamepadState = navigator.getGamepads()[this._gamepads[gamepad].index]
    //         const state = this.mapStateLabels(gamepadState?.buttons, gamepadState?.axes, this._gamepads[gamepad].index)

    //         this._application.getChannelProcessor('input').queueGamepadState(state)
    //     }
    // }

    mapStateLabels(buttons:any, axes:any, gamepadIndex=0) {
        return {
            GamepadIndex: gamepadIndex,
            A: buttons[0].value,
            B: buttons[1].value,
            X: buttons[2].value,
            Y: buttons[3].value,
            LeftShoulder: buttons[4].value,
            RightShoulder: buttons[5].value,
            LeftTrigger: buttons[6].value,
            RightTrigger: buttons[7].value,
            View: buttons[8].value,
            Menu: buttons[9].value,
            LeftThumb: buttons[10].value,
            RightThumb: buttons[11].value,
            DPadUp: buttons[12].value,
            DPadDown: buttons[13].value,
            DPadLeft: buttons[14].value,
            DPadRight: buttons[15].value,
            Nexus: buttons[16].value,
            LeftThumbXAxis: axes[0],
            LeftThumbYAxis: axes[1],
            RightThumbXAxis: axes[2],
            RightThumbYAxis: axes[3]
        }
    }
}

class OpentrackDriver extends GamepadDriver {

    _opentrack:OpentrackPluginFrontend

    constructor(openTrack:OpentrackPluginFrontend) {
        super()

        this._opentrack = openTrack
        console.log('Opentrack: Setting up gamepad driver')
    }

    requestState() {
        // override gamepad controls when opentrack is on?

        for(const gamepad in this._gamepads){

            // Lets assume we are on gamepad index 0
            let opentrackState = {}
            if(this._gamepads[gamepad].index === 0){
                opentrackState = this.convertToControllerInput(this._opentrack._position)
            }

            const gamepadState = navigator.getGamepads()[this._gamepads[gamepad].index]
            const state = this.mapStateLabels(gamepadState?.buttons, gamepadState?.axes, this._gamepads[gamepad].index)

            const mergedState = { ...state, ...opentrackState }

            this._application.getChannelProcessor('input').queueGamepadState(mergedState)
        }
    }

    convertToControllerInput(position:any) {
        // Run js func...
        const state = {
            RightThumbXAxis: (position.yaw/20),
            RightThumbYAxis: -(position.pitch/20)
        }

        return state
    } 
}