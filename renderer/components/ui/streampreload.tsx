import React from 'react'
import Loader from './loader'
import Card from './card'
import Button from './button'

interface StreamPreloadProps {
  onDisconnect?: () => void;
  waitingTime?: number;
}

function StreamPreload({
    onDisconnect,
    waitingTime = 0,
}: StreamPreloadProps) {
    const [waitingSeconds, setWaitingSeconds] = React.useState(-1) // eslint-disable-line @typescript-eslint/no-unused-vars
    // console.log('outeffect', waitingTime, waitingSeconds)

    if(waitingSeconds < 0 && waitingTime > 0){
        // console.log('setWaitingSeconds', waitingTime)
        setWaitingSeconds(waitingTime)
        
    } else if(waitingSeconds > 0){
        // console.log('drawWaitingTimes', waitingSeconds)
        drawWaitingTimes(waitingSeconds)
    }

    React.useEffect(() => {

        return () => {
            
        }
    }, [])

    function drawWaitingTimes(seconds){
        const formattedWaitingTime = formatWaitingTime(seconds)
        const html = '<div>Estimated waiting time in queue: <span id="component_streamcomponent_waitingtimes_seconds">'+formattedWaitingTime+'</span></div>'

        document.getElementById('component_streamcomponent_waitingtimes').innerHTML = html

        const secondsInterval = setInterval(() => {
            seconds--
            setWaitingSeconds(seconds)

            if(document.getElementById('component_streamcomponent_waitingtimes_seconds') !== null){
                document.getElementById('component_streamcomponent_waitingtimes_seconds').innerText = formatWaitingTime(seconds)
            } else {
                clearInterval(secondsInterval)
            }

            if(seconds === 0){
                clearInterval(secondsInterval)
            }
        }, 1000)
    }

    function streamDisconnect(){
        window.history.back()
    }

    function endStream(){
        if(confirm('Are you sure you want to end your stream?')){
            onDisconnect()
            window.history.back()
        }
    }

    function formatWaitingTime(rawSeconds: number): string {
        let formattedText = ''

        const hours = Math.floor(rawSeconds / 3600)
        const minutes = Math.floor((rawSeconds % 3600) / 60)
        const seconds = (rawSeconds % 3600) % 60

        if (hours > 0) {
            formattedText += hours + ' hour(s), '
        }

        if (minutes > 0) {
            formattedText += minutes + ' minute(s), '
        }

        if (seconds >= 0) {
            formattedText += seconds + ' second(s).'
        }

        if(seconds === 0){
            formattedText += '\nIts taking a little longer.. Your stream may start soon.'
        }

        return formattedText
    }

    return (
        <React.Fragment>
            <div>
                <div id="streamComponent">
                </div>

                <div id="component_streamcomponent_loader">
                    <Card className='padbottom'>
                        <h1>Loading...</h1>

                        <Loader></Loader>

                        <p>We are getting your stream ready...</p>
                        <p id="component_streamcomponent_connectionstatus"></p>

                        <p id="component_streamcomponent_waitingtimes"></p>
                    </Card>
                </div>

                <div id="component_streamcomponent_gamebar">
                    <div id="component_streamcomponent_gamebar_menu">
                        <div style={{
                            width: '25%',
                        }}>
                            <Button label={<span><i className="fa-solid fa-xmark"></i> End Stream</span>} title="End Stream" className='btn-cancel' onClick={ () => {
                                endStream() 
                            } }></Button> &nbsp;
                            <Button label={<span><i className="fa-solid fa-xmark"></i></span>} title="Disconnect" className='btn' onClick={ () => {
                                streamDisconnect() 
                            } }></Button>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    )
}

export default StreamPreload
