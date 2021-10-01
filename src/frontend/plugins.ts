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
        console.log('plugins loaded:', this._plugins[id])

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

        // console.log('gamepadDriver requestState:', pluginGamepadInput)

        for(const gamepad in this._gamepads){
            const gamepadState = navigator.getGamepads()[this._gamepads[gamepad].index]
            const state = this.mapStateLabels(gamepadState?.buttons, gamepadState?.axes, this._gamepads[gamepad].index)

            const mergedState = { ...state, ...pluginGamepadInput }

            this._application.getChannelProcessor('input').queueGamepadState(mergedState)
        }
    }

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