/**
 * Speed of the mouse in the "Mouse & Keyboard" mode of the player.
 *
 * The player sends every mouse movement multiplied by a fixed number, which is too fast for many mice and
 * can not be set. The movement is scaled here before the player sees it. Fractions are carried over to the next
 * movement, so slow movements are not lost when the speed is below 100%.
 */
export default function applyMouseSensitivity(player: any, sensitivity: number | undefined): () => void {
    const factor = typeof sensitivity === 'number' && sensitivity > 0 ? sensitivity : 1
    if(Math.abs(factor - 1) < 0.001){
        return () => undefined
    }

    let remainderX = 0
    let remainderY = 0
    let attempts = 0

    const attach = () => {
        attempts++

        let input: any
        try {
            input = player.getChannelProcessor('input')
        } catch(error) {
            input = undefined
        }

        if(input === undefined || input === null || typeof input.onPointerMove !== 'function'){
            // The channel is created when the stream connects
            if(attempts > 600){
                clearInterval(timer)
            }
            return
        }

        clearInterval(timer)
        if(input.__greenlightMouseSpeed === true){
            return
        }
        input.__greenlightMouseSpeed = true

        const original = input.onPointerMove.bind(input)
        input.onPointerMove = (event: PointerEvent) => {
            if(input._mouseActive !== true || input._mouseLocked !== true){
                return original(event)
            }

            const wantedX = event.movementX * factor + remainderX
            const wantedY = event.movementY * factor + remainderY
            const x = Math.trunc(wantedX)
            const y = Math.trunc(wantedY)
            remainderX = wantedX - x
            remainderY = wantedY - y

            // The player reads movementX / movementY of the event: it gets the scaled values
            const scaled = new Proxy(event, {
                get(target: any, name: string | symbol) {
                    if(name === 'movementX'){ return x }
                    if(name === 'movementY'){ return y }
                    const value = target[name]
                    return typeof value === 'function' ? value.bind(target) : value
                },
            })

            return original(scaled)
        }
    }

    const timer = setInterval(attach, 500)
    attach()

    return () => clearInterval(timer)
}
