import GamepadDriver from 'xbox-xcloud-player/dist/Driver/Gamepad'

// Report type of vibration messages on the input channel (see Channel/Input in the library)
const VIBRATION_REPORT = 128

// The console only knows controller 0 until more are announced, but navigator.getGamepads() can
// leave slot 0 empty (macOS with Electron 42 puts the first controller in slot 1 or 2).
// Renumber the connected controllers 0, 1, 2... instead of sending the browser slot index.
export default class CompactGamepadDriver extends GamepadDriver {

    _vibrationIntervals = {}

    start(){
        this._activeGamepads = { 0: false, 1: false, 2: false, 3: false }
        this._activeGamepadsInterval = setInterval(() => {
            const control = this._application?.getChannelProcessor('control')
            if(control === undefined){
                return
            }
            this.handleVibration()

            const connected = this.connectedGamepads().length
            // Controller 0 is always connected on the console side
            for(let index = 1; index < 4; index++){
                if(index < connected && this._activeGamepads[index] === false){
                    control.sendGamepadAdded(index)
                    this._activeGamepads[index] = true

                } else if(index >= connected && this._activeGamepads[index] === true){
                    control.sendGamepadRemoved(index)
                    this._activeGamepads[index] = false
                }
            }
        }, 500)

        window.addEventListener('keydown', this._downFunc)
        window.addEventListener('keyup', this._upFunc)
    }

    stop(){
        super.stop()
        for(const index in this._vibrationIntervals){
            clearInterval(this._vibrationIntervals[index])
        }
    }

    requestStates(){
        return this.connectedGamepads().map((gamepad, index) => {
            const state = this.mapStateLabels(gamepad.buttons, gamepad.axes)
            state.GamepadIndex = index
            return state
        })
    }

    // Vibration reports carry the console controller index, but the library looks it up in
    // navigator.getGamepads() and does not handle playEffect() failures (e.g. controller switched off).
    // Play them on the matching connected controller instead.
    handleVibration(){
        const input = this._application?.getChannelProcessor('input')
        if(input === undefined || input._compactVibration === true){
            return
        }
        input._compactVibration = true

        const onMessage = input.onMessage.bind(input)
        input.onMessage = (event: MessageEvent) => {
            const data = new DataView(event.data)
            if(data.byteLength < 13 || data.getUint8(0) !== VIBRATION_REPORT){
                onMessage(event)
                return
            }
            if(input._rumbleEnabled === true){
                this.playVibration(data)
            }
        }
    }

    playVibration(data: DataView){
        const index = data.getUint8(3)
        const leftMotor = data.getUint8(4) / 100
        const rightMotor = data.getUint8(5) / 100
        const leftTrigger = data.getUint8(6) / 100
        const rightTrigger = data.getUint8(7) / 100
        const duration = data.getUint16(8, true)
        const delay = data.getUint16(10, true)
        let repeat = data.getUint8(12)

        const play = () => {
            const actuator = this.connectedGamepads()[index]?.vibrationActuator as any
            if(! actuator){
                return
            }

            const effect = { startDelay: 0, duration: duration, strongMagnitude: leftMotor, weakMagnitude: rightMotor, leftTrigger: leftTrigger, rightTrigger: rightTrigger }
            if(actuator.type === 'dual-rumble'){
                // No trigger motors: blend the trigger rumble into the weak motor (same as the library)
                const intensityRumble = rightMotor < .6 ? (.6 - rightMotor) / 2 : 0
                const intensityTriggers = (leftTrigger + rightTrigger) / 4
                effect.weakMagnitude = Math.min(1, rightMotor + Math.min(intensityRumble, intensityTriggers))
                effect.leftTrigger = 0
                effect.rightTrigger = 0
            }
            actuator.playEffect(actuator.type, effect).catch(() => {
                // Controller switched off or replaced meanwhile: nothing to do
            })
        }

        clearInterval(this._vibrationIntervals[index])
        play()
        if(repeat > 0){
            this._vibrationIntervals[index] = setInterval(() => {
                if(repeat <= 0){
                    clearInterval(this._vibrationIntervals[index])
                    return
                }
                repeat--
                play()
            }, delay + duration)
        }
    }

    connectedGamepads(){
        return navigator.getGamepads().filter((gamepad) => gamepad !== null && gamepad.connected)
    }
}
