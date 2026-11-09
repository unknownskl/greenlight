import xCloudPlayer from '../player'
import { VibrationFrame } from '../channel/input'

export interface GamepadOptions {
    enable_keyboard?: boolean;
    enable_gamepad?: boolean;
    enable_vibration?: boolean;
    keyboard_mapping?: {
        [key:string]: string;
    };
    gamepad_mapping?: {
        [key:string]: string;
    };
    gamepad_axes_mapping?: {
        [key:string]: string;
    };
    gamepad_deadzone?: number;
    gamepad_force_capture?: boolean;
}

export interface GamepadOptionsDefaults extends Required<GamepadOptions> {}

export default class Gamepad {
    private _player: xCloudPlayer | undefined
    private _index: number
    private _physicalGamepadId = -1
    private _rumbleInterval
    private _isFocused = true
    private _gamepadOverride = {
        buttons: {},
    }

    private _options:GamepadOptionsDefaults = {
        enable_keyboard: false,
        enable_gamepad: true,
        enable_vibration: true,
        keyboard_mapping: {
            'A': 'Enter',
            'B': 'Backspace',
            'X': 'x',
            'Y': 'y',
            'DPadUp': 'ArrowUp',
            'DPadDown': 'ArrowDown',
            'DPadLeft': 'ArrowLeft',
            'DPadRight': 'ArrowRight',
            'LeftShoulder': '[',
            'RightShoulder': ']',
            'LeftThumb': 'l',
            'RightThumb': 'r',
            'LeftTrigger': '-',
            'RightTrigger': '=',
            'Menu': 'm',
            'View': 'v',
            'Nexus': 'n',
        },
        gamepad_mapping: {
            'A': '0',
            'B': '1',
            'X': '2',
            'Y': '3',
            'DPadUp': '12',
            'DPadDown': '13',
            'DPadLeft': '14',
            'DPadRight': '15',
            'LeftShoulder': '4',
            'RightShoulder': '5',
            'LeftThumb': '10',
            'RightThumb': '11',
            'LeftTrigger': '6',
            'RightTrigger': '7',
            'Menu': '9',
            'View': '8',
            'Nexus': '16',
        },
        gamepad_axes_mapping: {
            'LeftThumbXAxis': '0',
            'LeftThumbYAxis': '1',
            'RightThumbXAxis': '2',
            'RightThumbYAxis': '3',
        },
        gamepad_deadzone: 0.08,
        gamepad_force_capture: false,
    }

    private _listener = {
        keyDown: this.onKeyDown.bind(this),
        keyUp: this.onKeyUp.bind(this),
        gamepadConnected: this.onGamepadConnected.bind(this),
        gamepadDisconnected: this.onGamepadDisconnected.bind(this),
        windowFocus: this.onWindowFocus.bind(this),
        windowBlur: this.onWindowBlur.bind(this),
    }

    constructor(index:number, options:GamepadOptions = {}){
        this._index = index

        this._options = {
            ...this._options,
            ...options,
        }
    }

    attach(xCloudPlayer:xCloudPlayer){
        this._player = xCloudPlayer

        this._player._channels.control.sendGamepadState(this._index, true, this)

        if(this._options.enable_keyboard === true){
            window.addEventListener('keydown', this._listener.keyDown)
            window.addEventListener('keyup', this._listener.keyUp)
        }

        if(this._options.enable_gamepad === true){
            window.addEventListener('gamepadconnected', this._listener.gamepadConnected)
            window.addEventListener('gamepaddisconnected', this._listener.gamepadDisconnected)
        }

        if(this._options.enable_gamepad === true && this._options.gamepad_force_capture === false){
            window.addEventListener('blur', this._listener.windowBlur)
            window.addEventListener('focus', this._listener.windowFocus)
        }

        this.detectActiveGamepad()
    }

    detach(){
        if(this._player === undefined){
            console.log('[Gamepad] Player is not attached. this._player is:', this._player)
            return
        }
        this._player._channels.control.sendGamepadState(this._index, false)
        this._physicalGamepadId = -1

        if(this._rumbleInterval !== undefined){
            clearInterval(this._rumbleInterval)
        }

        if(this._options.enable_keyboard === true){
            window.removeEventListener('keydown', this._listener.keyDown)
            window.removeEventListener('keyup', this._listener.keyUp)
        }

        if(this._options.enable_gamepad === true){
            window.removeEventListener('gamepadconnected', this._listener.gamepadConnected)
            window.removeEventListener('gamepaddisconnected', this._listener.gamepadDisconnected)
        }

        if(this._options.enable_gamepad === true && this._options.gamepad_force_capture === false){
            window.removeEventListener('blur', this._listener.windowBlur)
            window.removeEventListener('focus', this._listener.windowFocus)
        }
    }

