import React from 'react'
import Loader from './loader'
import Card from './card'
import Button from './button'
import { useTranslation } from 'react-i18next'

export interface StreamError {
  title: string;
  message: string;
  hints?: string[];
  code?: string;
  details?: string;
}

interface StreamPreloadProps {
  onDisconnect?: () => void;
  onRetry?: () => void;
  waitingTime?: number;
  error?: StreamError;
}

function StreamPreload({
    onDisconnect,
    onRetry,
    waitingTime = 0,
    error,
}: StreamPreloadProps) {
    const { t } = useTranslation()
    const [waitingSeconds, setWaitingSeconds] = React.useState(-1)
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
        const html = '<div>' + t("streamWindow.estimatedWaitingTimeMessage") + ' ' + '<span id="component_streamcomponent_waitingtimes_seconds">'+formattedWaitingTime+'</span></div>'

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
        if(confirm(t('streamWindow.endStreamConfirmMessage'))){
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
            formattedText += hours + ' ' + t("streamWindow.timeHours") + ', '
        }

        if (minutes > 0) {
            formattedText += minutes + ' ' + t("streamWindow.timeMinutes") + ', '
        }

        if (seconds >= 0) {
            formattedText += seconds + ' ' + t("streamWindow.timeSeconds") + '.'
        }

        if(seconds === 0){
            formattedText += t('streamWindow.itsTakingALittleLonger')
        }

        return formattedText
    }

    return (
        <React.Fragment>
            <div>
                <div id="streamComponent">
                </div>

                <div id="component_streamcomponent_loader">
                    { error ? (
                        <Card className='padbottom'>
                            <div className="component_streampreload_error">
                                <i className="fa-solid fa-triangle-exclamation component_streampreload_error_icon"></i>
                                <h1>{error.title}</h1>
                                <p>{error.message}</p>

                                { error.hints && error.hints.length > 0 ? (
                                    <ul>
                                        { error.hints.map((hint) => <li key={hint}>{hint}</li>) }
                                    </ul>
                                ) : null }

                                { (error.code || error.details) ? (
                                    <details>
                                        <summary>{t('streamWindow.errorTechnicalDetails')}</summary>
                                        <code>{error.code ? '[' + error.code + '] ' : ''}{error.details}</code>
                                    </details>
                                ) : null }

                                <p className="component_streampreload_error_actions">
                                    { onRetry ? <Button label={<span><i className="fa-solid fa-rotate-right"></i> {t('streamWindow.retryBtn')}</span>} className='btn-primary' onClick={ () => onRetry() }></Button> : null }
                                    &nbsp;
                                    <Button label={<span><i className="fa-solid fa-arrow-left"></i> {t('streamWindow.backBtn')}</span>} className='btn' onClick={ () => streamDisconnect() }></Button>
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <Card className='padbottom'>
                            <h1>{t("streamWindow.loadingStreamTitle")}</h1>

                            <Loader></Loader>

                            <p>{t("streamWindow.gettingStreamReadyMessage")}</p>
                            <p id="component_streamcomponent_connectionstatus"></p>

                            <p id="component_streamcomponent_waitingtimes"></p>
                        </Card>
                    ) }
                </div>

                <div id="component_streamcomponent_gamebar">
                    {/* Same layout as the stream toolbar (streamcomponent.tsx), with only the exit controls */}
                    <div id="component_streamcomponent_gamebar_menu">
                        <div className="gamebar-group">
                            <Button label={<span><i className="fa-solid fa-xmark"></i> {t("streamWindow.endStreamBtn")}</span>} title={t("streamWindow.endStreamBtn")} className='btn-cancel gamebar-btn' onClick={ () => {
                                endStream()
                            } }></Button>
                            <Button label={<i className="fa-solid fa-right-from-bracket"></i>} title={t("streamWindow.disconnectBtn")} className='gamebar-btn gamebar-icon' onClick={ () => {
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
