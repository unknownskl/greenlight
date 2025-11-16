import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import xCloudPlayer from 'xbox-xcloud-player'
import Stream from 'xbox-xcloud-player/dist/lib/stream'

import { useSettings } from '../../context/userContext'
import StreamComponent from '../../components/ui/streamcomponent'
import StreamPreload from '../../components/ui/streampreload'
import { useTranslation } from 'react-i18next'


import Ipc from '../../lib/ipc'

function StreamPage() {
    const router = useRouter()
    const { settings } = useSettings()
    const { t } = useTranslation()

    const [xPlayer, setxPlayer] = React.useState<InstanceType<typeof xCloudPlayer.Player> | undefined>(undefined)
    const [sessionId, setSessionId] = React.useState('')
    const [queueTime, setQueueTime] = React.useState(0)

    // Detect stream type and title / server id
    let streamType = 'home'
    let serverId = router.query.serverid
    if((router.query.serverid as string).substr(0, 6) === 'xcloud'){
        streamType = 'cloud'
        serverId = (router.query.serverid as string).substr(7)
    }

    // Check for player state
    if(xPlayer !== undefined){
        // We have a player existing
        document.getElementById('streamComponentHolder').innerHTML = '<div id="streamComponent" class="size_'+settings.video_size+'"></div>'
    } else if(sessionId === ''){
        // We dont have a session yet, start one
        Ipc.send('streaming', 'startStream', {
            type: streamType,
            target: serverId,
        }).then((result:string) => {
            console.log('StartStream session:', result)
            setSessionId(result)

        }).catch((error) => {
            alert(t('errors.failedToStartStream') + '\n' + JSON.stringify(error))
        })
    } else {
        // We have a session, check its state
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('streamWindow.pageTitle')} {router.query.serverid}</title>
            </Head>

            { (xPlayer !== undefined) ? <StreamComponent onDisconnect={ () => {
                // onDisconnect()
            }} onMenu={ () => {
                // gamepadSend('nexus')
            } } xPlayer={ xPlayer }></StreamComponent> : (queueTime > 0) ?<StreamPreload onDisconnect={ () => {
                // onDisconnect()
            }} waitingTime={ queueTime }></StreamPreload> : <StreamPreload onDisconnect={ () => {
                // onDisconnect()
            }}></StreamPreload> }
        </React.Fragment>
    )
}

export default StreamPage