    sendButtonState(button, value){
        if(this._player === undefined){
            console.log('[Gamepad] Player is not attached. this._player is:', this._player)
            return
        }

        if(! (button in this.getDefaultFamepadFrame())){
            console.log('[Gamepad] Invalid button:', button)
            return
        }

        const buttonPreset = this.getDefaultFamepadFrame()
        buttonPreset.GamepadIndex = this._index
        this._gamepadOverride.buttons[button] = value
    }

    onKeyDown(event:KeyboardEvent){
        if(this._isFocused === false){
            return
        }

        for(const button in this._options.keyboard_mapping){
            if(this._options.keyboard_mapping[button] === event.key){
                this._gamepadOverride.buttons[button] = 1
                event.preventDefault()
            }
        }
    }

    onKeyUp(event:KeyboardEvent){
        if(this._isFocused === false){
            return
        }

        for(const button in this._options.keyboard_mapping){
            if(this._options.keyboard_mapping[button] === event.key){
                this._gamepadOverride.buttons[button] = 0
                event.preventDefault()
            }
        }
    }

    onWindowFocus(){
        this._isFocused = true
    }

    onWindowBlur(){
        // this._isFocused = false
    }

    getDefaultFamepadFrame(){
        return {
            GamepadIndex: 0,
            Nexus: 0,
            Menu: 0,
            View: 0,
            A: 0,
            B: 0,
            X: 0,
            Y: 0,
            DPadUp: 0,
            DPadDown: 0,
            DPadLeft: 0,
            DPadRight: 0,
            LeftShoulder: 0,
            RightShoulder: 0,
            LeftThumb: 0,
            RightThumb: 0,

            LeftThumbXAxis: 0,
            LeftThumbYAxis: 0,
            RightThumbXAxis: 0,
            RightThumbYAxis: 0,
            LeftTrigger: 0,
            RightTrigger: 0,
        }
    }

    detectActiveGamepad(){
        if(this._physicalGamepadId < 0){
            for(const gamepadBrowser in navigator.getGamepads()){
                const gamepadIndex = navigator.getGamepads()[gamepadBrowser]?.index
                if(gamepadIndex === undefined){
                    continue
                }

                let gamepadFoundInHandler = false
                for(const gamepad in this._player?._channels.control.getGamepadHandlers()){
                    if(
                        this._player?._channels.control.getGamepadHandlers()[gamepad] instanceof Gamepad &&
                        (this._player?._channels.control.getGamepadHandlers()[gamepad] as Gamepad)._physicalGamepadId === navigator.getGamepads()[gamepadBrowser]?.index
                    ) {
                        console.log('[Gamepad] Active gamepad already detected:', gamepadIndex, (this._player?._channels.control.getGamepadHandlers()[gamepad] as Gamepad)._physicalGamepadId)
                        gamepadFoundInHandler = true
                        continue
                    }
                }

                if(gamepadFoundInHandler === false){
                    this._physicalGamepadId = gamepadIndex
                    console.log('[Gamepad] Active gamepad detected:', this._physicalGamepadId)
                }
            }
        } else {
            console.log('[Gamepad] Physical gamepad already detected:', this._physicalGamepadId)
        }
    }

    onGamepadConnected(event:GamepadEvent){
        if(this._physicalGamepadId < 0){
            for(const gamepad in this._player?._channels.control.getGamepadHandlers()){
                if(
                    this._player?._channels.control.getGamepadHandlers()[gamepad] instanceof Gamepad &&
                    (this._player?._channels.control.getGamepadHandlers()[gamepad] as Gamepad)._physicalGamepadId === event.gamepad.index
                ) {
                    return
                }
            }

            this._physicalGamepadId = event.gamepad.index
        }
    }

    onGamepadDisconnected(event:GamepadEvent){
        if(event.gamepad.index === this._physicalGamepadId){
            this._physicalGamepadId = -1
        }
    }

    hasOverrideButtons(){
        return Object.keys(this._gamepadOverride.buttons).length > 0
    }

