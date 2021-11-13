import Application from './application'
import xCloudPlayer from 'xbox-xcloud-player'

export default class Plugins {

    _plugins:any = {}
    _application:Application

    constructor(application:Application) {
        this._application = application
    }

    load(id:string, pluginClass:any) {
        this._plugins[id] = new pluginClass(this._application)
        // console.log('plugins loaded:', this._plugins[id])

        this._plugins[id].load()
    }

    onStreamStart() {
        this._application._StreamingView._streamClient._xCloudPlayerConfig = {
            ...this._application._StreamingView._streamClient._xCloudPlayerConfig,
            'input_driver': new GamepadDriver(this)
        }

        for(const plugin in this._plugins){
            if(this._plugins[plugin].onStreamStart !== undefined){
                this._plugins[plugin].onStreamStart()
            }
        }
    }

}

export class GamepadDriver {

    _application:xCloudPlayer
    _plugins:Plugins

    _gamepads:Array<any> = []

    constructor(plugins:Plugins) {
        this._plugins = plugins
    }

    setApplication(application:xCloudPlayer) {
        this._application = application
    }

    start() {
        //
    }

    stop() {
        // console.log('xCloudPlayer Driver/Gamepad.ts - Stop collecting events:', this._gamepads)
    }

    requestState() {
        // Gather plugin input
        let pluginGamepadInput = {}

        for(const plugin in this._plugins._plugins){
            if(this._plugins._plugins[plugin].onGamepadRequest !== undefined){
                const gamepadInput = this._plugins._plugins[plugin].onGamepadRequest(this)
                pluginGamepadInput = {
                    ...pluginGamepadInput,
                    ...gamepadInput
                }
            }
        }

        const gamepads = navigator.getGamepads()
        for(let gamepad = 0; gamepad < gamepads.length; gamepad++){
            const gamepadState = gamepads[gamepad]
            
            if(gamepadState !== null){
                const state = this.mapStateLabels(gamepadState.buttons, gamepadState.axes)
                const mergedState = { ...state, ...pluginGamepadInput }

                this._application.getChannelProcessor('input').queueGamepadState(mergedState)
            }
        }
    }

    mapStateLabels(buttons:any, axes:any, gamepadIndex=0) {
        return {
            GamepadIndex: gamepadIndex,
            A: buttons[0]?.value || 0,
            B: buttons[1]?.value || 0,
            X: buttons[2]?.value || 0,
            Y: buttons[3]?.value || 0,
            LeftShoulder: buttons[4]?.value || 0,
            RightShoulder: buttons[5]?.value || 0,
            LeftTrigger: buttons[6]?.value || 0,
            RightTrigger: buttons[7]?.value || 0,
            View: buttons[8]?.value || 0,
            Menu: buttons[9]?.value || 0,
            LeftThumb: buttons[10]?.value || 0,
            RightThumb: buttons[11]?.value || 0,
            DPadUp: buttons[12]?.value || 0,
            DPadDown: buttons[13]?.value || 0,
            DPadLeft: buttons[14]?.value || 0,
            DPadRight: buttons[15]?.value || 0,
            Nexus: buttons[16]?.value || 0,
            LeftThumbXAxis: axes[0],
            LeftThumbYAxis: axes[1],
            RightThumbXAxis: axes[2],
            RightThumbYAxis: axes[3],
        }
    }
}