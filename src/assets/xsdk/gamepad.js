class Gamepads {

    #gamepads = []

    #events = {
        'connect': [],
        'disconnect': [],
        'buttonpress': [],
        'axeschange': [],
        'statechange': [],
    }

    constructor() {
        window.addEventListener("gamepadconnected", (e) => {

            var gamepad = {
                index: e.gamepad.index,
                name: e.gamepad.id,
                buttons: e.gamepad.buttons,
                axes: e.gamepad.axes,
            }
            this.#gamepads.push(gamepad)

            this.emitEvent('connect', gamepad)
        })

        window.addEventListener("gamepaddisconnected", (e) => {
            for(var gamepad in this.#gamepads){
                if(this.#gamepads[gamepad].index === e.gamepad.index){
                    var removedGamepad = this.#gamepads[gamepad]
                    this.#gamepads.splice(gamepad, 1)

                    this.emitEvent('disconnect', removedGamepad)
                }
            }
        })

        // Poll gamepad info and read state
        setInterval(() => {
            for(var gamepad in this.#gamepads){
                var gamepadState = navigator.getGamepads()[this.#gamepads[gamepad].index]

                var buttonChange = this.hasButtonStateChange(this.#gamepads[gamepad].buttons, gamepadState.buttons)
                var axesChange = this.hasAxesStateChange(this.#gamepads[gamepad].axes, gamepadState.axes)

                if(buttonChange || axesChange){
                    this.emitEvent('statechange', gamepadState)
                }

                if(buttonChange){
                    this.#gamepads[gamepad].buttons = gamepadState.buttons
                    // gamepadState.timingControllerActivity = performance.now()
                    this.emitEvent('buttonpress', gamepadState.buttons)
                }

                if(axesChange){
                    this.#gamepads[gamepad].axes = gamepadState.axes
                    // gamepadState.timingControllerActivity = performance.now()
                    this.emitEvent('axeschange', gamepadState.buttons)
                }
            }
        }, 50)
    }

    hasButtonStateChange(x, y) {
        var objectsAreSame = false;
        for(var propertyName in x) {
            if(x[propertyName].value !== y[propertyName].value) {
                objectsAreSame = true;
                break;
            }
        }
        return objectsAreSame;
    }

    hasAxesStateChange(x, y) {
        var objectsAreSame = false;
        for(var propertyName in x) {
            if(x[propertyName] !== y[propertyName]) {
                objectsAreSame = true;
                break;
            }
        }
        return objectsAreSame;
    }

    mapStateLabels(buttons, axes) {
        return {
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

    addEventListener(name, callback) {
        this.#events[name].push(callback)
    }

    emitEvent(name, event) {
        for(var callback in this.#events[name]){
            this.#events[name][callback](event)
        }
    }



}