    getGamepadState(){
        const gamepad = this.getGamepad(this._physicalGamepadId)
        if((this._physicalGamepadId < 0 || gamepad === undefined || this._isFocused === false) && (this.hasOverrideButtons() === false)){
            return undefined
        }

        const frame = this.getDefaultFamepadFrame()
        frame.GamepadIndex = this._index

        // Set buttons
        if(gamepad !== undefined){
            for(const button in this._options.gamepad_mapping){
                frame[button] = gamepad.buttons[this._options.gamepad_mapping[button]].value
            }

            // Set axis
            for(const axis in this._options.gamepad_axes_mapping){
                frame[axis] = this.normaliseAxis(gamepad.axes[this._options.gamepad_axes_mapping[axis]])
            }
        }

        // Check for button overrides from the keyboard
        // for(const button in this._gamepadOverride.buttons){
        //     frame[button] = this._gamepadOverride.buttons[button]

        //     // Clean up existing keys if they are 0
        //     if(this._gamepadOverride.buttons[button] === 0){
        //         // Remove key from override
        //         const newOverrideButtons = {}
        //         for(const oButton in this._gamepadOverride.buttons){
        //             if(this._gamepadOverride.buttons[oButton] !== 0){
        //                 newOverrideButtons[oButton] = this._gamepadOverride.buttons[oButton]
        //             }
        //         }
        //         this._gamepadOverride.buttons = newOverrideButtons
        //     }
        // }

        // Check for button overrides from the keyboard
        for(const button in this._gamepadOverride.buttons){
            frame[button] = this._gamepadOverride.buttons[button]
        }

        // Clean up released buttons in a separate pass
        const buttonsToRemove = []
        for(const button in this._gamepadOverride.buttons){
            if(this._gamepadOverride.buttons[button] === 0){
                buttonsToRemove.push(button)
            }
        }

        // Delete released buttons instead of recreating the object
        for(const button of buttonsToRemove){
            delete this._gamepadOverride.buttons[button]
        }

        // Start + Select Nexus menu workaround
        if(frame.View > 0 && frame.Menu > 0){
            frame.View = 0
            frame.Menu = 0

            frame.Nexus = 1
        }

        return frame
    }

    getGamepad(index = -1){
        const gamepad = navigator.getGamepads()[index]
        if(gamepad !== null) {
            return gamepad
        } else {
            return undefined
        }
    }

    getPhysicalGamepadId(){
        return this._physicalGamepadId
    }

    handleVibration(report:VibrationFrame){
        if(this._physicalGamepadId < 0){
            console.log('[Gamepad] Received a vibration report but no physical gamepad is connected')
            return
        }

        const gamepad = this.getGamepad(this._physicalGamepadId)
        if(gamepad === undefined){
            console.log('[Gamepad] Received a vibration report but no physical gamepad is connected')
            return
        }

        if(this._options.enable_vibration === false){
            return
        }

        const rumbleData = {
            startDelay: 0,
            duration: report.durationMs,
            weakMagnitude: report.rightMotorPercent,
            strongMagnitude: report.leftMotorPercent,

            leftTrigger: report.leftTriggerMotorPercent,
            rightTrigger: report.rightTriggerMotorPercent,
        }
        
        // @ts-expect-error - dual-rumble is not in the types
        if(gamepad.vibrationActuator?.type === 'dual-rumble') {
            const intensityRumble = report.rightMotorPercent < .6 ? (.6 - report.rightMotorPercent) / 2 : 0
            const intensityRumbleTriggers = (report.leftTriggerMotorPercent + report.rightTriggerMotorPercent) / 4
            const endIntensity = Math.min(intensityRumble, intensityRumbleTriggers)
            
            rumbleData.weakMagnitude = Math.min(1, report.rightMotorPercent + endIntensity)

            // Set triggers to 0 as dual-rumble does not support Triggers
            // @TODO: Check if we can improve rumble: https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadHapticsActuatorTriggerRumble/explainer.md
            rumbleData.leftTrigger = 0
            rumbleData.rightTrigger = 0

            gamepad.vibrationActuator?.playEffect('dual-rumble', rumbleData).catch((error) => {
                console.error('[Gamepad] Failed to play the rumble effect:', error)
            })

            clearInterval(this._rumbleInterval)
            if(report.repeat > 0) {
                let repeatCount = report.repeat

                this._rumbleInterval = setInterval(() => {
                    if(repeatCount <= 0){
                        clearInterval(this._rumbleInterval)
                    }

                    if(gamepad.vibrationActuator !== undefined) {
                        gamepad.vibrationActuator?.playEffect('dual-rumble', rumbleData).catch((error) => {
                            console.error('[Gamepad] Failed to play the rumble effect:', error)
                        })
                    }
                    repeatCount--

                }, report.delayMs + report.durationMs)
            }
        } else {
            console.log('[Gamepad] Unknown vibration type:', (gamepad.vibrationActuator as any).type)
        }
    }

    normaliseAxis(value:number) {
        if(Math.abs(value) < this._options.gamepad_deadzone) {
            return 0
        }

        value = value - Math.sign(value) * this._options.gamepad_deadzone
        value /= (1.0 - this._options.gamepad_deadzone)
        
        return value
    }
}