import React from 'react'
import Loader from './loader'
import Card from './card'
import Button from './button'
import ProgressBar from './progressbar'
import { useTranslation } from 'react-i18next'

interface StreamPreloadProps {
  onDisconnect?: () => void;
  waitingTime?: number;
}

function StreamPreload({
    onDisconnect,
    waitingTime = 0,
}: StreamPreloadProps) {
    const { t } = useTranslation()
    const [waitingSeconds, setWaitingSeconds] = React.useState(waitingTime)

    // One countdown per queue estimate (it used to start a new interval on every render)
    React.useEffect(() => {
        setWaitingSeconds(waitingTime)
        if(waitingTime <= 0){
            return
        }

        const secondsInterval = setInterval(() => {
            setWaitingSeconds((seconds) => Math.max(seconds - 1, 0))
        }, 1000)

        return () => {
            clearInterval(secondsInterval)
        }
    }, [waitingTime])

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
            formattedText += ' ' + t('streamWindow.itsTakingALittleLonger')
        }

        return formattedText
    }

    const queueProgress = (waitingTime > 0) ? Math.round((waitingTime - waitingSeconds) / waitingTime * 100) : 0

    return (
        <React.Fragment>
            <div>
                <div id="streamComponent">
                </div>

                <div id="component_streamcomponent_loader">
                    <Card className='padbottom'>
                        <h1>{t("streamWindow.loadingStreamTitle")}</h1>

                        <Loader></Loader>

                        <p>{t("streamWindow.gettingStreamReadyMessage")}</p>
                        <p id="component_streamcomponent_connectionstatus"></p>

                        { waitingTime > 0 &&
                            <div id="component_streamcomponent_waitingtimes">
                                <p>{t("streamWindow.estimatedWaitingTimeMessage")} {formatWaitingTime(waitingSeconds)}</p>
                                <ProgressBar value={ queueProgress }>{ queueProgress }%</ProgressBar>
                            </div>
                        }
                    </Card>
                </div>

                <div id="component_streamcomponent_gamebar">
                    <div id="component_streamcomponent_gamebar_menu">
                        <div style={{
                            width: '25%',
                        }}>
                            <Button label={<span><i className="fa-solid fa-xmark"></i> {t("streamWindow.endStreamBtn")}</span>} title={t("streamWindow.endStreamBtn")} className='btn-cancel' onClick={ () => {
                                endStream()
                            } }></Button> &nbsp;
                            <Button label={<span><i className="fa-solid fa-xmark"></i></span>} title={t("streamWindow.disconnectBtn")} className='btn' onClick={ () => {
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
